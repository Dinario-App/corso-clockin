import {
  PublicKey,
  VersionedTransaction,
  type AccountKeysFromLookups,
} from '@solana/web3.js';
import type { CorsoSession } from '@/src/features/session/types';
import { assertSwapTransactionSemantics } from '@/src/features/security/assertSwapSemantics';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import {
  assertReviewedOutputTokenFactsIntent,
  type ReviewedOutputTokenFactsSnapshot,
} from '@/src/features/tokenFacts/reviewedTokenFacts';

export type SafeToSignContext = {
  purpose?: 'swap' | 'send' | 'other';
  expectedMessageBytes?: Uint8Array;
  /**
   * Exact required-signer count from trusted policy (not from the tx).
   * Swap production always expects 1 unless an MM pubkey is bound.
   */
  expectedRequiredSignatures?: number;
  /** Optional bound MM co-signer pubkey (base58). Enables expected=2. */
  mmSignerAddress?: string | null;
  expireAt?: string | null;
  currentBlockHeight?: number | null;
  lastValidBlockHeight?: number | null;
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  otherAmountThreshold?: string;
  maxSlippageBps?: number | null;
  quoteSlippageBps?: number | null;
  corsoFeeBps?: number | null;
  quoteFeeBps?: number | null;
  platformFeeBps?: number | null;
  positiveSlippageBps?: number | null;
  feeMint?: string | null;
  feeDestination?: string | null;
  /** Reviewed Corso fee amount (output-mint atomic units), already digest-bound. */
  platformFeeAmount?: string | null;
  /** Output mint decimals; omitted → resolved offline, unknown → fail closed. */
  outputMintDecimals?: number | null;
  /** Caller-frozen Review snapshot; required for Token-2022 fee paths. */
  reviewedOutputTokenFacts?: ReviewedOutputTokenFactsSnapshot | null;
  reviewedInputTokenFacts?: ReviewedOutputTokenFactsSnapshot | null;
  /** Digest and cluster independently expected by the live reviewed intent. */
  quoteDigest?: string;
  cluster?: PriceCluster;
  /** Jupiter `instructionVersion` echoed by the quote. Must be `V1` on Metis. */
  instructionVersion?: string | null;
  accountKeysFromLookups?: AccountKeysFromLookups;
};

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function parseExpireDeadline(expireAt: string): number | null {
  const asNumber = Number(expireAt);
  if (Number.isFinite(asNumber) && asNumber > 0) {
    return asNumber < 1e12 ? asNumber * 1000 : asNumber;
  }
  const parsed = Date.parse(expireAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertFreshness(
  context: SafeToSignContext,
  purpose: SafeToSignContext['purpose'],
): void {
  if (purpose !== 'swap') {
    if (context.expireAt == null || context.expireAt === '') return;
    const deadline = parseExpireDeadline(context.expireAt);
    if (deadline != null && Date.now() > deadline) {
      throw new Error('Quote expired. Go back and get a fresh quote.');
    }
    return;
  }

  const expireAt = context.expireAt;
  const hasExpire = expireAt != null && expireAt !== '';
  const deadline = hasExpire ? parseExpireDeadline(expireAt!) : null;
  if (hasExpire && deadline == null) {
    throw new Error('Quote expiry is invalid. Get a fresh quote.');
  }
  if (deadline != null) {
    if (Date.now() > deadline) {
      throw new Error('Quote expired. Go back and get a fresh quote.');
    }
    return; // usable expireAt alone is enough
  }

  const last = context.lastValidBlockHeight;
  const tip = context.currentBlockHeight;
  if (last == null || tip == null) {
    throw new Error('Quote freshness missing. Get a fresh quote.');
  }
  if (tip > last) {
    throw new Error('Quote blockhash expired. Get a fresh quote.');
  }
}

export function assertSafeToSign(
  transaction: unknown,
  session: CorsoSession,
  context: SafeToSignContext = {},
): void {
  if (!session.address) {
    throw new Error('Cannot sign without a session address');
  }

  if (!(transaction instanceof VersionedTransaction)) {
    throw new Error('Expected a VersionedTransaction');
  }

  const version = transaction.version;
  if (version !== 0 && version !== 'legacy') {
    throw new Error(
      `Refusing to sign transaction version ${String(version)}.`,
    );
  }

  const keys = transaction.message.staticAccountKeys;
  if (keys.length === 0) {
    throw new Error('Transaction has no accounts');
  }

  let feePayer: string;
  try {
    feePayer = keys[0]!.toBase58();
  } catch {
    throw new Error('Fee payer is not a valid public key');
  }
  if (feePayer !== session.address) {
    throw new Error('Fee payer does not match session address');
  }

  try {
    // eslint-disable-next-line no-new
    new PublicKey(session.address);
  } catch {
    throw new Error('Session address is not a valid public key');
  }

  const required = transaction.message.header.numRequiredSignatures;
  if (required < 1) {
    throw new Error('Unexpected required signers');
  }

  const mm = context.mmSignerAddress?.trim() || null;
  const expectedCount =
    context.expectedRequiredSignatures ??
    (context.purpose === 'swap' ? (mm ? 2 : 1) : 1);

  if (required !== expectedCount) {
    throw new Error('Unexpected required signers');
  }

  const signerKeys = keys.slice(0, required).map((key) => key.toBase58());
  if (signerKeys[0] !== session.address) {
    throw new Error('Session address must be the primary signer');
  }

  if (expectedCount === 2) {
    if (!mm || signerKeys[1] !== mm) {
      throw new Error('Unexpected co-signer. Refusing to sign.');
    }
  }

  assertFreshness(context, context.purpose);

  if (
    context.maxSlippageBps != null &&
    context.quoteSlippageBps != null &&
    context.quoteSlippageBps > context.maxSlippageBps
  ) {
    throw new Error('Slippage exceeds the allowed ceiling.');
  }

  if (context.expectedMessageBytes) {
    const actual = transaction.message.serialize();
    if (!bytesEqual(actual, context.expectedMessageBytes)) {
      throw new Error(
        'Transaction does not match the reviewed quote. Refusing to sign.',
      );
    }
  }

  if (context.purpose === 'swap') {
    if (
      !context.inputMint ||
      !context.outputMint ||
      !context.inAmount ||
      !context.outAmount ||
      !context.otherAmountThreshold
    ) {
      throw new Error('Swap quote context incomplete. Refusing to sign.');
    }
    if (context.reviewedInputTokenFacts != null) {
      assertReviewedOutputTokenFactsIntent({snapshot:context.reviewedInputTokenFacts,quoteDigest:context.quoteDigest,cluster:context.cluster,outputMint:context.inputMint});
    }
    if (context.reviewedOutputTokenFacts != null) {
      assertReviewedOutputTokenFactsIntent({
        snapshot: context.reviewedOutputTokenFacts,
        quoteDigest: context.quoteDigest,
        cluster: context.cluster,
        outputMint: context.outputMint,
      });
    }
    assertSwapTransactionSemantics(transaction, {
      inputMint: context.inputMint,
      outputMint: context.outputMint,
      inAmount: context.inAmount,
      outAmount: context.outAmount,
      otherAmountThreshold: context.otherAmountThreshold,
      sessionAddress: session.address,
      quoteSlippageBps: context.quoteSlippageBps,
      maxSlippageBps: context.maxSlippageBps,
      corsoFeeBps: context.corsoFeeBps,
      quoteFeeBps: context.quoteFeeBps,
      platformFeeBps: context.platformFeeBps,
      positiveSlippageBps: context.positiveSlippageBps,
      feeMint: context.feeMint,
      feeDestination: context.feeDestination,
      platformFeeAmount: context.platformFeeAmount,
      outputMintDecimals: context.outputMintDecimals,
      reviewedOutputTokenFacts: context.reviewedOutputTokenFacts,
      reviewedInputTokenFacts: context.reviewedInputTokenFacts,
      quoteDigest: context.quoteDigest,
      cluster: context.cluster,
      instructionVersion: context.instructionVersion,
      accountKeysFromLookups: context.accountKeysFromLookups,
    });
  }
}

export function messageBytesOf(
  transaction: VersionedTransaction,
): Uint8Array {
  return transaction.message.serialize();
}

export { bytesEqual };
