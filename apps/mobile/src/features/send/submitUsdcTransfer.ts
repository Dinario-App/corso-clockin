import type { CorsoSigner } from '@corso/wallet';
import type { Connection, VersionedTransaction } from '@solana/web3.js';
import {
  SendTransactionError,
  SolanaJSONRPCError,
  SolanaJSONRPCErrorCode,
} from '@solana/web3.js';
import {
  assertSafeToSign,
} from '@/src/features/security/assertSafeToSign';
import {
  assertMfaForHighValue,
  StepUpRequiredError,
} from '@/src/features/security/mfaGateCore';
import {
  gateMoneySigner,
  requireMoneySignerGateCells,
  requireMoneySignerLiveForBroadcast,
  type MoneySignerGateCells,
} from '@/src/features/security/requireMoneySignerGate';
import { assertSignedMatchesMessage } from '@/src/features/security/verifySignedTransaction';
import type { CorsoSession } from '@/src/features/session/types';
import {
  assertUsdcCompiledTransferSemantics,
  requireUsdcPayerAddress,
  type ReviewedUsdcTransferIntent,
} from '@/src/features/send/assertUsdcCompiledTransferSemantics';
import {
  SPL_TOKEN_ACCOUNT_SIZE,
  type BuiltUsdcTransfer,
} from '@/src/features/send/buildUsdcTransfer';
import { atomicToUsdcString } from '@/src/features/send/parseUsdcAmount';
import {
  freezeUsdcSendReviewFromBuilt,
  usdcSendReviewTermsMatch,
  type UsdcSendReviewFreeze,
} from '@/src/features/send/usdcSendIntent';
import {
  validateUsdcSendForm,
  type UsdcSendCluster,
} from '@/src/features/send/validateUsdcSend';
import type { StepUpPolicy } from '@/src/lib/apiConfig';

type ClearableUsdcSigner = CorsoSigner<VersionedTransaction, Connection> & {
  clear?: () => void;
};

export type SubmitUsdcTransferConfirmation = 'confirmed' | 'uncertain';

/**
 * Submit outcome. `review_updated` means live fee/rent/ATA/consent terms
 * drifted after the last explicit review — caller must show the new freeze
 * and require another Send tap before any sign/broadcast.
 */
export type SubmitUsdcTransferResult =
  | {
      status: 'submitted';
      signature: string;
      confirmation: SubmitUsdcTransferConfirmation;
    }
  | {
      status: 'review_updated';
      freeze: UsdcSendReviewFreeze;
    };

export type UsdcSubmitLiveBalances = {
  /** Atomic USDC balance; null = unknown → fail closed. */
  usdcBalanceAtomic: bigint | null;
  /** Sender SOL lamports for fee + optional ATA rent; null = unknown → fail closed. */
  solBalanceLamports: number | null;
  cluster: UsdcSendCluster;
};

/** On-chain execution failed after broadcast; signature retained for Activity. */
export class UsdcTransferExecutionFailedError extends Error {
  readonly signature: string;
  constructor(signature: string) {
    super("Couldn't send. Try again.");
    this.name = 'UsdcTransferExecutionFailedError';
    this.signature = signature;
  }
}

/**
 * Complete review freeze drifted after step-up (or other post-review awaits)
 * and before raw sign. Caught by submitUsdcTransfer → typed `review_updated`
 * with zero raw sign / zero broadcast.
 */
