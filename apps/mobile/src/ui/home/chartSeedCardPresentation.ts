import type { HomeAssemblyChart } from '@/src/features/home/homeAssembly';
import {
  resolvePriceChartActiveRange,
  resolveShownPriceChartRanges,
} from '@/src/features/prices/usePriceChartSeries';
import {
  PRICE_CHART_GROWN_SIZE,
  PRICE_CHART_PLOT_HEIGHTS,
  PRICE_CHART_SEED_GAP,
  PRICE_CHART_SEED_HEAD_HEIGHT,
  resolvePriceChartHistoryPresentation,
  type PriceChartHistory,
  type PriceChartRange,
  type PriceChartReadyPresentation,
  type PriceChartSize,
} from '@/src/ui/charts/priceChartPresentation';
import { STRUCTURE_ROW } from '@/src/ui/charts/structureRowPresentation';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import { kitType, spacing } from '@/src/ui/tokens';
import {
  resolveVerdictAssembly,
  resolveVerdictCtaArmDelayMs,
} from '@/src/ui/verdict/verdictCardPresentation';
import {
  GEN_UI_EASING,
  SEED_AFTER_CTA_ARM_MS,
  SEED_FOLD_BACK_MS,
  SEED_FOOT_FADE_MS,
  SEED_GROW_AFTER_ENTRY_MS,
  SEED_GROW_MS,
  SEED_MIN_PEEK_DP,
  SEED_RISE_MS,
  SEED_RISE_PX,
} from './genUiMotion';

export const CHART_SEED_RANGE: PriceChartRange = '1D';

export const CHART_SEED_DETAILS_RANGE_PARAM = 'range' as const;

export const CHART_SEED_CARD = Object.freeze({
  gapAbove: 10,
  paddingVertical: 14,
  paddingHorizontal: 16,
  footGap: 8,
  footLineHeight: 17,
  detailsChevronSize: 16,
  detailsGap: 2,
});

export type ChartSeedSize = 'seed' | 'grown' | 'mini';

const PLOT: Readonly<Record<ChartSeedSize, number>> = Object.freeze({
  seed: PRICE_CHART_PLOT_HEIGHTS.seed,
  grown: PRICE_CHART_PLOT_HEIGHTS.compact,
  mini: PRICE_CHART_PLOT_HEIGHTS.compact,
});

export function resolveChartSeedMiniRegionHeight(
  measuredHeight?: number | null,
): number {
  if (
    typeof measuredHeight === 'number' &&
    Number.isFinite(measuredHeight) &&
    measuredHeight > 0
  ) {
    return measuredHeight;
  }
  const gap = spacing.xs;
  const captionBox = kitType.caption + gap;
  return (
    kitType.chartPrice +
    gap +
    MIN_TAP_TARGET_PT +
    gap +
    PRICE_CHART_PLOT_HEIGHTS.compact +
    gap +
    captionBox +
    gap +
    captionBox * 2
  );
}

/**
 * Unmeasured compact+condensed chrome. Prefer
 * `resolveChartSeedMiniRegionHeight(measured)`.
 */
export const CHART_SEED_MINI_REGION_HEIGHT = resolveChartSeedMiniRegionHeight();

export function resolveChartSeedExtrasHeight(
  unfolded: boolean,
  extras?: {
    measured?: number | null;
    structureShown?: boolean;
  },
): number {
  if (!unfolded) return 0;
  const measured = extras?.measured;
  if (
    typeof measured === 'number' &&
    Number.isFinite(measured) &&
    measured > 0
  ) {
    return measured;
  }
  if (extras?.structureShown === false) return STRUCTURE_ROW.height;
  return STRUCTURE_ROW.faceGap + STRUCTURE_ROW.height + STRUCTURE_ROW.height;
}

export function resolveChartSeedExtrasContentHeight(
  prev: number | null,
  next: number,
): number | null {
  if (!Number.isFinite(next) || next <= 0) return prev;
  return prev === next ? prev : next;
}

export function resolveGenUiBezierProgress(unitTime: number): number {
  if (unitTime <= 0) return 0;
  if (unitTime >= 1) return 1;
  return GEN_UI_BEZIER(unitTime);
}

