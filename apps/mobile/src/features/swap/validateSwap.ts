import {
  amountToAtomic,
  SOL_MINT,
  type SwapToken,
} from '@/src/features/swap/tokens';
import { copy } from '@/constants/copy';
import { SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS } from '@corso/wallet';

export type SwapFormValidation =
  | { ok: true; atomicIn: string }
  | { ok: false; message: string; cta: string };

export type PayBalanceUnknownReason =
  | 'sol_unavailable'
  | 'usdc_unavailable'
  | 'holdings_loading'
  | 'holdings_unavailable'
  | 'wallet_type_unsupported'
  | 'token_2022_not_sellable'
  | 'holding_not_recognised'
  | 'pay_decimals_unread'
  | 'pay_decimals_mismatch';

export type PayBalance =
  | Readonly<{ known: true; atomic: bigint }>
  | Readonly<{ known: false; reason: PayBalanceUnknownReason }>;

/** One user-facing line per refusal cause. Never blank — a blank is a shrug. */
export function unknownPayBalanceMessage(
  reason: PayBalanceUnknownReason,
): string {
  return copy.swap.payBalanceUnavailable[reason];
}

export function validateSwapForm(args: {
  payToken: SwapToken;
  receiveToken: SwapToken;
  amount: string;
  payBalance: PayBalance;
}): SwapFormValidation {
  if (args.payToken.mint === args.receiveToken.mint) {
    return {
      ok: false,
      message: 'Choose two different tokens.',
      cta: 'Enter amount',
    };
  }

  const atomicIn = amountToAtomic(args.amount, args.payToken.decimals);
  if (!atomicIn) {
    return { ok: false, message: '', cta: 'Enter amount' };
  }

  if (!args.payBalance.known) {
    return {
      ok: false,
      message: unknownPayBalanceMessage(args.payBalance.reason),
      cta: copy.swap.payBalanceUnavailableCta,
    };
  }

  const needed = BigInt(atomicIn);
  if (needed > args.payBalance.atomic) {
    return {
      ok: false,
      message: `Insufficient ${args.payToken.symbol}`,
      cta: copy.swap.notEnough(args.payToken.symbol),
    };
  }

  if (args.payToken.mint === SOL_MINT) {
    const reserve = BigInt(DEFAULT_SOL_FEE_RESERVE_LAMPORTS);
    if (needed + reserve > args.payBalance.atomic) {
      return {
        ok: false,
        message: 'Leave a little SOL for network fees and token account rent.',
        cta: copy.swap.notEnough(args.payToken.symbol),
      };
    }
  }

  return { ok: true, atomicIn };
}

/**
 * Reserve for signature + priority + first-time USDC ATA rent on mainnet.
 * Jupiter Meta quotes often need ~4.1M lamports rent alone.
 */
export const DEFAULT_SOL_FEE_RESERVE_LAMPORTS = Number(
  SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS,
);

export function maxPayAtomic(args: {
  payToken: SwapToken;
  balanceAtomic: bigint;
  /** Lamports to reserve when paying SOL. */
  solFeeReserveLamports?: number;
}): bigint {
  if (args.balanceAtomic <= 0n) return 0n;
  if (args.payToken.mint !== SOL_MINT) return args.balanceAtomic;
  const reserve = BigInt(
    args.solFeeReserveLamports ?? DEFAULT_SOL_FEE_RESERVE_LAMPORTS,
  );
  const max = args.balanceAtomic - reserve;
  return max > 0n ? max : 0n;
}