export class UsdcSendReviewUpdatedError extends Error {
  readonly freeze: UsdcSendReviewFreeze;
  constructor(freeze: UsdcSendReviewFreeze) {
    super('USDC send review updated');
    this.name = 'UsdcSendReviewUpdatedError';
    this.freeze = freeze;
  }
}

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Exact public-safe domain messages this module may surface outward. */
const CANONICAL_USDC_SEND_MESSAGES = new Set<string>([
  "Couldn't send. Try again.",
  'Not enough USDC',
  'Not enough SOL for network fees and token account rent',
  'Not enough SOL to cover network fees',
  'This transfer expired. Review again to retry.',
  'Send cancelled.',
  'Cannot send without a session address',
  'Session address is not a valid public key',
  'Expected a VersionedTransaction',
  "Couldn't confirm the network fee. Pull back and try again.",
  "Couldn't confirm token account rent. Pull back and try again.",
  "Couldn't confirm your USDC balance. Pull back and try again.",
  "Couldn't confirm your SOL balance for network fees.",
  "Couldn't confirm the SOL reserve required for this send.",
  'USDC mint is not allowed for this network.',
  'Enter a valid Solana address.',
  "You can't send to your own address.",
  'Enter a valid USDC amount.',
  'USDC amount no longer matches the reviewed transfer.',
  'USDC mint no longer matches the reviewed transfer.',
  'Recipient no longer matches the reviewed transfer.',
  'USDC transfer changed after review. Refusing to sign.',
  'Reviewed USDC intent is missing or mutable. Refusing to sign.',
  'Reviewed USDC freeze is missing or mutable. Refusing to sign.',
  'Built USDC transfer no longer matches reviewed intent. Refusing to sign.',
  'This wallet cannot sign transfers yet.',
  'Broadcast signature does not match the signed USDC transfer.',
  'Signed USDC transfer is missing a usable signature.',
  'USDC transfer decimals must be 6. Refusing to sign.',
  'USDC amount must be positive. Refusing to sign.',
  'USDC transfer must not use address lookup tables. Refusing to sign.',
  'USDC transfer account keys are malformed. Refusing to sign.',
  'USDC transfer has no accounts. Refusing to sign.',
  'Fee payer does not match reviewed USDC intent.',
  'Unexpected required signers for USDC transfer.',
  'Session address must be the primary signer',
  'USDC transfer blockhash does not match reviewed intent.',
  'USDC transfer instruction count does not match reviewed intent.',
  'USDC create-ATA program is not allowlisted. Refusing to sign.',
  'USDC create-ATA account count does not match reviewed shape. Refusing to sign.',
  'USDC create-ATA accounts do not match reviewed intent. Refusing to sign.',
  'USDC create-ATA instruction data is unexpected. Refusing to sign.',
  'USDC transfer program is not allowlisted. Refusing to sign.',
  'USDC transferChecked account count does not match reviewed shape. Refusing to sign.',
  'USDC transferChecked accounts do not match reviewed intent. Refusing to sign.',
  'USDC transferChecked instruction data is unexpected. Refusing to sign.',
  'USDC transferChecked amount/decimals do not match reviewed intent.',
  'Disallowed program ID in USDC send. Refusing to sign.',
  'USDC transfer ATA metadata does not match owner/recipient mint. Refusing to sign.',
  'Reviewed USDC ATA fields do not match owner/recipient mint. Refusing to sign.',
  'USDC transfer owner/recipient keys are invalid. Refusing to sign.',
  'Cannot sign without a session address',
  'Fee payer does not match session address',
  'Unexpected required signers',
  'Unexpected co-signer. Refusing to sign.',
  'Wallet returned an unsigned transaction',
  'Wallet signature is not valid for this session',
  'Wallet returned a different transaction than reviewed. Refusing to submit.',
  'Transaction does not match the reviewed quote. Refusing to sign.',
]);

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  let value = 0n;
  for (let i = zeros; i < bytes.length; i += 1) {
    value = value * 256n + BigInt(bytes[i]);
  }

  let body = '';
  while (value > 0n) {
    const mod = Number(value % 58n);
    body = BASE58_ALPHABET[mod] + body;
    value = value / 58n;
  }
  return `${'1'.repeat(zeros)}${body}`;
}

function signatureOfSignedUsdcTransfer(signed: VersionedTransaction): string {
  const sig = signed.signatures[0];
  if (!sig || sig.length !== 64 || sig.every((b) => b === 0)) {
    throw new Error('Signed USDC transfer is missing a usable signature.');
  }
  return encodeBase58(sig);
}

/**
 * Exact enumerated Solana JSON-RPC codes that prove the signed bytes were
 * deterministically rejected before acceptance — never transport ambiguity.
 */
const DETERMINISTIC_PREFLIGHT_RPC_CODES: ReadonlySet<number> = new Set([
  SolanaJSONRPCErrorCode.JSON_RPC_SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  SolanaJSONRPCErrorCode.JSON_RPC_SERVER_ERROR_TRANSACTION_SIGNATURE_VERIFICATION_FAILURE,
  SolanaJSONRPCErrorCode.JSON_RPC_SERVER_ERROR_TRANSACTION_PRECOMPILE_VERIFICATION_FAILURE,
]);

function isDeterministicPreflightRejection(error: unknown): boolean {
  if (error instanceof SolanaJSONRPCError) {
    return (
      typeof error.code === 'number' &&
      DETERMINISTIC_PREFLIGHT_RPC_CODES.has(error.code)
    );
  }
  if (error instanceof SendTransactionError) {
    const detail = error.transactionError;
    return typeof detail?.message === 'string';
  }
  return false;
}