export function resolveChartSeedExtrasEasedHeight(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  if (elapsedMs <= 0) return from;
  return (
    from +
    (to - from) * resolveGenUiBezierProgress(elapsedMs / durationMs)
  );
}

/** Largest 1 ms step the extras ease can take for this distance and duration. */
export function resolveChartSeedExtrasMaxEaseStep(
  distance: number,
  durationMs: number,
): number {
  const span = Math.abs(distance);
  if (durationMs <= 0) return span;
  let max = 0;
  let prev = 0;
  for (let t = 0; t <= durationMs; t += 1) {
    const height = span * resolveGenUiBezierProgress(t / durationMs);
    if (t > 0) max = Math.max(max, Math.abs(height - prev));
    prev = height;
  }
  return max;
}

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;
const SPLINE_TABLE_SIZE = 11;
const SAMPLE_STEP = 1.0 / (SPLINE_TABLE_SIZE - 1.0);

function bezierA(a1: number, a2: number): number {
  return 1.0 - 3.0 * a2 + 3.0 * a1;
}
function bezierB(a1: number, a2: number): number {
  return 3.0 * a2 - 6.0 * a1;
}
function bezierC(a1: number): number {
  return 3.0 * a1;
}
function calcBezier(t: number, a1: number, a2: number): number {
  return ((bezierA(a1, a2) * t + bezierB(a1, a2)) * t + bezierC(a1)) * t;
}
function bezierSlope(t: number, a1: number, a2: number): number {
  return (
    3.0 * bezierA(a1, a2) * t * t + 2.0 * bezierB(a1, a2) * t + bezierC(a1)
  );
}

function makeGenUiBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const samples = new Array<number>(SPLINE_TABLE_SIZE);
  for (let i = 0; i < SPLINE_TABLE_SIZE; i += 1) {
    samples[i] = calcBezier(i * SAMPLE_STEP, x1, x2);
  }
  function tForX(x: number): number {
    let intervalStart = 0.0;
    let currentSample = 1;
    const lastSample = SPLINE_TABLE_SIZE - 1;
    for (
      ;
      currentSample !== lastSample && samples[currentSample] <= x;
      currentSample += 1
    ) {
      intervalStart += SAMPLE_STEP;
    }
    currentSample -= 1;
    const dist =
      (x - samples[currentSample]) /
      (samples[currentSample + 1] - samples[currentSample]);
    const guess = intervalStart + dist * SAMPLE_STEP;
    const slope = bezierSlope(guess, x1, x2);
    if (slope >= NEWTON_MIN_SLOPE) {
      let current = guess;
      for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
        const currentSlope = bezierSlope(current, x1, x2);
        if (currentSlope === 0) return current;
        current -= (calcBezier(current, x1, x2) - x) / currentSlope;
      }
      return current;
    }
    if (slope === 0) return guess;
    let a = intervalStart;
    let b = intervalStart + SAMPLE_STEP;
    let currentT = a;
    let currentX = 0;
    let i = 0;
    do {
      currentT = a + (b - a) / 2.0;
      currentX = calcBezier(currentT, x1, x2) - x;
      if (currentX > 0) b = currentT;
      else a = currentT;
    } while (
      Math.abs(currentX) > SUBDIVISION_PRECISION &&
      ++i < SUBDIVISION_MAX_ITERATIONS
    );
    return currentT;
  }
  return (t: number) => calcBezier(tForX(t), y1, y2);
}

const GEN_UI_BEZIER = makeGenUiBezier(
  GEN_UI_EASING[0],
  GEN_UI_EASING[1],
  GEN_UI_EASING[2],
  GEN_UI_EASING[3],
);

/**
 * Unfolded, the fold control sits on the price row only — never over the
 * plot (scrub) or the range pills.
 */
export function resolveChartSeedFoldHitHeight(): number {
  return kitType.chartPrice;
}

/**
 * Extra hit area so the 28 dp price-row control meets 44 dp. React Native
 * clips hitSlop to the parent, so the extra cannot go past the card's 14 dp
 * top padding: 14 dp up into it, and the rest (2 dp) down into the 4 dp gap
 * above the range pills — never over the pills, never outside the card.
 */
export function resolveChartSeedFoldHitSlop(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const extra = Math.max(0, MIN_TAP_TARGET_PT - resolveChartSeedFoldHitHeight());
  const top = Math.min(extra, CHART_SEED_CARD.paddingVertical);
  return { top, bottom: extra - top, left: 0, right: 0 };
}

