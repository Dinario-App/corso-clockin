/**
 * Pure Send semantic binder: decode the compiled v0 message and prove it
 * matches an immutable reviewed USDC intent before any sign/broadcast.
 */
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import {
  isBoundedUsdcMint,
  USDC_DECIMALS,
} from '@/src/features/balances/usdcConstants';
import { associatedTokenAddress } from '@/src/features/security/ataAddress';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@/src/features/security/swapProgramAllowlist';
import type { BuiltUsdcTransfer } from '@/src/features/send/buildUsdcTransfer';

export type ReviewedUsdcTransferIntent = Readonly<{
  payer: string;
  recipient: string;
  mint: string;
  amountAtomic: bigint;
  sourceAta: string;
  destinationAta: string;
  createdDestinationAta: boolean;
  blockhash: string;
  lastValidBlockHeight: number;
  decimals: number;
}>;

const TRANSFER_CHECKED_DISC = 12;
const CREATE_IDEMPOTENT_ATA_DISC = 1;
const CREATE_ATA_ACCOUNT_COUNT = 6;
const TRANSFER_CHECKED_ACCOUNT_COUNT = 4;

function readU64LE(data: Uint8Array, offset: number): bigint {
  return new DataView(
    data.buffer,
    data.byteOffset + offset,
    8,
  ).getBigUint64(0, true);
}

function accountAt(
  keys: ReturnType<VersionedTransaction['message']['getAccountKeys']>,
  index: number,
  label: string,
): string {
  const key = keys.get(index);
  if (!key) {
    throw new Error(`USDC transfer ${label} account is missing. Refusing to sign.`);
  }
  return key.toBase58();
}

export function deriveCanonicalUsdcAtas(args: {
  payer: string;
  recipient: string;
  mint: string;
}): { sourceAta: string; destinationAta: string } {
  if (!isBoundedUsdcMint(args.mint)) {
    throw new Error('USDC mint is not allowed for this network.');
  }
  try {
    // eslint-disable-next-line no-new
    new PublicKey(args.payer);
    // eslint-disable-next-line no-new
    new PublicKey(args.recipient);
  } catch {
    throw new Error('USDC transfer owner/recipient keys are invalid. Refusing to sign.');
  }
  return {
    sourceAta: associatedTokenAddress({
      mint: args.mint,
      owner: args.payer,
      tokenProgramId: TOKEN_PROGRAM_ID,
    }),
    destinationAta: associatedTokenAddress({
      mint: args.mint,
      owner: args.recipient,
      tokenProgramId: TOKEN_PROGRAM_ID,
    }),
  };
}

export function freezeReviewedUsdcTransferIntent(args: {
  built: BuiltUsdcTransfer;
  payer: string;
}): ReviewedUsdcTransferIntent {
  const { sourceAta, destinationAta } = deriveCanonicalUsdcAtas({
    payer: args.payer,
    recipient: args.built.recipient,
    mint: args.built.mint,
  });
  if (
    args.built.sourceAta !== sourceAta ||
    args.built.destinationAta !== destinationAta
  ) {
    throw new Error(
      'USDC transfer ATA metadata does not match owner/recipient mint. Refusing to sign.',
    );
  }
  return Object.freeze({
    payer: args.payer,
    recipient: args.built.recipient,
    mint: args.built.mint,
    amountAtomic: args.built.amountAtomic,
    sourceAta,
    destinationAta,
    createdDestinationAta: args.built.createdDestinationAta,
    blockhash: args.built.blockhash,
    lastValidBlockHeight: args.built.lastValidBlockHeight,
    decimals: USDC_DECIMALS,
  });
}

/**
 * Decode compiled USDC send semantics and return a cloned message snapshot.
 * Fail closed on lookup tables, unexpected programs/order, account mismatch,
 * amount/decimals drift, extra accounts, or any extra instruction.
 */