async function fetchLiveBlockHeight(connection: Connection): Promise<number> {
  const tip = await connection.getBlockHeight('confirmed');
  if (!Number.isSafeInteger(tip) || tip < 0) {
    throw new Error('This transfer expired. Review again to retry.');
  }
  return tip;
}

async function resolvePreSignBlockHeight(
  connection: Connection,
  provided: number | null | undefined,
): Promise<number> {
  if (provided != null) {
    if (!Number.isSafeInteger(provided) || provided < 0) {
      throw new Error('This transfer expired. Review again to retry.');
    }
    return provided;
  }
  return fetchLiveBlockHeight(connection);
}

function assertUsdcBlockhashFresh(args: {
  tip: number;
  lastValidBlockHeight: number;
}): void {
  if (args.tip > args.lastValidBlockHeight) {
    throw new Error('This transfer expired. Review again to retry.');
  }
}

function assertBuiltMatchesReviewedIntent(args: {
  built: BuiltUsdcTransfer;
  intent: ReviewedUsdcTransferIntent;
  payer: string;
}): void {
  const { built, intent, payer } = args;
  if (
    intent.payer !== payer ||
    built.recipient !== intent.recipient ||
    built.mint !== intent.mint ||
    built.amountAtomic !== intent.amountAtomic ||
    built.sourceAta !== intent.sourceAta ||
    built.destinationAta !== intent.destinationAta ||
    built.createdDestinationAta !== intent.createdDestinationAta ||
    built.blockhash !== intent.blockhash ||
    built.lastValidBlockHeight !== intent.lastValidBlockHeight
  ) {
    throw new Error(
      'Built USDC transfer no longer matches reviewed intent. Refusing to sign.',
    );
  }
}

function humanizeUsdcSendError(error: unknown): Error {
  if (error instanceof StepUpRequiredError) {
    return error;
  }
  if (error instanceof UsdcSendReviewUpdatedError) {
    return error;
  }
  if (error instanceof UsdcTransferExecutionFailedError) {
    return error;
  }
  if (error instanceof Error) {
    if (CANONICAL_USDC_SEND_MESSAGES.has(error.message)) {
      return new Error(error.message);
    }
    const msg = error.message.toLowerCase();
    if (
      msg.includes('not enough usdc') ||
      msg.includes('insufficient usdc') ||
      msg.includes('source usdc token account has insufficient')
    ) {
      return new Error('Not enough USDC');
    }
    if (
      msg.includes('not enough sol for network fees and token account rent') ||
      (msg.includes('token account rent') && msg.includes('not enough'))
    ) {
      return new Error('Not enough SOL for network fees and token account rent');
    }
    if (
      msg.includes('insufficient') ||
      msg.includes('no record of a prior credit') ||
      msg.includes('attempt to debit') ||
      msg.includes('not enough sol')
    ) {
      return new Error('Not enough SOL to cover network fees');
    }
    if (msg.includes('blockhash') || msg.includes('expired')) {
      return new Error('This transfer expired. Review again to retry.');
    }
    if (
      msg.includes('user rejected') ||
      msg.includes('cancelled') ||
      msg.includes('canceled') ||
      msg.includes('authentication')
    ) {
      return new Error('Send cancelled.');
    }
    // Never return provider-controlled text verbatim.
    return new Error("Couldn't send. Try again.");
  }
  return new Error("Couldn't send. Try again.");
}

/**
 * Live fee / rent / ATA re-check against the same `built` instance that will be signed,
 * compared to the complete immutable review freeze. Never rebuilds; never substitutes
 * a default fee. Any consent-surface drift returns `review_updated` (no sign).
 * Fail closed on unknown fee/rent/balance.
 */
export type UsdcBuiltStillSafeResult =
  | { status: 'ok'; freeze: UsdcSendReviewFreeze }
  | { status: 'review_updated'; freeze: UsdcSendReviewFreeze };

