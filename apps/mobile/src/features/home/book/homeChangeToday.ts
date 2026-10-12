import type { PriceQuoteMap } from '@/src/features/balances/computeFiatTotal';

export type ChangeTodayLine = {
  readonly mint: string;
  /** Cents now, or `null` when this line has no price. */
  readonly cents: bigint | null;
  /** The Book's Cash section: dollar stables, counted as 0%. */
  readonly stable: boolean;
};

export type ChangeToday =
  | {
      readonly kind: 'change';
      /** `null` when the change rounds to $0.00. */
      readonly direction: 'up' | 'down' | null;
      /** Absolute change in cents, rounded half away from zero. */
      readonly changeCents: bigint;
      /** Absolute percent, one decimal place, e.g. `1.7`. */
      readonly pct: string;
    }
  | { readonly kind: 'unavailable' };

export function computeChangeToday(
  lines: readonly ChangeTodayLine[],
  quotes: PriceQuoteMap | undefined,
  nowMs: number,
): ChangeToday | null {
  if (lines.length === 0) return null;
  if (lines.some((line) => line.cents === null)) return { kind: 'unavailable' };
  const total = lines.reduce((acc, line) => acc + (line.cents as bigint), 0n);
  if (total <= 0n) return null;

  let nowSum = 0;
  let beforeSum = 0;
  for (const line of lines) {
    const cents = Number(line.cents as bigint);
    nowSum += cents;
    if (line.stable) {
      beforeSum += cents;
      continue;
    }
    const pct = freshChangePct(quotes?.[line.mint], nowMs);
    if (pct === null) {
      // ≥1% of the book: cents × 100 ≥ total.
      if ((line.cents as bigint) * 100n >= total) return { kind: 'unavailable' };
      beforeSum += cents;
      continue;
    }
    beforeSum += cents / (1 + pct / 100);
  }
  if (!(beforeSum > 0) || !Number.isFinite(beforeSum)) {
    return { kind: 'unavailable' };
  }

  const delta = nowSum - beforeSum;
  const rounded = Math.round(Math.abs(delta));
  const pct = (Math.abs(delta) / beforeSum) * 100;
  return {
    kind: 'change',
    direction: rounded === 0 ? null : delta > 0 ? 'up' : 'down',
    changeCents: BigInt(rounded),
    pct: pct.toFixed(1),
  };
}

/** A finite 24h change on a quote still inside its own freshness budget. */
function freshChangePct(
  quote: PriceQuoteMap[string],
  nowMs: number,
): number | null {
  if (!quote) return null;
  const pct = quote.changePct24h;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= -100) {
    return null;
  }
  if (!Number.isFinite(quote.asOfMs) || !Number.isFinite(quote.maxAgeMs)) {
    return null;
  }
  if (nowMs - quote.asOfMs > quote.maxAgeMs) return null;
  return pct;
}
