import { PRICE_HISTORY_RANGES, type PriceHistoryRange } from './fetchPriceHistory';
import { PRICE_LINE_INTERVAL_MS, type PriceLineInterval } from './fetchPriceLine';
import { usePriceHistory, type PriceHistoryState } from './usePriceHistory';
import { usePriceLine } from './usePriceLine';

export const PRICE_CHART_RANGES = ['15s', ...PRICE_HISTORY_RANGES] as const;
export type PriceChartRange = (typeof PRICE_CHART_RANGES)[number];

export const PRICE_CHART_VISIBLE_RANGE_COUNT = 4;
export const PRICE_CHART_DEFAULT_VISIBLE_RANGES = ['15s', '1H', '1D', '1W'] as const;

export const PRICE_CHART_RANGE_ROW_SM_WIDTH = 203;
export const PRICE_CHART_HEADER_GAP = 10;
export const PRICE_CHART_CARD_PAD = 16;
export const PRICE_CHART_SCREEN_GUTTER = 16;

export const PRICE_CHART_WINDOW_LABELS: Record<PriceChartRange, string> = {
  '15s': 'Past hour',
  '1H': 'Past hour',
  '1D': 'Past 24 hours',
  '1W': 'Past week',
  '1M': 'Past month',
  ALL: 'All time',
};

export function isPriceLineRange(range: PriceChartRange): range is PriceLineInterval {
  return range === '15s';
}

export function normalizePriceChartRanges(
  ranges: readonly unknown[] | null | undefined,
): readonly PriceChartRange[] {
  if (!Array.isArray(ranges)) return PRICE_CHART_RANGES;
  return PRICE_CHART_RANGES.filter((range) => ranges.includes(range));
}

/**
 * The range a chart draws: the reader's choice while it is shown, else 1D
 * when shown, else the first shown. A one-entry list pins the window; with
 * nothing shown the choice stands.
 */
export function resolvePriceChartActiveRange(
  chosen: PriceChartRange,
  shown: readonly PriceChartRange[],
): PriceChartRange {
  if (shown.length === 0 || shown.includes(chosen)) return chosen;
  return shown.includes('1D') ? '1D' : shown[0]!;
}

export function coerceVisibleChartRanges(
  ranges: readonly unknown[],
): PriceChartRange[] {
  const ordered = PRICE_CHART_RANGES.filter((range) => ranges.includes(range));
  return ordered.length === PRICE_CHART_VISIBLE_RANGE_COUNT
    ? ordered
    : [...PRICE_CHART_DEFAULT_VISIBLE_RANGES];
}

/**
 * Menu toggle: uncheck one of the four, then check another. A fifth is
 * refused until one is unchecked; the set cannot drop below three.
 */
export function applyChartRangeMenuToggle(
  visible: readonly PriceChartRange[],
  range: PriceChartRange,
): PriceChartRange[] {
  if (!(PRICE_CHART_RANGES as readonly string[]).includes(range)) {
    return PRICE_CHART_RANGES.filter((item) => visible.includes(item));
  }
  const current = PRICE_CHART_RANGES.filter((item) => visible.includes(item));
  if (current.includes(range)) {
    if (current.length <= PRICE_CHART_VISIBLE_RANGE_COUNT - 1) return current;
    return current.filter((item) => item !== range);
  }
  if (current.length >= PRICE_CHART_VISIBLE_RANGE_COUNT) return current;
  return PRICE_CHART_RANGES.filter((item) => item === range || current.includes(item));
}

/**
 * The pills a chart draws. Unset `ranges` (Swap, Money, default) follow the
 * saved four. An explicit list still pins, including a one-entry window.
 */
export function resolveShownPriceChartRanges(
  ranges: readonly unknown[] | null | undefined,
  preferred: readonly PriceChartRange[],
): readonly PriceChartRange[] {
  if (!Array.isArray(ranges)) return coerceVisibleChartRanges(preferred);
  return normalizePriceChartRanges(ranges);
}

export function priceChartCardContentWidth(phoneWidth: number): number {
  return phoneWidth - PRICE_CHART_SCREEN_GUTTER * 2 - PRICE_CHART_CARD_PAD * 2;
}

function estimateHeaderTextWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.52) + 4;
}

export function resolvePriceChartWindowLabelVisible(input: {
  contentWidth: number;
  windowLabel: string;
  percentText: string;
  rangeControlWidth?: number;
}): boolean {
  if (input.windowLabel.length === 0) return false;
  const rangeWidth = input.rangeControlWidth ?? PRICE_CHART_RANGE_ROW_SM_WIDTH;
  const left = Math.max(
    estimateHeaderTextWidth(input.windowLabel, 15),
    estimateHeaderTextWidth(input.percentText, 17),
  );
  return left + PRICE_CHART_HEADER_GAP + rangeWidth <= input.contentWidth;
}

/** Bar width of a chart range, for painting a live tick onto its last bar; `null` for coarse ranges. */
export function priceChartRangeIntervalMs(range: PriceChartRange): number | null {
  return isPriceLineRange(range) ? PRICE_LINE_INTERVAL_MS[range] : null;
}

export function usePriceChartSeries(args: {
  mint: string | null | undefined;
  range: PriceChartRange;
}): PriceHistoryState {
  const line = isPriceLineRange(args.range);
  const history = usePriceHistory({
    mint: line ? null : args.mint,
    range: line ? '1D' : (args.range as PriceHistoryRange),
  });
  const fast = usePriceLine({ mint: line ? args.mint : null, interval: '15s' });
  return line ? fast : history;
}
