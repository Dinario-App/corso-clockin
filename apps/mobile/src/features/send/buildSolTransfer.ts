import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from '@solana/web3.js';

export type BuiltSolTransfer = {
  transaction: VersionedTransaction;
  feeLamports: number | null;
  blockhash: string;
  lastValidBlockHeight: number;
  lamports: number;
  recipient: string;
};

/**
 * Build a v0 SystemProgram.transfer. Network fee only — no Corso/platform fee.
 */
export async function buildSolTransfer(args: {
  connection: Connection;
  fromAddress: string;
  recipient: PublicKey;
  lamports: number;
}): Promise<BuiltSolTransfer> {
  const from = new PublicKey(args.fromAddress);
  const { blockhash, lastValidBlockHeight } =
    await args.connection.getLatestBlockhash('confirmed');

  const instruction = SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: args.recipient,
    lamports: args.lamports,
  });

  const message = new TransactionMessage({
    payerKey: from,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message();

  let feeLamports: number | null = null;
  try {
    const fee = await args.connection.getFeeForMessage(message, 'confirmed');
    if (typeof fee?.value === 'number' && Number.isSafeInteger(fee.value) && fee.value >= 5_000 * message.header.numRequiredSignatures) {
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
    lamports: args.lamports,
    recipient: args.recipient.toBase58(),
  };
}

/** Fee estimate without constructing a full send intent (compose screen). */
export async function estimateTransferFeeLamports(args: {
  connection: Connection;
  fromAddress: string;
  recipient: PublicKey;
  lamports: number;
}): Promise<number | null> {
  const built = await buildSolTransfer(args);
  return built.feeLamports;
}