export function assertUsdcCompiledTransferSemantics(
  transaction: VersionedTransaction,
  intent: ReviewedUsdcTransferIntent,
): Uint8Array {
  if (!(transaction instanceof VersionedTransaction)) {
    throw new Error('Expected a VersionedTransaction');
  }
  if (intent.decimals !== USDC_DECIMALS) {
    throw new Error('USDC transfer decimals must be 6. Refusing to sign.');
  }
  if (intent.amountAtomic <= 0n) {
    throw new Error('USDC amount must be positive. Refusing to sign.');
  }

  const canonical = deriveCanonicalUsdcAtas({
    payer: intent.payer,
    recipient: intent.recipient,
    mint: intent.mint,
  });
  if (
    intent.sourceAta !== canonical.sourceAta ||
    intent.destinationAta !== canonical.destinationAta
  ) {
    throw new Error(
      'Reviewed USDC ATA fields do not match owner/recipient mint. Refusing to sign.',
    );
  }

  const lookups = transaction.message.addressTableLookups;
  if (lookups.length > 0) {
    throw new Error(
      'USDC transfer must not use address lookup tables. Refusing to sign.',
    );
  }

  let accountKeys;
  try {
    accountKeys = transaction.message.getAccountKeys();
  } catch {
    throw new Error('USDC transfer account keys are malformed. Refusing to sign.');
  }

  const staticKeys = transaction.message.staticAccountKeys;
  if (staticKeys.length === 0) {
    throw new Error('USDC transfer has no accounts. Refusing to sign.');
  }

  const feePayer = staticKeys[0]!.toBase58();
  if (feePayer !== intent.payer) {
    throw new Error('Fee payer does not match reviewed USDC intent.');
  }

  const required = transaction.message.header.numRequiredSignatures;
  if (required !== 1) {
    throw new Error('Unexpected required signers for USDC transfer.');
  }
  if (accountAt(accountKeys, 0, 'primary signer') !== intent.payer) {
    throw new Error('Session address must be the primary signer');
  }

  if (transaction.message.recentBlockhash !== intent.blockhash) {
    throw new Error('USDC transfer blockhash does not match reviewed intent.');
  }

  const ixs = transaction.message.compiledInstructions;
  const expectedCount = intent.createdDestinationAta ? 2 : 1;
  if (ixs.length !== expectedCount) {
    throw new Error(
      'USDC transfer instruction count does not match reviewed intent.',
    );
  }

  let transferIxIndex = 0;
  if (intent.createdDestinationAta) {
    const createIx = ixs[0]!;
    const createProgram = accountAt(
      accountKeys,
      createIx.programIdIndex,
      'create-ATA program',
    );
    if (createProgram !== ASSOCIATED_TOKEN_PROGRAM_ID) {
      throw new Error(
        'USDC create-ATA program is not allowlisted. Refusing to sign.',
      );
    }
    if (createIx.accountKeyIndexes.length !== CREATE_ATA_ACCOUNT_COUNT) {
      throw new Error(
        'USDC create-ATA account count does not match reviewed shape. Refusing to sign.',
      );
    }
    if (
      accountAt(accountKeys, createIx.accountKeyIndexes[0]!, 'create payer') !==
        intent.payer ||
      accountAt(accountKeys, createIx.accountKeyIndexes[1]!, 'create ATA') !==
        canonical.destinationAta ||
      accountAt(accountKeys, createIx.accountKeyIndexes[2]!, 'create owner') !==
        intent.recipient ||
      accountAt(accountKeys, createIx.accountKeyIndexes[3]!, 'create mint') !==
        intent.mint ||
      accountAt(accountKeys, createIx.accountKeyIndexes[4]!, 'system program') !==
        SYSTEM_PROGRAM_ID ||
      accountAt(accountKeys, createIx.accountKeyIndexes[5]!, 'token program') !==
        TOKEN_PROGRAM_ID
    ) {
      throw new Error(
        'USDC create-ATA accounts do not match reviewed intent. Refusing to sign.',
      );
    }
    if (
      createIx.data.length !== 1 ||
      createIx.data[0] !== CREATE_IDEMPOTENT_ATA_DISC
    ) {
      throw new Error(
        'USDC create-ATA instruction data is unexpected. Refusing to sign.',
      );
    }
    transferIxIndex = 1;
  }

  const transferIx = ixs[transferIxIndex]!;
  const transferProgram = accountAt(
    accountKeys,
    transferIx.programIdIndex,
    'transfer program',
  );
  if (transferProgram !== TOKEN_PROGRAM_ID) {
    throw new Error(
      'USDC transfer program is not allowlisted. Refusing to sign.',
    );
  }
  if (transferIx.accountKeyIndexes.length !== TRANSFER_CHECKED_ACCOUNT_COUNT) {
    throw new Error(
      'USDC transferChecked account count does not match reviewed shape. Refusing to sign.',
    );
  }
  if (
    accountAt(accountKeys, transferIx.accountKeyIndexes[0]!, 'source ATA') !==
      canonical.sourceAta ||
    accountAt(accountKeys, transferIx.accountKeyIndexes[1]!, 'mint') !==
      intent.mint ||
    accountAt(
      accountKeys,
      transferIx.accountKeyIndexes[2]!,
      'destination ATA',
    ) !== canonical.destinationAta ||
    accountAt(accountKeys, transferIx.accountKeyIndexes[3]!, 'authority') !==
      intent.payer
  ) {
    throw new Error(
      'USDC transferChecked accounts do not match reviewed intent. Refusing to sign.',
    );
  }

  const data = transferIx.data;
  if (data.length !== 10 || data[0] !== TRANSFER_CHECKED_DISC) {
    throw new Error(
      'USDC transferChecked instruction data is unexpected. Refusing to sign.',
    );
  }
  const amount = readU64LE(data, 1);
  const decimals = data[9]!;
  if (amount !== intent.amountAtomic || decimals !== intent.decimals) {
    throw new Error(
      'USDC transferChecked amount/decimals do not match reviewed intent.',
    );
  }

  // Exact allowlist/order already enforced by expectedCount + program checks.
  for (const ix of ixs) {
    const programId = accountAt(accountKeys, ix.programIdIndex, 'program');
    if (
      programId !== TOKEN_PROGRAM_ID &&
      programId !== ASSOCIATED_TOKEN_PROGRAM_ID
    ) {
      throw new Error(
        'Disallowed program ID in USDC send. Refusing to sign.',
      );
    }
  }

  // Clone so later mutation of the VersionedTransaction message cannot widen
  // the trusted pre-sign / post-sign comparison set.
  return Uint8Array.from(transaction.message.serialize());
}

/** Resolve fee payer as base58; reject invalid keys. */
export function requireUsdcPayerAddress(address: string | null | undefined): string {
  if (!address) {
    throw new Error('Cannot send without a session address');
  }
  try {
    // eslint-disable-next-line no-new
    new PublicKey(address);
  } catch {
    throw new Error('Session address is not a valid public key');
  }
  return address;
}
