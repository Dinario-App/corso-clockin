import { copy } from '@/constants/copy';
import { MAJOR_ASSETS, type MajorAsset } from '@/src/features/balances/majors';
import type { PriceSnapshot } from '@/src/features/balances/priceSnapshot';
import { formatObservationClock } from '@/src/features/home/asOfPresentation';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import { presentFearGreedChip } from '@/src/features/swap/fearGreed/presentFearGreedChip';
import type { FearGreedResponse } from '@/src/features/swap/fearGreed/types';

export function isTodayMajor(asset: MajorAsset): boolean {
  return (
    asset.symbol === 'SOL' || asset.symbol === 'cbBTC' || asset.symbol === 'ETH'
  );
}

/** What the prices read has produced so far. */
export type TodayPricesRead =
  | { phase: 'unknown' }
  /** FLAG_PRICES is off. No request was sent. */
  | { phase: 'off' }
  /** Flag on, first read in flight: the card's box is reserved. */
  | { phase: 'pending' }
  | {
      phase: 'settled';
      /** `null` when the first read failed. */
      snapshot: PriceSnapshot | null;
      /** A later read failed and `snapshot` is the last good one, held. */
      refreshFailed: boolean;
    };

/**
 * mint → the 24h change in percent, as vitals served it.
 * A missing key has not been read; `null` is a read that produced no number
 * (503, network, schema, or a vitals `changePct24h: null`).
 */
export type TodayChangeRead = Readonly<Record<string, number | null>>;

export type TodayChange = {
  /** Unsigned, one decimal: `2.1%`. The direction glyph carries the sign. */
  text: string;
  direction: 'up' | 'down' | null;
};

export type TodayRow = {
  key: string;
  mint: string;
  symbol: string;
  price: string;
  change: TodayChange | null;
};

export type TodayCardModel =
  | { kind: 'absent' }
  | { kind: 'loading'; label: string; askLabel: string; skeletonRows: number }
  | {
      kind: 'loaded' | 'stale';
      label: string;
      asOf: string;
      rows: TodayRow[];
      askLabel: string;
      /** `Crypto mood · Neutral 52`, or `null` → no chip (read missed). */
      mood: string | null;
    }
  | { kind: 'unavailable'; label: string; line: string };

export function formatTodayChange(
  value: number | null | undefined,
): TodayChange | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : null;
  return { text: `${Math.abs(rounded).toFixed(1)}%`, direction };
}

/**
 * What the mood read has produced. `null` covers not-read-yet and every miss:
 * both mean no chip.
 */
export type TodayMoodRead = FearGreedResponse | null;

/** The chip text, or `null`. Loaded and stale only; the caller decides that. */
export function presentTodayMood(
  mood: TodayMoodRead,
  nowMs: number,
): string | null {
  const chip = presentFearGreedChip({ snapshot: mood, nowMs });
  return chip ? copy.todayCard.mood(chip.classification, chip.value) : null;
}

export function presentTodayCard(args: {
  prices: TodayPricesRead;
  changes: TodayChangeRead;
  nowMs: number;
  /** Omitted → no chip. */
  mood?: TodayMoodRead;
}): TodayCardModel {
  const label = copy.todayCard.label;
  const askLabel = copy.todayCard.askAboutToday;
  const { prices } = args;

  if (prices.phase === 'unknown' || prices.phase === 'off') {
    return { kind: 'absent' };
  }
  if (prices.phase === 'pending') {
    return {
      kind: 'loading',
      label,
      askLabel,
      skeletonRows: MAJOR_ASSETS.filter(isTodayMajor).length,
    };
  }

  const unavailable: TodayCardModel = {
    kind: 'unavailable',
    label,
    line: copy.diyLists.pricesUnavailable,
  };
  const snapshot = prices.snapshot;
  // A server-side kill switch answers with a disabled snapshot: that is the
  // flag being off, not a failed read, so the card is absent, not "didn't load".
  if (snapshot?.status === 'disabled') return { kind: 'absent' };
  if (!snapshot) return unavailable;

  const rows: TodayRow[] = [];
  let oldestAsOfMs = Number.POSITIVE_INFINITY;
  let overAge = false;
  for (const asset of MAJOR_ASSETS.filter(isTodayMajor)) {
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
      change: formatTodayChange(args.changes[asset.mint]),
    });
  }
  if (rows.length === 0) return unavailable;

  const anyChange = rows.some((row) => row.change !== null);
  const clock = formatObservationClock(oldestAsOfMs, '12h');
  const asOf =
    clock == null
      ? null
      : anyChange
        ? copy.moving.context(clock)
        : copy.diyLists.asOf(clock);
  if (asOf == null) return unavailable;

  return {
    kind: prices.refreshFailed || overAge ? 'stale' : 'loaded',
    label,
    asOf,
    rows,
    askLabel,
    mood: presentTodayMood(args.mood ?? null, args.nowMs),
  };
}
