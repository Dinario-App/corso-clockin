import { copy } from '@/constants/copy';
import { MAJOR_ASSETS, type MajorAsset } from '@/src/features/balances/majors';
import type { PriceSnapshot } from '@/src/features/balances/priceSnapshot';
import {
  formatObservationClock,
  resolveMovingContext,
} from '@/src/features/home/asOfPresentation';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import type { WhyRead } from '@/src/features/why/useWhy';
import {
  oneLineFor,
  type WhyLineView,
} from '@/src/features/why/whyPresentation';

export function isMarketsMajor(asset: MajorAsset): boolean {
  return (
    asset.symbol === 'SOL' || asset.symbol === 'cbBTC' || asset.symbol === 'ETH'
  );
}

/** The majors' mints, in the locked order: what Moving asks the why engine for. */
export const MARKETS_MAJOR_MINTS: readonly string[] = MAJOR_ASSETS.filter(
  isMarketsMajor,
).map((asset) => asset.mint);

/** What the prices read has produced so far. */
export type MarketsPricesRead =
  | { phase: 'pending' }
  /** FLAG_PRICES is off (config said so, or config did not answer). */
  | { phase: 'off' }
  | {
      phase: 'settled';
      /** `null` when the read failed. */
      snapshot: PriceSnapshot | null;
      /** A later read failed and `snapshot` is the last good one, held. */
      refreshFailed: boolean;
    };

/**
 * mint → the 24h change in percent, as vitals served it. A missing key has not
 * been read; `null` is a read that produced no number.
 */
export type MarketsChangeRead = Readonly<Record<string, number | null>>;

export type MarketsChange = {
  /** Unsigned, one decimal: `2.1%`. The direction glyph carries the sign. */
  text: string;
  direction: 'up' | 'down' | null;
};

export type MarketsMovingRow = {
  key: string;
  mint: string;
  symbol: string;
  price: string;
  /** `null` → the row shows its price only. */
  change: MarketsChange | null;
  why: WhyLineView | null;
};

export type MarketsMovingModel =
  | { kind: 'loading'; label: string; skeletonRows: number }
  | {
      kind: 'loaded' | 'stale';
      label: string;
      asOf: string;
      rows: MarketsMovingRow[];
    }
  | { kind: 'unavailable'; label: string; line: string };

export function formatMarketsChange(
  value: number | null | undefined,
): MarketsChange | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : null;
  return { text: `${Math.abs(rounded).toFixed(1)}%`, direction };
}

export function presentMarketsMoving(args: {
  prices: MarketsPricesRead;
  changes: MarketsChangeRead;
  nowMs: number;
  why?: WhyRead;
}): MarketsMovingModel {
  const whyResponse =
    args.why && args.why !== 'off' && args.why !== 'loading' ? args.why : null;
  const label = copy.moving.label;
  const { prices } = args;

  if (prices.phase === 'pending') {
    return {
      kind: 'loading',
      label,
      skeletonRows: MAJOR_ASSETS.filter(isMarketsMajor).length,
    };
  }

  const unavailable: MarketsMovingModel = {
    kind: 'unavailable',
    label,
    line: copy.diyLists.pricesUnavailable,
  };
  // Markets has nothing else to show: with prices off the section still says
  // one honest line rather than leaving a titled, empty screen.
  if (prices.phase === 'off') return unavailable;
  const snapshot = prices.snapshot;
  if (!snapshot || snapshot.status === 'disabled') return unavailable;

  const rows: MarketsMovingRow[] = [];
  let oldestAsOfMs = Number.POSITIVE_INFINITY;
  let overAge = false;
  for (const asset of MAJOR_ASSETS.filter(isMarketsMajor)) {
    const line = snapshot.lines.find((entry) => entry.mint === asset.mint);
    const quote = line?.status === 'ok' ? line.quote : null;
    if (!quote) continue;
    const price = formatPriceUsd(quote.price);
    if (price == null) continue;
    if (!Number.isFinite(quote.asOfMs) || quote.asOfMs < 0) continue;
    oldestAsOfMs = Math.min(oldestAsOfMs, quote.asOfMs);
    if (args.nowMs - quote.asOfMs > quote.maxAgeMs) overAge = true;
    rows.push({
      key: asset.symbol,
      mint: asset.mint,
      symbol: asset.symbol,
      price,
      change: formatMarketsChange(args.changes[asset.mint]),
      why: oneLineFor(whyResponse, asset.mint),
    });
  }
  if (rows.length === 0) return unavailable;

  // One as-of for the section: the OLDEST shown price, so no row is newer
  // than the line claims. It names the 24h column only when a 24h is shown.
  const anyChange = rows.some((row) => row.change !== null);
  const asOf = anyChange
    ? resolveMovingContext(oldestAsOfMs)
    : (() => {
        const clock = formatObservationClock(oldestAsOfMs);
        return clock == null ? null : copy.diyLists.asOf(clock);
      })();
  if (asOf == null) return unavailable;

  return {
    kind: prices.refreshFailed || overAge ? 'stale' : 'loaded',
    label,
    asOf,
    rows,
  };
}

/** Each row opens the asset screen, the same door the Book's majors use. */
export function marketsRowHref(mint: string) {
  return { pathname: '/asset/[mint]', params: { mint } } as const;
}
