import { copy } from '@/constants/copy';
import {
  formatPriceUsd,
  formatWindowDelta,
} from '@/src/ui/format/numberCraft';
import { withAlpha } from '@/src/ui/controls/colorAlpha';
import { accent } from '@/src/ui/tokens';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';
import {
  BIRDEYE_PRICE_HISTORY_SOURCE,
  GECKOTERMINAL_PRICE_HISTORY_SOURCE,
} from '@/src/features/prices/fetchPriceHistory';
import { formatObservationClock } from '@/src/features/home/asOfPresentation';
import {
  formatChartAmountChange,
  formatChartPercentChange,
  formatChartPriceUsd,
  resolveChartPriceBoundsText,
} from './chartPriceFormat';

export { PRICE_CHART_RANGES, type PriceChartRange } from '@/src/features/prices/usePriceChartSeries';
import type { PriceChartRange } from '@/src/features/prices/usePriceChartSeries';

export type PriceChartPoint = {
  timestampMs: number;
  priceUsd: string;
};

type RenderPoint = PriceChartPoint & { x: number; y: number; price: number };

export type PriceChartStubPresentation = {
  kind: 'stub';
  currentPriceText: string | null;
  message: string;
  attribution: string | null;
};

export const PRICE_CHART_LINE_WIDTH = 2;
export const PRICE_CHART_GLOW_ALPHA = 0.08;

export const PRICE_CHART_PLOT_HEIGHTS = {
  seed: 52,
  compact: 116,
  detail: 118,
} as const;
export const PRICE_CHART_GROWN_SIZE = 'grown';
export type PriceChartSize =
  | keyof typeof PRICE_CHART_PLOT_HEIGHTS
  | typeof PRICE_CHART_GROWN_SIZE;
/** The plot for a caller that sets neither `size` nor `compact` (Money, the chart route). */
export const PRICE_CHART_DEFAULT_PLOT_HEIGHT = 164;
export const PRICE_CHART_SEED_HEAD_HEIGHT = 22;
export const PRICE_CHART_SEED_GAP = 8;
/** The line's vertical inset; the 52 dp seed takes a tighter one so its line isn't 16 dp tall. */
const PLOT_Y_PAD = 18;
const SEED_PLOT_Y_PAD = 6;

export type PriceChartFace = {
  plotHeight: number;
  /** The seed face: one head row and the line. No foot, no range control. */
  seed: boolean;
  condensed: boolean;
};

export function resolvePriceChartFace(input: {
  size?: unknown;
  compact?: unknown;
  condensed?: unknown;
}): PriceChartFace {
  const size =
    input.size === 'seed' || input.size === 'compact' || input.size === 'detail'
      ? input.size
      : null;
  const grown = input.size === PRICE_CHART_GROWN_SIZE;
  const seed = size === 'seed' || grown;
  return {
    plotHeight: grown
      ? PRICE_CHART_PLOT_HEIGHTS.compact
      : size
      ? PRICE_CHART_PLOT_HEIGHTS[size]
      : input.compact === true
        ? PRICE_CHART_PLOT_HEIGHTS.compact
        : PRICE_CHART_DEFAULT_PLOT_HEIGHT,
    seed,
    condensed: seed || input.condensed === true,
  };
}

export type PriceChartReadyPresentation = {
  kind: 'chart';
  direction: 'up' | 'down' | 'flat';
  lineColor: string;
  lineWidth: number;
  glowTopColor: string;
  showGrid: false;
  linePath: string;
  lineLength: number;
  fillPath: string;
  baselineY: number;
  points: RenderPoint[];
  terminalDot: { x: number; y: number };
  priceScale: { min: number; max: number; yAtMax: number; yAtMin: number };
  currentPriceText: string;
  deltaText: string;
  deltaTone: string;
  minLabel: string;
  maxLabel: string;
  scrub: null | {
    index: number;
    x: number;
    y: number;
    valueText: string;
    timestampMs: number;
    /** The dollar change from the window's start, condensed face only. */
    deltaText: string | null;
    deltaTone: string | null;
  };
  attribution: string | null;
};

export type PriceChartPresentation =
  | PriceChartStubPresentation
  | PriceChartReadyPresentation;