export async function assertUsdcBuiltStillSafeToSubmit(args: {
  connection: Connection;
  built: BuiltUsdcTransfer;
  session: CorsoSession;
  balances: UsdcSubmitLiveBalances;
  /** Complete consent freeze from the last explicit review / reconcile. */
  reviewedFreeze: UsdcSendReviewFreeze;
}): Promise<UsdcBuiltStillSafeResult> {
  const { built, session, balances } = args;
  if (!session.address) {
    throw new Error('Cannot send without a session address');
  }

  if (
    built.feeLamports === null ||
    !Number.isSafeInteger(built.feeLamports) ||
    built.feeLamports < 0
  ) {
    throw new Error("Couldn't confirm the network fee. Pull back and try again.");
  }

  const needsDestinationAta = built.createdDestinationAta;
  let ataRentLamports = 0;
  if (needsDestinationAta) {
    const rent = await args.connection.getMinimumBalanceForRentExemption(
      SPL_TOKEN_ACCOUNT_SIZE,
    );
    if (!Number.isSafeInteger(rent) || rent <= 0) {
      throw new Error(
        "Couldn't confirm token account rent. Pull back and try again.",
      );
    }
    ataRentLamports = rent;
  }

  const freezeResult = freezeUsdcSendReviewFromBuilt({
    built,
    ataRentLamports,
    cluster: balances.cluster,
    payer: session.address,
  });
  if (!freezeResult.ok) {
    throw new Error(freezeResult.message);
  }

  const nextFreeze: UsdcSendReviewFreeze = Object.freeze({
    amountAtomic: freezeResult.amountAtomic,
    feeLamports: freezeResult.feeLamports,
    ataRentLamports: freezeResult.ataRentLamports,
    needsDestinationAta: freezeResult.needsDestinationAta,
    mint: freezeResult.mint,
    cluster: freezeResult.cluster,
    recipient: freezeResult.recipient,
    solRequiredLamports: freezeResult.solRequiredLamports,
    payer: freezeResult.payer,
  });

  // Complete consent compare — fee, rent, ATA, SOL-required, payer, cluster,
  // mint, recipient, atomic amount. Drift requires another explicit Send tap.
  if (!usdcSendReviewTermsMatch(args.reviewedFreeze, nextFreeze)) {
    return { status: 'review_updated', freeze: nextFreeze };
  }

  const recheck = validateUsdcSendForm({
    recipient: built.recipient,
    amount: atomicToUsdcString(built.amountAtomic),
    usdcBalanceAtomic: balances.usdcBalanceAtomic,
    solBalanceLamports: balances.solBalanceLamports,
    feeLamports: built.feeLamports,
    ataRentLamports,
    needsDestinationAta,
    fromAddress: session.address,
    mint: built.mint,
    cluster: balances.cluster,
  });
  if (!recheck.ok) {
    throw new Error(recheck.message);
  }
  if (recheck.amountAtomic !== built.amountAtomic) {
    throw new Error('USDC amount no longer matches the reviewed transfer.');
  }
  if (recheck.mint !== built.mint) {
    throw new Error('USDC mint no longer matches the reviewed transfer.');
  }
  if (recheck.recipient.toBase58() !== built.recipient) {
    throw new Error('Recipient no longer matches the reviewed transfer.');
  }

  return { status: 'ok', freeze: nextFreeze };
}

async function classifyAmbiguousUsdcBroadcast(args: {
  connection: Connection;
  localSignature: string;
  blockhash: string;
  lastValidBlockHeight: number;
}): Promise<SubmitUsdcTransferResult> {
  try {
    const status = await args.connection.getSignatureStatus(
      args.localSignature,
      { searchTransactionHistory: true },
    );
    const value = status?.value ?? null;
    if (value) {
      if (value.err != null) {
        throw new UsdcTransferExecutionFailedError(args.localSignature);
      }
      if (
        value.confirmationStatus === 'confirmed' ||
        value.confirmationStatus === 'finalized'
      ) {
        return {
          status: 'submitted',
          signature: args.localSignature,
          confirmation: 'confirmed',
        };
      }
    }
  } catch (error) {
    if (error instanceof UsdcTransferExecutionFailedError) {
      throw error;
    }
    // Status query itself is ambiguous — do not invite a blind retry as failed.
  }
  return {
    status: 'submitted',
    signature: args.localSignature,
    confirmation: 'uncertain',
  };
}

