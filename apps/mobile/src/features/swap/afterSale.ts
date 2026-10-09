import { copy } from '@/constants/copy';
import type { PayBalance } from './validateSwap';
import { SOL_MINT, formatAtomicAmount } from './tokens';

/** Remainder of a sell. Value comes from this quote's out amount, or it is unpriced. */
export type AfterSale = {
  kind: 'priced' | 'unpriced';
  quantity: string | null;
  value: string | null;
  line: string;
};

function atomic(value: string | null | undefined): bigint | null {
  return typeof value === 'string' && /^\d{1,80}$/.test(value)
    ? BigInt(value)
    : null;
}

function decimalsOk(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 18;
}

/**
 * Quantity is the held amount minus this quote's in amount.
 * When the pay mint is SOL, the same intent's network fee and account rent
 * come off that remainder. If either lamport field is absent, or the two
 * exceed the remainder, the line states no quantity.
 * Value is the remainder times this quote's out amount over its in amount.
 * No other price is read. A missing quote rate says so.
 */
export function presentAfterSale(args: {
  heldAtomic: string | null;
  payMint?: string | null;
  paySymbol: string;
  payDecimals: number;
  receiveSymbol: string;
  receiveDecimals: number;
  inAmount: string | null;
  outAmount: string | null;
  networkFeeLamports?: string | null;
  accountRentLamports?: string | null;
}): AfterSale {
  const unknown: AfterSale = {
    kind: 'unpriced',
    quantity: null,
    value: null,
    line: copy.sellReview.afterUnknown,
  };
  if (
    !args.paySymbol ||
    !args.receiveSymbol ||
    !decimalsOk(args.payDecimals) ||
    !decimalsOk(args.receiveDecimals)
  ) {
    return unknown;
  }
  const held = atomic(args.heldAtomic);
  const sold = atomic(args.inAmount);
  if (held == null || sold == null || sold <= 0n || held < sold) return unknown;
  let remaining = held - sold;
  if (args.payMint === SOL_MINT) {
    const network = atomic(args.networkFeeLamports);
    const rent = atomic(args.accountRentLamports);
    if (network == null || rent == null || remaining < network + rent) {
      return unknown;
    }
    remaining -= network + rent;
  }
  let quantity: string;
  try {
    quantity = formatAtomicAmount(remaining.toString(), args.payDecimals);
  } catch {
    return unknown;
  }
  const aboutQuantity = args.payMint === SOL_MINT;
  const proceeds = atomic(args.outAmount);
  if (proceeds == null || proceeds <= 0n) {
    return {
      kind: 'unpriced',
      quantity,
      value: null,
      line: copy.sellReview.afterUnpriced(
        quantity,
        args.paySymbol,
        aboutQuantity,
      ),
    };
  }
  const valueAtomic = (remaining * proceeds) / sold;
  let value: string;
  try {
    value = formatAtomicAmount(valueAtomic.toString(), args.receiveDecimals);
  } catch {
    return {
      kind: 'unpriced',
      quantity,
      value: null,
      line: copy.sellReview.afterUnpriced(
        quantity,
        args.paySymbol,
        aboutQuantity,
      ),
    };
  }
  return {
    kind: 'priced',
    quantity,
    value,
    line: copy.sellReview.afterPriced(
      quantity,
      args.paySymbol,
      value,
      args.receiveSymbol,
      aboutQuantity,
    ),
  };
}

export function reviewHeldAtomic(payBalance: PayBalance): string | null {
  return payBalance.known ? payBalance.atomic.toString() : null;
}

/** Buy reviews have no remainder. A sell with no quote in amount stays quiet. */
export function reviewAfterSale(args: {
  riskLeg: 'pay' | 'receive';
  heldAtomic: string | null;
  payMint?: string | null;
  paySymbol: string;
  payDecimals: number;
  receiveSymbol: string;
  receiveDecimals: number;
  inAmount: string | null;
  outAmount: string | null;
  networkFeeLamports?: string | null;
  accountRentLamports?: string | null;
}): string | null {
  if (args.riskLeg !== 'pay' || args.inAmount == null) return null;
  return presentAfterSale(args).line;
}