export type PriceChartHistory = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  series: readonly PriceChartPoint[] | null;
  source?: string | null;
  coverageKind?: 'top_indexed_pool' | 'token_aggregated' | null;
  poolAddress?: string | null;
  liquidityUsd?: string | null;
  volume24hUsd?: string | null;
  marketDataAsOfMs?: number | null;
};

export type PriceChartHeldHistory = {
  mint: string;
  range: PriceChartRange;
  history: PriceChartHistory;
};

export function resolvePriceChartSeriesKey(
  history: PriceChartHistory,
): string {
  return history.status === 'ready'
    ? history.series
        ?.map((point) => `${point.timestampMs}:${point.priceUsd}`)
        .join('|') ?? ''
    : '';
}

export function resolvePriceChartHeldHistoryUpdate(input: {
  held: PriceChartHeldHistory | null;
  mint: string | null;
  range: PriceChartRange;
  history: PriceChartHistory;
  seriesKey: string;
}): PriceChartHeldHistory | null {
  if (input.mint == null) return null;
  if (input.history.status === 'loading') {
    return input.held?.mint === input.mint ? input.held : null;
  }
  if (
    input.history.status !== 'ready' ||
    input.history.series == null
  ) return null;
  if (
    input.held?.mint === input.mint &&
    input.held.range === input.range &&
    input.held.history.status === input.history.status &&
    resolvePriceChartSeriesKey(input.held.history) === input.seriesKey
  ) return input.held;
  return {
    mint: input.mint,
    range: input.range,
    history: input.history,
  };
}

export const PRICE_CHART_HELD_LINE_OPACITY = 0.4;
export const PRICE_CHART_RANGE_CROSSFADE_MS = 220;
export const PRICE_CHART_FIRST_DRAW_MS = 300;

export function resolvePriceChartHistoryDisplay(input: {
  mint: string | null;
  range: PriceChartRange;
  history: PriceChartHistory;
  held: PriceChartHeldHistory | null;
}): {
  history: PriceChartHistory;
  held: boolean;
  lineOpacity: number;
} {
  if (
    input.history.status === 'loading' &&
    input.mint != null &&
    input.held?.mint === input.mint &&
    input.held.history.status === 'ready'
  ) {
    return {
      history: input.held.history,
      held: true,
      lineOpacity: PRICE_CHART_HELD_LINE_OPACITY,
    };
  }
  return { history: input.history, held: false, lineOpacity: 1 };
}

export function resolvePriceChartContextLabel(
  range: PriceChartRange,
  scrub: null | { timestampMs: number },
): string {
  if (scrub == null) return range;
  return formatObservationClock(scrub.timestampMs) ?? range;
}

export function resolvePriceChartTransition(input: {
  hasPreviousSeries: boolean;
  reduceMotion: boolean;
}): { kind: 'draw' | 'crossfade' | 'jump'; durationMs: number } {
  if (input.reduceMotion) return { kind: 'jump', durationMs: 0 };
  if (input.hasPreviousSeries) {
    return { kind: 'crossfade', durationMs: PRICE_CHART_RANGE_CROSSFADE_MS };
  }
  return { kind: 'draw', durationMs: PRICE_CHART_FIRST_DRAW_MS };
}

export type PriceHistoryMarketDepthRow = {
  label: string;
  value: string;
  attribution: string;
};

function stub(
  currentPriceUsd: string | null,
  condensed: boolean,
  message = copy.chart.historyUnavailable,
): PriceChartStubPresentation {
  const priceText = condensed ? formatChartPriceUsd : formatPriceUsd;
  return {
    kind: 'stub',
    currentPriceText: currentPriceUsd ? priceText(currentPriceUsd) : null,
    message,
    attribution: null,
  };
}

function priceTone(direction: 'up' | 'down' | 'flat'): string {
  return resolveDeltaInk(direction);
}