/**
 * Sign + broadcast a built USDC transfer via CorsoSigner.
 *
 * Always: cells → caller-supplied immutable reviewed intent + complete review
 * freeze → live fee/rent/ATA re-check against freeze (drift → review_updated,
 * zero sign) → live tip freshness → fail-closed `notionalSol: null` step-up
 * surface `send` → assertSafeToSign → gated sign (step-up → post-step-up
 * complete freeze re-check hook → final live assert → raw sign with no
 * intervening await) → same frozen message binding → fresh live tip after
 * sign (ignore prior hint) → local signature → final live session/lock check
 * with no intervening await → guarded sendRaw (novel transport / RPC
 * signature mismatch → uncertain unless deterministic preflight) → confirm
 * with `value.err` inspection → confirmed|uncertain|failed.
 * Never atomic raw signAndSend. Clears the signer in `finally`.
 */
export async function submitUsdcTransfer(args: {
  signer: ClearableUsdcSigner;
  connection: Connection;
  built: BuiltUsdcTransfer;
  /**
   * Mandatory immutable review-time intent. Must be Object.freeze'd and
   * supplied by the caller — never re-derived from mutable `built` at submit.
   */
  reviewedIntent: ReviewedUsdcTransferIntent;
  /**
   * Complete consent freeze (fee/rent/ATA/SOL-required/payer/cluster/mint/
   * recipient/amount). Compared to live rent + built terms before any sign,
   * and again after step-up immediately before raw sign.
   */
  reviewedFreeze: UsdcSendReviewFreeze;
  session: CorsoSession;
  balances: UsdcSubmitLiveBalances;
  /** Optional Privy MFA verify — required for privy_embedded when step-up on. */
  verifyPrivyMfa?: () => Promise<boolean>;
  /** Optional resolved step-up policy (avoids config fetch when already prepared). */
  policy?: StepUpPolicy;
  /**
   * Mandatory root-shared live identity cells (same objects as useActiveSigner).
   * Omitted / partial cells fail closed before any sign or broadcast.
   */
  cells: MoneySignerGateCells;
  /** Optional tip height for pre-sign freshness only (never reused post-sign). */
  currentBlockHeight?: number | null;
}): Promise<SubmitUsdcTransferResult> {
  const { connection, built, session, balances } = args;

  try {
    // Runtime reject even from JS/untyped callers that omit or partially pass cells.
    requireMoneySignerGateCells(args.cells);
    const cells = args.cells;

    const payer = requireUsdcPayerAddress(session.address);
    const reviewedIntent = args.reviewedIntent;
    if (
      reviewedIntent == null ||
      typeof reviewedIntent !== 'object' ||
      !Object.isFrozen(reviewedIntent)
    ) {
      throw new Error(
        'Reviewed USDC intent is missing or mutable. Refusing to sign.',
      );
    }
    const reviewedFreeze = args.reviewedFreeze;
    if (
      reviewedFreeze == null ||
      typeof reviewedFreeze !== 'object' ||
      !Object.isFrozen(reviewedFreeze)
    ) {
      throw new Error(
        'Reviewed USDC freeze is missing or mutable. Refusing to sign.',
      );
    }
    assertBuiltMatchesReviewedIntent({ built, intent: reviewedIntent, payer });

    // Bind compiled semantics to the caller-supplied immutable intent BEFORE
    // the first await/sign. Trusted bytes come from this bind only.
    const expectedMessageBytes = assertUsdcCompiledTransferSemantics(
      built.transaction,
      reviewedIntent,
    );

    // Live re-check on the same built instance before any gated sign work.
    // Re-fetched rent + every reviewed term must still match the freeze;
    // otherwise return review_updated (zero sign / zero broadcast).
    const consent = await assertUsdcBuiltStillSafeToSubmit({
      connection,
      built,
      session,
      balances,
      reviewedFreeze,
    });
    if (consent.status === 'review_updated') {
      return consent;
    }

    // USDC has no native SOL notional — fail-closed step-up when policy requires.
    const notionalSol = null;
    const stepUp = {
      session,
      notionalSol,
      surface: 'send' as const,
      verifyPrivyMfa: args.verifyPrivyMfa,
      policy: args.policy,
      // After async step-up, re-fetch/compare the complete freeze immediately
      // before the gate's final live assert + raw sign (no further awaits
      // between that assert and the underlying signer). Drift during MFA
      // must yield typed review_updated with zero raw sign / zero broadcast.
      assertPreRawSignAuthority: async () => {
        const postStepUp = await assertUsdcBuiltStillSafeToSubmit({
          connection,
          built,
          session,
          balances,
          reviewedFreeze,
        });
        if (postStepUp.status === 'review_updated') {
          throw new UsdcSendReviewUpdatedError(postStepUp.freeze);
        }
      },
    };

    const signer = gateMoneySigner(
      args.signer,
      stepUp,
      cells,
      assertMfaForHighValue,
    );

    if (!signer.capabilities.signTransaction) {
      throw new Error('This wallet cannot sign transfers yet.');
    }

    // Pre-sign tip may use an optional caller hint; post-sign always refetches.
    const tip = await resolvePreSignBlockHeight(
      connection,
      args.currentBlockHeight,
    );
    assertUsdcBlockhashFresh({
      tip,
      lastValidBlockHeight: reviewedIntent.lastValidBlockHeight,
    });

    // Re-bind immediately before sign in case the mutable tx drifted after the
    // rent/fee awaits — still compared to the immutable reviewed intent.
    const preSignBytes = assertUsdcCompiledTransferSemantics(
      built.transaction,
      reviewedIntent,
    );
    if (
      preSignBytes.length !== expectedMessageBytes.length ||
      preSignBytes.some((b, i) => b !== expectedMessageBytes[i])
    ) {
      throw new Error(
        'USDC transfer changed after review. Refusing to sign.',
      );
    }

    assertSafeToSign(built.transaction, session, {
      purpose: 'send',
      expectedMessageBytes,
      expectedRequiredSignatures: 1,
      lastValidBlockHeight: reviewedIntent.lastValidBlockHeight,
      currentBlockHeight: tip,
    });

    const signed = await signer.signTransaction(built.transaction);

    assertSignedMatchesMessage({
      signed,
      expectedMessageBytes,
      sessionAddress: session.address,
    });

    // Always fetch a fresh live tip after signing — ignore any earlier hint.
    // Expiry during sign must yield zero broadcast. Tip await must complete
    // BEFORE the final live session/lock check so A→B or lock during this RPC
    // cannot slip past the last authorization gate into sendRawTransaction.
    const tipAfterSign = await fetchLiveBlockHeight(connection);
    assertUsdcBlockhashFresh({
      tip: tipAfterSign,
      lastValidBlockHeight: reviewedIntent.lastValidBlockHeight,
    });

    const localSignature = signatureOfSignedUsdcTransfer(signed);

    // Final pre-broadcast live re-check — no await between this and sendRaw.
    requireMoneySignerLiveForBroadcast({
      stepUpSession: session,
      liveSessionCell: cells.liveSessionCell,
      liveLockCell: cells.liveLockCell,
      rawSigner: { type: signer.type, address: signer.address },
    });

    let rpcSignature: string;
    try {
      rpcSignature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    } catch (error) {
      if (isDeterministicPreflightRejection(error)) {
        throw error;
      }
      return classifyAmbiguousUsdcBroadcast({
        connection,
        localSignature,
        blockhash: reviewedIntent.blockhash,
        lastValidBlockHeight: reviewedIntent.lastValidBlockHeight,
      });
    }

    // RPC string mismatch after an attempted broadcast is uncertain — the
    // locally signed bytes may still land. Retain/query local signature; never
    // throw a definitive failure that would invite a blind retry.
    if (rpcSignature !== localSignature) {
      return classifyAmbiguousUsdcBroadcast({
        connection,
        localSignature,
        blockhash: reviewedIntent.blockhash,
        lastValidBlockHeight: reviewedIntent.lastValidBlockHeight,
      });
    }

    try {
      const confirmation = await connection.confirmTransaction(
        {
          signature: localSignature,
          blockhash: reviewedIntent.blockhash,
          lastValidBlockHeight: reviewedIntent.lastValidBlockHeight,
        },
        'confirmed',
      );
      const executionErr = confirmation?.value?.err ?? null;
      if (executionErr != null) {
        throw new UsdcTransferExecutionFailedError(localSignature);
      }
      return {
        status: 'submitted',
        signature: localSignature,
        confirmation: 'confirmed',
      };
    } catch (error) {
      if (error instanceof UsdcTransferExecutionFailedError) {
        throw error;
      }
      // Broadcast succeeded — confirmation pending/ambiguous is uncertain, not failed.
      return {
        status: 'submitted',
        signature: localSignature,
        confirmation: 'uncertain',
      };
    }
  } catch (error) {
    if (error instanceof UsdcSendReviewUpdatedError) {
      return { status: 'review_updated', freeze: error.freeze };
    }
    throw humanizeUsdcSendError(error);
  } finally {
    try {
      args.signer.clear?.();
    } catch {
      // best-effort wipe; never mask the primary error
    }
  }
}