/** The chart's own region: the 22 dp head, 8, then the plot — or the mini face. */
export function resolveChartSeedRegionHeight(
  size: ChartSeedSize,
  measuredMiniHeight?: number | null,
): number {
  if (size === 'mini') return resolveChartSeedMiniRegionHeight(measuredMiniHeight);
  return PRICE_CHART_SEED_HEAD_HEIGHT + PRICE_CHART_SEED_GAP + PLOT[size];
}

export function resolveChartSeedFootHeight(size: ChartSeedSize): number {
  return size === 'grown'
    ? CHART_SEED_CARD.footGap + CHART_SEED_CARD.footLineHeight
    : 0;
}

export function resolveChartSeedCardHeight(
  size: ChartSeedSize,
  measuredMiniHeight?: number | null,
): number {
  return (
    CHART_SEED_CARD.paddingVertical * 2 +
    resolveChartSeedRegionHeight(size, measuredMiniHeight) +
    resolveChartSeedFootHeight(size) +
    resolveChartSeedExtrasHeight(size === 'mini')
  );
}

export type ChartSeedEligibility =
  | { eligible: true; presentation: PriceChartReadyPresentation }
  | {
      eligible: false;
      reason:
        | 'no-verdict'
        | 'history-pending'
        | 'history-unavailable'
        | 'stub';
    };

/**
 * A seed needs a verdict AND a resolved price history the chart draws as a
 * line. A refusal, a swap answer and a no-verdict answer carry no chart slot
 * (`resolveHomeAssembly`); a price feed switched off, an error or a stub
 * never reach `ready` + `chart`. Every one of those is no card.
 */
export function resolveChartSeedEligibility(input: {
  chart: HomeAssemblyChart | null;
  hasVerdict: boolean;
  history: PriceChartHistory | null;
}): ChartSeedEligibility {
  if (input.chart === null || !input.hasVerdict) {
    return { eligible: false, reason: 'no-verdict' };
  }
  const history = input.history;
  if (history !== null && (history.status === 'idle' || history.status === 'loading')) {
    return { eligible: false, reason: 'history-pending' };
  }
  // No history handed in is no history: never a pending that waits forever.
  if (history === null || history.status !== 'ready') {
    return { eligible: false, reason: 'history-unavailable' };
  }
  const presentation = resolvePriceChartHistoryPresentation({
    history,
    currentPriceUsd: null,
    width: 320,
    height: PLOT.seed,
    scrubIndex: null,
    condensed: true,
  });
  if (presentation.kind !== 'chart') return { eligible: false, reason: 'stub' };
  return { eligible: true, presentation };
}

export function resolveVerdictFootDetailsShown(input: {
  forwardKind: string | null;
  eligibility: ChartSeedEligibility;
}): boolean {
  if (input.forwardKind !== 'details') return input.forwardKind !== null;
  if (input.eligibility.eligible) return false;
  return input.eligibility.reason !== 'history-pending';
}

/* ─── Phase 4: when the seed enters ───────────────────────────────────────── */

/**
 * No earlier than 150 ms after the verdict's CTA arms. The arm time is read
 * off the card's ONE table (`resolveVerdictCtaArmDelayMs`), never restated:
 * 1450 ms after mount under the retune, 0 under Reduce Motion.
 */
export function resolveChartSeedEntryDelayMs(input: {
  reduceMotion: boolean;
}): number {
  return (
    resolveVerdictCtaArmDelayMs(
      resolveVerdictAssembly({ reduceMotion: input.reduceMotion }),
    ) + SEED_AFTER_CTA_ARM_MS
  );
}

/**
 * Whether the seed is on screen at `nowMs`. Both halves hold: the history
 * has resolved, and the delay after the verdict mounted has passed. A
 * history that lands late enters when it lands.
 */
export function resolveChartSeedEntry(input: {
  eligible: boolean;
  verdictMountedAtMs: number | null;
  nowMs: number;
  reduceMotion: boolean;
}): { entered: boolean; enterAtMs: number | null } {
  if (input.verdictMountedAtMs === null) return { entered: false, enterAtMs: null };
  const enterAtMs =
    input.verdictMountedAtMs +
    resolveChartSeedEntryDelayMs({ reduceMotion: input.reduceMotion });
  return { entered: input.eligible && input.nowMs >= enterAtMs, enterAtMs };
}

