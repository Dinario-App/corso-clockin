import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from '@solana/web3.js';
import {
  isBoundedUsdcMint,
  USDC_DECIMALS,
  usdcMintForCluster,
} from '@/src/features/balances/usdcConstants';
import { associatedTokenAddress } from '@/src/features/security/ataAddress';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@/src/features/security/swapProgramAllowlist';
import { SPL_TOKEN_U64_MAX } from '@/src/features/send/parseUsdcAmount';
import type { UsdcSendCluster } from '@/src/features/send/validateUsdcSend';

/** Classic SPL token account size (rent-exempt lookup). */
export const SPL_TOKEN_ACCOUNT_SIZE = 165;

export type BuiltUsdcTransfer = {
  transaction: VersionedTransaction;
  feeLamports: number | null;
  blockhash: string;
  lastValidBlockHeight: number;
  amountAtomic: bigint;
  mint: string;
  recipient: string;
  sourceAta: string;
  destinationAta: string;
  createdDestinationAta: boolean;
};

function u64LE(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

export function encodeTransferCheckedData(
  amountAtomic: bigint,
  decimals: number = USDC_DECIMALS,
): Buffer {
  if (amountAtomic < 0n) {
    throw new Error('USDC amount must be non-negative');
  }
  if (amountAtomic > SPL_TOKEN_U64_MAX) {
    throw new Error('USDC amount must fit in u64');
  }
  if (decimals !== USDC_DECIMALS) {
    throw new Error('USDC transferChecked decimals must be 6');
  }
  const data = new Uint8Array(10);
  data[0] = 12;
  data.set(u64LE(amountAtomic), 1);
  data[9] = decimals;
  return Buffer.from(data);
}

/**
 * Hand-rolled Token Program transferChecked (ix 12).
 * Accounts: source, mint, destination, authority.
 */
export function buildTransferCheckedInstruction(args: {
  sourceAta: PublicKey;
  mint: PublicKey;
  destinationAta: PublicKey;
  owner: PublicKey;
  amountAtomic: bigint;
  decimals?: number;
}): TransactionInstruction {
  const decimals = args.decimals ?? USDC_DECIMALS;
  return new TransactionInstruction({
    programId: new PublicKey(TOKEN_PROGRAM_ID),
    keys: [
      { pubkey: args.sourceAta, isSigner: false, isWritable: true },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: args.destinationAta, isSigner: false, isWritable: true },
      { pubkey: args.owner, isSigner: true, isWritable: false },
    ],
    data: encodeTransferCheckedData(args.amountAtomic, decimals),
  });
}

/**
 * Associated Token Program idempotent-create instruction (discriminator 1).
 * Uses only the approved ATA program + Token Program + System Program.
 */
