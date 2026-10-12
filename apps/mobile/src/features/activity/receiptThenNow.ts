import { copy } from '@/constants/copy';
import { formatClosedBarStamp } from '@/src/features/home/asOfPresentation';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import type { ReceiptSignedIntent } from './receiptPresentation';
import type { ReviewUnitPrice } from './receiptSnapshotStore';

export type PricePoint = { readonly price: string; readonly asOfMs: number };

export type PriceRead =
  | { readonly state: 'loading' }
  | ({ readonly state: 'ready' } & PricePoint)
  | { readonly state: 'unavailable' };

export type ThenNowRow = {
  readonly key: 'then' | 'now';
  readonly label: string;
  readonly value: string;
};

export type ThenNowView = {
  readonly heading: string;
  readonly symbol: string;
  readonly rows: readonly [ThenNowRow, ThenNowRow];
};

/**
 * The token the trade was about: what a buy received, what a sell paid.
 * `null` when the intent is missing or that side is the cluster's dollar
 * stable (a peg has no then-vs-now worth printing).
 */
export function thenNowToken(
  intent: Pick<ReceiptSignedIntent, 'side' | 'pay' | 'receive'> | null,
  stableMints: ReadonlySet<string>,
): { mint: string; symbol: string } | null {
  if (!intent) return null;
  const token = intent.side === 'sell' ? intent.pay : intent.receive;
  if (!token?.mint || stableMints.has(token.mint)) return null;
  return { mint: token.mint, symbol: token.symbol };
}

/** Source 1 for "then": the frozen Review price, only for this mint. */
export function reviewThen(
  review: ReviewUnitPrice | null | undefined,
  mint: string,
): PricePoint | null {
  if (!review || review.mint !== mint) return null;
  return formatPriceUsd(review.usd)
    ? { price: review.usd, asOfMs: review.asOfMs }
    : null;
}

function rowValue(read: PriceRead, unavailable: string, nowMs: number): string {
  if (read.state === 'loading') return copy.homeBook.placeholder;
  if (read.state === 'unavailable') return unavailable;
  const price = formatPriceUsd(read.price);
  const stamp = formatClosedBarStamp(read.asOfMs, nowMs);
  return price && stamp ? `${price} · ${stamp}` : unavailable;
}

export function presentThenNow(args: {
  symbol: string;
  thenRead: PriceRead;
  nowRead: PriceRead;
  nowMs: number;
}): ThenNowView {
  const t = copy.receipt;
  return {
    heading: t.thenNowHeading,
    symbol: args.symbol,
    rows: [
      {
        key: 'then',
        label: t.priceThen,
        value: rowValue(args.thenRead, t.priceThenUnavailable, args.nowMs),
      },
      {
        key: 'now',
        label: t.priceNow,
        value: rowValue(args.nowRead, t.priceNowUnavailable, args.nowMs),
      },
    ],
  };
}