function normalizeSeries(
  series: readonly PriceChartPoint[] | null,
): Array<PriceChartPoint & { price: number }> | null {
  if (series == null || series.length < 2 || series.length > 512) return null;
  const normalized: Array<PriceChartPoint & { price: number }> = [];
  let priorTimestamp = -1;
  for (const point of series) {
    const priceText = formatPriceUsd(point.priceUsd);
    const price = Number(point.priceUsd);
    if (
      priceText == null ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(point.timestampMs) ||
      point.timestampMs <= priorTimestamp
    ) {
      return null;
    }
    priorTimestamp = point.timestampMs;
    normalized.push({ ...point, price });
  }
  return normalized;
}

function pathFromPoints(points: readonly RenderPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function lengthFromPoints(points: readonly RenderPoint[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const prior = points[index - 1]!;
    const point = points[index]!;
    length += Math.hypot(point.x - prior.x, point.y - prior.y);
  }
  return length;
}

export function resolvePriceChartPresentation(input: {
  series: readonly PriceChartPoint[] | null;
  currentPriceUsd?: string | null;
  width: number;
  height: number;
  scrubIndex: number | null;
  condensed?: boolean;
}): PriceChartPresentation {
  const condensed = input.condensed === true;
  const priceText = condensed ? formatChartPriceUsd : formatPriceUsd;
  const normalized = normalizeSeries(input.series);
  if (
    normalized == null ||
    !Number.isFinite(input.width) ||
    input.width <= 32 ||
    !Number.isFinite(input.height) ||
    input.height <= 48
  ) {
    return stub(input.currentPriceUsd ?? null, condensed);
  }

  const min = Math.min(...normalized.map((point) => point.price));
  const max = Math.max(...normalized.map((point) => point.price));
  const minPoint = normalized.reduce((lowest, point) =>
    point.price < lowest.price ? point : lowest,
  );
  const maxPoint = normalized.reduce((highest, point) =>
    point.price > highest.price ? point : highest,
  );
  const priceSpan = max - min || Math.max(max * 0.01, 0.000_001);
  const xPad = 8;
  const yPad = input.height < PRICE_CHART_PLOT_HEIGHTS.compact ? SEED_PLOT_Y_PAD : PLOT_Y_PAD;
  const drawableWidth = input.width - xPad * 2;
  const drawableHeight = input.height - yPad * 2;
  const first = normalized[0]!;
  const last = normalized.at(-1)!;
  const timeSpan = last.timestampMs - first.timestampMs;
  const points: RenderPoint[] = normalized.map((point) => ({
    ...point,
    x: xPad + (drawableWidth * (point.timestampMs - first.timestampMs)) / timeSpan,
    y: yPad + ((max - point.price) / priceSpan) * drawableHeight,
  }));
  const direction = last.price > first.price
    ? 'up'
    : last.price < first.price
      ? 'down'
      : 'flat';
  const lineColor = accent.chartLine;
  const lineWidth = PRICE_CHART_LINE_WIDTH;
  const glowTopColor = withAlpha(accent.chartLine, PRICE_CHART_GLOW_ALPHA);
  const delta = condensed
    ? formatChartPercentChange(first.priceUsd, last.priceUsd)
    : formatWindowDelta(first.priceUsd, last.priceUsd);
  if (delta == null) return stub(input.currentPriceUsd ?? null, condensed);
  const deltaTone = priceTone(delta.direction);
  const bounds = condensed
    ? resolveChartPriceBoundsText(minPoint.priceUsd, maxPoint.priceUsd)!
    : {
        lowText: formatPriceUsd(minPoint.priceUsd)!,
        highText: formatPriceUsd(maxPoint.priceUsd)!,
      };
  const baselineY = yPad + ((max - first.price) / priceSpan) * drawableHeight;
  const linePath = pathFromPoints(points);
  const lineLength = lengthFromPoints(points);
  const lastPoint = points.at(-1)!;
  const extentY = Math.max(...points.map((point) => point.y));
  const fillPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${extentY.toFixed(2)} L ${points[0]!.x.toFixed(2)} ${extentY.toFixed(2)} Z`;
  const scrubIndex =
    input.scrubIndex != null &&
    Number.isInteger(input.scrubIndex) &&
    input.scrubIndex >= 0 &&
    input.scrubIndex < points.length
      ? input.scrubIndex
      : null;
  const scrubPoint = scrubIndex == null ? null : points[scrubIndex]!;
  const scrubChange = condensed && scrubPoint != null
    ? formatChartAmountChange(first.priceUsd, scrubPoint.priceUsd)
    : null;

  return {
    kind: 'chart',
    direction,
    lineColor,
    lineWidth,
    glowTopColor,
    showGrid: false,
    linePath,
    lineLength,
    fillPath,
    baselineY,
    points,
    terminalDot: { x: lastPoint.x, y: lastPoint.y },
    priceScale: {
      min,
      max,
      yAtMax: yPad,
      yAtMin: yPad + drawableHeight,
    },
    currentPriceText: priceText(last.priceUsd)!,
    deltaText: delta.text,
    deltaTone,
    minLabel: bounds.lowText,
    maxLabel: bounds.highText,
    scrub: scrubPoint == null
      ? null
      : {
          index: scrubIndex!,
          x: scrubPoint.x,
          y: scrubPoint.y,
          valueText: priceText(scrubPoint.priceUsd)!,
          timestampMs: scrubPoint.timestampMs,
          deltaText: scrubChange?.text ?? null,
          deltaTone: scrubChange ? priceTone(scrubChange.direction) : null,
        },
    attribution: null,
  };
}

export function resolvePriceHistoryAttribution(
  history: PriceChartHistory,
): string | null {
  if (
    history.status !== 'ready' ||
    history.series == null ||
    history.series.length < 2
  ) return null;
  const clock = formatObservationClock(history.series.at(-1)!.timestampMs);
  if (clock == null) return null;
  const known =
    history.source === GECKOTERMINAL_PRICE_HISTORY_SOURCE ||
    history.source === BIRDEYE_PRICE_HISTORY_SOURCE;
  if (!known) return null;
  const attribution = copy.chart.attribution(clock);
  if (
    history.source === BIRDEYE_PRICE_HISTORY_SOURCE &&
    history.coverageKind === 'token_aggregated'
  ) {
    return `${attribution}\n${copy.chart.coverageTokenAggregated}`;
  }
  if (
    history.source !== GECKOTERMINAL_PRICE_HISTORY_SOURCE ||
    history.coverageKind !== 'top_indexed_pool' ||
    typeof history.poolAddress !== 'string' ||
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(history.poolAddress)
  ) {
    return attribution;
  }
  return `${attribution}\n${copy.chart.coverageTopIndexedPool} · ${copy.chart.poolTail(history.poolAddress.slice(-4))}`;
}

export function resolvePriceHistoryMarketDepth(
  history: PriceChartHistory,
): PriceHistoryMarketDepthRow[] {
  if (
    history.status !== 'ready' ||
    history.source !== GECKOTERMINAL_PRICE_HISTORY_SOURCE ||
    history.marketDataAsOfMs == null
  ) {
    return [];
  }
  const clock = formatObservationClock(history.marketDataAsOfMs);
  if (clock == null) return [];
  const attribution = copy.chart.attribution(clock);
  const rows: PriceHistoryMarketDepthRow[] = [];
  for (const [label, raw] of [
    [copy.chart.poolLiquidity, history.liquidityUsd],
    [copy.chart.poolVolume24h, history.volume24hUsd],
  ] as const) {
    if (raw == null) continue;
    const value = formatPriceUsd(raw);
    if (value != null) rows.push({ label, value, attribution });
  }
  return rows;
}

/**
 * The only history-to-drawing boundary used by PriceChart. Spot price remains
 * stub chrome; a drawn series must come from a provider-ready history state.
 */
export function resolvePriceChartHistoryPresentation(input: {
  history: PriceChartHistory;
  currentPriceUsd?: string | null;
  width: number;
  height: number;
  scrubIndex: number | null;
  condensed?: boolean;
}): PriceChartPresentation {
  const presentation = resolvePriceChartPresentation({
    series: input.history.status === 'ready' ? input.history.series : null,
    currentPriceUsd: input.currentPriceUsd,
    width: input.width,
    height: input.height,
    scrubIndex: input.scrubIndex,
    condensed: input.condensed,
  });
  return {
    ...presentation,
    ...(presentation.kind === 'stub' && input.history.status === 'loading'
      ? { message: copy.chart.historyLoading }
      : null),
    attribution: resolvePriceHistoryAttribution(input.history),
  };
}