/* ─── Phases 4b · 6 · 9: the size ─────────────────────────────────────────── */

export function resolveChartSeedSize(input: {
  newest: boolean;
  grownMoment: boolean;
  unfolded: boolean;
}): ChartSeedSize {
  if (input.unfolded) return 'mini';
  return input.newest && input.grownMoment ? 'grown' : 'seed';
}

export function resolveChartSeedPriceChartProps(input: {
  unfolded: boolean;
  face: Exclude<ChartSeedSize, 'mini'>;
}): {
  size: PriceChartSize;
  condensed: boolean;
  pinSeedRange: boolean;
} {
  if (input.unfolded) {
    return { size: 'compact', condensed: true, pinSeedRange: false };
  }
  return {
    size: input.face === 'grown' ? PRICE_CHART_GROWN_SIZE : 'seed',
    condensed: false,
    pinSeedRange: true,
  };
}

/**
 * Phase 6: the thread scrolls by the same delta the card grows, so the
 * card's bottom stays put. Reduce Motion still uses the delta (a jump).
 */
export function resolveUnfoldKeepBottomDelta(
  fromHeight: number,
  toHeight: number,
): number {
  return Math.max(0, toHeight - fromHeight);
}

export function resolveUnfoldKeepBottomOffset(input: {
  scrollY: number;
  delta: number;
}): number {
  return Math.max(0, input.scrollY + input.delta);
}

/**
 * Home's unfold handler: on open, the offset that keeps the card's bottom
 * put. Folding does not scroll (phase 9 / the next tap shrinks in place).
 * Reduce Motion still uses the delta (a jump).
 */
export function resolveChartSeedUnfoldScroll(input: {
  unfolded: boolean;
  scrollY: number;
  fromHeight: number;
  toHeight: number;
}): number | null {
  if (!input.unfolded) return null;
  const delta = resolveUnfoldKeepBottomDelta(input.fromHeight, input.toHeight);
  if (delta <= 0) return null;
  return resolveUnfoldKeepBottomOffset({ scrollY: input.scrollY, delta });
}

/**
 * Follow realised content growth so the card's bottom stays put. Call this
 * from `onContentSizeChange` after the card has grown — never from the tap,
 * where RN 0.86.2 clamps `scrollTo` to the current content end.
 */
export function resolveKeepBottomFollow(input: {
  baseY: number;
  baseH: number;
  contentH: number;
}): number {
  return Math.max(0, input.baseY + Math.max(0, input.contentH - input.baseH));
}

/** Disarm after two grows (the first, and a Structure restart) plus one frame. */
export const CHART_SEED_KEEP_BOTTOM_MS = SEED_GROW_MS * 2 + 16;

/**
 * The range the card names and carries: 1D while folded (the seed's pin),
 * otherwise the same active range PriceChart fetches from the saved four.
 */
export function resolveChartSeedActiveRange(input: {
  unfolded: boolean;
  chosen: PriceChartRange;
  visible: readonly PriceChartRange[];
}): PriceChartRange {
  if (!input.unfolded) return CHART_SEED_RANGE;
  return resolvePriceChartActiveRange(
    input.chosen,
    resolveShownPriceChartRanges(undefined, input.visible),
  );
}

export function resolveChartSeedDetailsParams(input: {
  mint: string;
  range: PriceChartRange;
}): { mint: string; range: PriceChartRange } {
  return {
    mint: input.mint,
    [CHART_SEED_DETAILS_RANGE_PARAM]: input.range,
  };
}

export function resolveChartSeedTap(unfolded: boolean): boolean {
  return !unfolded;
}

export type ChartSeedMotion = {
  animated: boolean;
  riseMs: number;
  risePx: number;
  growAfterEntryMs: number;
  growMs: number;
  footFadeMs: number;
  /** Phase 6: range control, Structure, Open details fade in. */
  extrasFadeMs: number;
  foldBackMs: number;
  easing: readonly number[];
};

