import { PublicKey } from '@solana/web3.js';
import { solAmountToLamports } from '@/src/features/send/parseSolAmount';

export type SendValidation =
  | { ok: true; lamports: number; recipient: PublicKey }
  | { ok: false; field: 'recipient' | 'amount' | 'balance'; message: string };

/** Validate recipient base58 address (on-curve ed25519). */
export function parseRecipientAddress(raw: string): PublicKey | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const key = new PublicKey(trimmed);
    if (!PublicKey.isOnCurve(key.toBytes())) return null;
    return key;
  } catch {
    return null;
  }
}

export function validateSendForm(args: {
  recipient: string;
  amount: string;
  balanceLamports: number | null;
  feeLamports: number | null;
  fromAddress: string | null;
}): SendValidation {
  const recipient = parseRecipientAddress(args.recipient);
  if (!recipient) {
    return {
      ok: false,
      field: 'recipient',
      message: 'Enter a valid Solana address.',
    };
  }

  if (args.fromAddress && recipient.toBase58() === args.fromAddress) {
    return {
      ok: false,
      field: 'recipient',
      message: "You can't send to your own address.",
    };
  }

  const lamports = solAmountToLamports(args.amount);
  if (lamports === null) {
    return {
      ok: false,
      field: 'amount',
      message: 'Enter a valid SOL amount.',
    };
  }

  if (args.balanceLamports === null) {
    return {
      ok: false,
      field: 'balance',
      message: "Couldn't confirm your balance. Pull back and try again.",
    };
  }

  const fee = args.feeLamports ?? 5_000;
  const total = lamports + fee;
  if (total > args.balanceLamports) {
    return {
      ok: false,
      field: 'balance',
      message: 'Not enough SOL to cover network fees',
    };
  }

  return { ok: true, lamports, recipient };
}

/** Max sendable lamports after reserving network fee. */
export function maxSendableLamports(
  balanceLamports: number,
  feeLamports: number | null,
): number {
  const fee = feeLamports ?? 5_000;
  return Math.max(0, balanceLamports - fee);
}