export function buildCreateAssociatedTokenAccountInstruction(args: {
  payer: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
  ata: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID),
    keys: [
      { pubkey: args.payer, isSigner: true, isWritable: true },
      { pubkey: args.ata, isSigner: false, isWritable: true },
      { pubkey: args.owner, isSigner: false, isWritable: false },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(TOKEN_PROGRAM_ID), isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}

function readTokenAccount(args: {
  info: NonNullable<Awaited<ReturnType<Connection['getAccountInfo']>>>;
  expectedMint: PublicKey;
  expectedTokenOwner: PublicKey;
  label: 'Source' | 'Destination';
}): { amount: bigint } {
  if (args.info.owner.toBase58() !== TOKEN_PROGRAM_ID) {
    throw new Error(`${args.label} USDC token account has unexpected program owner`);
  }
  if (args.info.data.length !== SPL_TOKEN_ACCOUNT_SIZE) {
    throw new Error(`${args.label} USDC token account has invalid data length`);
  }

  const mint = new PublicKey(args.info.data.subarray(0, 32));
  if (!mint.equals(args.expectedMint)) {
    throw new Error(`${args.label} USDC token account has unexpected mint`);
  }

  const tokenOwner = new PublicKey(args.info.data.subarray(32, 64));
  if (!tokenOwner.equals(args.expectedTokenOwner)) {
    throw new Error(`${args.label} USDC token account has unexpected token owner`);
  }

  if (args.info.data[108] !== 1) {
    throw new Error(`${args.label} USDC token account is not initialized`);
  }

  const data = args.info.data;
  const amount = new DataView(
    data.buffer,
    data.byteOffset + 64,
    8,
  ).getBigUint64(0, true);
  return { amount };
}

function assertBoundedClusterMint(
  mint: string,
  cluster: UsdcSendCluster,
): string {
  const expected = usdcMintForCluster(cluster);
  if (!isBoundedUsdcMint(mint) || mint !== expected) {
    throw new Error('USDC mint is not allowed for this network');
  }
  return expected;
}

/**
 * Build a v0 USDC transferChecked (+ optional destination ATA create).
 * Network fee / ATA rent only — no Corso/platform fee on Send.
 * Fail-closed on hostile mint, missing source ATA, or amount ≤ 0.
 */
export async function buildUsdcTransfer(args: {
  connection: Connection;
  fromAddress: string;
  recipient: PublicKey;
  amountAtomic: bigint;
  mint: string;
  cluster: UsdcSendCluster;
}): Promise<BuiltUsdcTransfer> {
  if (args.amountAtomic <= 0n) {
    throw new Error('USDC amount must be positive');
  }
  if (args.amountAtomic > SPL_TOKEN_U64_MAX) {
    throw new Error('USDC amount must fit in u64');
  }

  const mint = assertBoundedClusterMint(args.mint, args.cluster);
  const from = new PublicKey(args.fromAddress);
  const mintKey = new PublicKey(mint);
  if (!PublicKey.isOnCurve(from.toBytes())) {
    throw new Error('Sender address must be on-curve');
  }
  if (!PublicKey.isOnCurve(args.recipient.toBytes())) {
    throw new Error('Recipient address must be on-curve');
  }
  if (from.equals(args.recipient)) {
    throw new Error("You can't send to your own address");
  }

  const sourceAtaStr = associatedTokenAddress({
    mint,
    owner: args.fromAddress,
    tokenProgramId: TOKEN_PROGRAM_ID,
  });
  const destinationAtaStr = associatedTokenAddress({
    mint,
    owner: args.recipient.toBase58(),
    tokenProgramId: TOKEN_PROGRAM_ID,
  });
  const sourceAta = new PublicKey(sourceAtaStr);
  const destinationAta = new PublicKey(destinationAtaStr);

  const sourceInfo = await args.connection.getAccountInfo(
    sourceAta,
    'confirmed',
  );
  if (!sourceInfo) {
    throw new Error('Source USDC token account is missing');
  }
  const sourceAccount = readTokenAccount({
    info: sourceInfo,
    expectedMint: mintKey,
    expectedTokenOwner: from,
    label: 'Source',
  });
  if (sourceAccount.amount < args.amountAtomic) {
    throw new Error('Source USDC token account has insufficient balance');
  }

  const destInfo = await args.connection.getAccountInfo(
    destinationAta,
    'confirmed',
  );
  const createdDestinationAta = destInfo === null;
  if (destInfo) {
    readTokenAccount({
      info: destInfo,
      expectedMint: mintKey,
      expectedTokenOwner: args.recipient,
      label: 'Destination',
    });
  }

  const { blockhash, lastValidBlockHeight } =
    await args.connection.getLatestBlockhash('confirmed');

  const instructions: TransactionInstruction[] = [];
  if (createdDestinationAta) {
    instructions.push(
      buildCreateAssociatedTokenAccountInstruction({
        payer: from,
        owner: args.recipient,
        mint: mintKey,
        ata: destinationAta,
      }),
    );
  }
  instructions.push(
    buildTransferCheckedInstruction({
      sourceAta,
      mint: mintKey,
      destinationAta,
      owner: from,
      amountAtomic: args.amountAtomic,
      decimals: USDC_DECIMALS,
    }),
  );

  // Fail closed: only Token + Associated Token program IDs in this message.
  for (const ix of instructions) {
    const programId = ix.programId.toBase58();
    if (
      programId !== TOKEN_PROGRAM_ID &&
      programId !== ASSOCIATED_TOKEN_PROGRAM_ID
    ) {
      throw new Error(`Disallowed program ID in USDC send: ${programId}`);
    }
  }

  const message = new TransactionMessage({
    payerKey: from,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  let feeLamports: number | null = null;
  try {
    const fee = await args.connection.getFeeForMessage(message, 'confirmed');
    if (
      typeof fee?.value === 'number' &&
      Number.isSafeInteger(fee.value) &&
      fee.value >= 5_000 * message.header.numRequiredSignatures
    ) {
      feeLamports = fee.value;
    }
  } catch {
    feeLamports = null;
  }

  return {
    transaction: new VersionedTransaction(message),
    feeLamports,
    blockhash,
    lastValidBlockHeight,
    amountAtomic: args.amountAtomic,
    mint,
    recipient: args.recipient.toBase58(),
    sourceAta: sourceAtaStr,
    destinationAta: destinationAtaStr,
    createdDestinationAta,
  };
}

/** Fee estimate for the full USDC send message (transfer ± create-ATA). */
export async function estimateUsdcTransferFeeLamports(args: {
  connection: Connection;
  fromAddress: string;
  recipient: PublicKey;
  amountAtomic: bigint;
  mint: string;
  cluster: UsdcSendCluster;
}): Promise<number | null> {
  const built = await buildUsdcTransfer(args);
  return built.feeLamports;
}
