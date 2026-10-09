import { PublicKey } from '@solana/web3.js';
import {
  isBoundedUsdcMint,
  usdcMintForCluster,
} from '@/src/features/balances/usdcConstants';
import {
  SPL_TOKEN_U64_MAX,
  usdcAmountToAtomic,
} from '@/src/features/send/parseUsdcAmount';
import { parseRecipientAddress } from '@/src/features/send/validateSend';

export type UsdcSendValidation =
  | { ok: true; amountAtomic: bigint; recipient: PublicKey; mint: string }
  | {
      ok: false;
      field: 'recipient' | 'amount' | 'balance' | 'fee' | 'mint';
      message: string;
    };

export type UsdcSendCluster = 'devnet' | 'mainnet-beta';

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validate a bounded native USDC send form.
 * Mint must match cluster; SOL covers network fee + optional destination ATA rent.
 * No platform/Corso fee on Send.
 */
export function validateUsdcSendForm(args: {
  recipient: string;
  amount: string;
  /** Atomic USDC balance; null = unknown → fail closed. */
  usdcBalanceAtomic: bigint | null;
  /** Sender SOL lamports for fee + optional ATA rent; null = unknown → fail closed. */
  solBalanceLamports: number | null;
  /** Estimated network fee for the full message (transfer ± create-ATA). */
  feeLamports: number | null;
  /**
   * Rent-exempt lamports for destination ATA when create is required.
   * Pass 0 when destination ATA already exists.
   */
  ataRentLamports: number;
  needsDestinationAta: boolean;
  fromAddress: string | null;
  mint: string;
  cluster: UsdcSendCluster;
}): UsdcSendValidation {
  const expectedMint = usdcMintForCluster(args.cluster);
  if (
    !isBoundedUsdcMint(args.mint) ||
    args.mint !== expectedMint
  ) {
    return {
      ok: false,
      field: 'mint',
      message: 'USDC mint is not allowed for this network.',
    };
  }

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

  const amountAtomic = usdcAmountToAtomic(args.amount);
  if (amountAtomic === null) {
    return {
      ok: false,
      field: 'amount',
      message: 'Enter a valid USDC amount.',
    };
  }

  if (args.usdcBalanceAtomic === null) {
    return {
      ok: false,
      field: 'balance',
      message: "Couldn't confirm your USDC balance. Pull back and try again.",
    };
  }

  if (
    args.usdcBalanceAtomic < 0n ||
    args.usdcBalanceAtomic > SPL_TOKEN_U64_MAX
  ) {
    return {
      ok: false,
      field: 'balance',
      message: "Couldn't confirm your USDC balance. Pull back and try again.",
    };
  }

  if (amountAtomic > args.usdcBalanceAtomic) {
    return {
      ok: false,
      field: 'balance',
      message: 'Not enough USDC',
    };
  }

  if (args.solBalanceLamports === null) {
    return {
      ok: false,
      field: 'fee',
      message: "Couldn't confirm your SOL balance for network fees.",
    };
  }

  if (!isNonNegativeSafeInteger(args.solBalanceLamports)) {
    return {
      ok: false,
      field: 'fee',
      message: "Couldn't confirm your SOL balance for network fees.",
    };
  }

  if (args.feeLamports === null) {
    return {
      ok: false,
      field: 'fee',
      message: "Couldn't confirm the network fee. Pull back and try again.",
    };
  }

  if (!isNonNegativeSafeInteger(args.feeLamports)) {
    return {
      ok: false,
      field: 'fee',
      message: "Couldn't confirm the network fee. Pull back and try again.",
    };
  }

  if (!isNonNegativeSafeInteger(args.ataRentLamports)) {
    return {
      ok: false,
      field: 'fee',
      message: "Couldn't confirm token account rent. Pull back and try again.",
    };
  }

  if (args.needsDestinationAta && args.ataRentLamports <= 0) {
    return {
      ok: false,
      field: 'fee',
      message:
        "Couldn't confirm token account rent. Pull back and try again.",
    };
  }

  const fee = args.feeLamports;
  const ataRent = args.needsDestinationAta ? args.ataRentLamports : 0;
  const solNeeded = fee + ataRent;
  if (!Number.isSafeInteger(solNeeded)) {
    return {
      ok: false,
      field: 'fee',
      message: "Couldn't confirm the SOL reserve required for this send.",
    };
  }
  if (solNeeded > args.solBalanceLamports) {
    return {
      ok: false,
      field: 'fee',
      message: args.needsDestinationAta
        ? 'Not enough SOL for network fees and token account rent'
        : 'Not enough SOL to cover network fees',
    };
  }

  return {
    ok: true,
    amountAtomic,
    recipient,
    mint: expectedMint,
  };
}

/** Max sendable USDC atomic units given a known balance (no fee in USDC). */
export function maxSendableUsdcAtomic(usdcBalanceAtomic: bigint): bigint {
  return usdcBalanceAtomic > 0n && usdcBalanceAtomic <= SPL_TOKEN_U64_MAX
    ? usdcBalanceAtomic
    : 0n;
}