export function resolveChartSeedMotion(input: {
  reduceMotion: boolean;
}): ChartSeedMotion {
  if (input.reduceMotion) {
    return {
      animated: false,
      riseMs: 0,
      risePx: 0,
      growAfterEntryMs: 0,
      growMs: 0,
      footFadeMs: 0,
      extrasFadeMs: 0,
      foldBackMs: 0,
      easing: GEN_UI_EASING,
    };
  }
  return {
    animated: true,
    riseMs: SEED_RISE_MS,
    risePx: SEED_RISE_PX,
    growAfterEntryMs: SEED_GROW_AFTER_ENTRY_MS,
    growMs: SEED_GROW_MS,
    footFadeMs: SEED_FOOT_FADE_MS,
    extrasFadeMs: SEED_FOOT_FADE_MS,
    foldBackMs: SEED_FOLD_BACK_MS,
    easing: GEN_UI_EASING,
  };
}

/* ─── Words ────────────────────────────────────────────────────────────────── */

export const CHART_SEED_COPY = Object.freeze({
  low: 'Low',
  high: 'High',
  price: 'price',
  percent: 'percent',
  up: 'up',
  down: 'down',
  unchanged: 'unchanged',
  expand: 'Double-tap to expand.',
  collapse: 'Double-tap to collapse.',
  openDetails: 'Open details',
});

const RANGE_WORDS: Readonly<Record<PriceChartRange, string>> = Object.freeze({
  '15s': '15 seconds',
  '1H': '1 hour',
  '1D': '1 day',
  '1W': '1 week',
  '1M': '1 month',
  ALL: 'all time',
});

/** The grown foot line: *Low · High* left, the as-of clock right. */
export function resolveChartSeedFoot(presentation: PriceChartReadyPresentation): {
  bounds: string;
  source: string | null;
} {
  return {
    bounds: `${CHART_SEED_COPY.low} ${presentation.minLabel} · ${CHART_SEED_COPY.high} ${presentation.maxLabel}`,
    source: presentation.attribution?.split('\n')[0] ?? null,
  };
}

export function resolveChartSeedAccessibilityLabel(input: {
  symbol: string;
  range: PriceChartRange;
  presentation: PriceChartReadyPresentation;
  unfolded: boolean;
}): string {
  const { presentation } = input;
  const pct = presentation.deltaText.replace(/[^0-9.]/g, '');
  const move =
    presentation.direction === 'flat' || pct === ''
      ? CHART_SEED_COPY.unchanged
      : `${presentation.direction === 'up' ? CHART_SEED_COPY.up : CHART_SEED_COPY.down} ${pct} ${CHART_SEED_COPY.percent}`;
  const bare = (label: string) => label.replace(/^\$/, '');
  return [
    `${input.symbol} ${CHART_SEED_COPY.price}`,
    RANGE_WORDS[input.range],
    move,
    `${CHART_SEED_COPY.low.toLowerCase()} ${bare(presentation.minLabel)}`,
    `${CHART_SEED_COPY.high.toLowerCase()} ${bare(presentation.maxLabel)}.`,
  ].join(', ') + ` ${input.unfolded ? CHART_SEED_COPY.collapse : CHART_SEED_COPY.expand}`;
}

export type GenUiSettleScroll = {
  mode: 'end' | 'verdict-top';
  /** The offset to scroll to in `verdict-top`; `null` means scroll to end. */
  offsetY: number | null;
  /** How much of the chart shows above the dock once settled. */
  chartVisibleDp: number;
};

export function resolveGenUiSettleScroll(input: {
  viewportHeight: number;
  topInset: number;
  bottomInset: number;
  verdictTop: number;
  chartTop: number;
  chartBottom: number;
}): GenUiSettleScroll {
  const band = Math.max(0, input.viewportHeight - input.topInset - input.bottomInset);
  const chartHeight = Math.max(0, input.chartBottom - input.chartTop);
  if (input.chartBottom - input.verdictTop <= band) {
    return { mode: 'end', offsetY: null, chartVisibleDp: chartHeight };
  }
  const offsetY = Math.max(0, input.verdictTop - input.topInset);
  const bandBottom = offsetY + input.viewportHeight - input.bottomInset;
  return {
    mode: 'verdict-top',
    offsetY,
    chartVisibleDp: Math.max(0, Math.min(chartHeight, bandBottom - input.chartTop)),
  };
}

export { SEED_MIN_PEEK_DP };
