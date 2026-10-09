import { SIGNAL_TIMEFRAME_MS } from './chartBundlePlan';
import type { ChartBundleCandle, SignalTimeframe } from './types';

/** Fewer bars than this is "thin": the structure readings have little to stand on. */
export const CHART_COVERAGE_THIN_BARS = 24;

/** A last bar older than this many intervals reads as "quiet" (no recent trade). */
export const CHART_COVERAGE_QUIET_INTERVALS = 3;

export type ChartCoverage = {
  timeframe: SignalTimeframe;
  /** Bars the server actually shipped. */
  bars: number;
  /** Width of one shipped bar in ms — inferred from the tape, never assumed from the pill. */
  barMs: number;
  /** Intervals inside [first bar, last bar] with no bar — real gaps, not drawn. */
  missingBars: number;
  /** Whole intervals elapsed between the last closed bar and `nowMs`. */
  quietIntervals: number;
  thin: boolean;
  gappy: boolean;
  quiet: boolean;
  /** True when nothing needs saying: dense, contiguous, current. */
  complete: boolean;
};

/**
 * Median gap between consecutive bar open times, floored at the named
 * timeframe width. `undefined` for fewer than two bars (nothing to measure).
 */
export function inferBarMs(
  candles: readonly ChartBundleCandle[],
  timeframe: SignalTimeframe,
): number | undefined {
  if (candles.length < 2) return undefined;
  const gaps: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    const gap = candles[i]!.t - candles[i - 1]!.t;
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return undefined;
  gaps.sort((a, b) => a - b);
  return Math.max(
    SIGNAL_TIMEFRAME_MS[timeframe],
    gaps[Math.floor(gaps.length / 2)]!,
  );
}

export function resolveChartCoverage(input: {
  timeframe: SignalTimeframe;
  candles: readonly ChartBundleCandle[];
  /** The server's last closed bar time (`bundle.asOfMs`). */
  asOfMs: number;
  nowMs: number;
}): ChartCoverage {
  const interval =
    inferBarMs(input.candles, input.timeframe) ??
    SIGNAL_TIMEFRAME_MS[input.timeframe];
  const bars = input.candles.length;
  let missingBars = 0;
  if (bars >= 2) {
    const first = input.candles[0]!.t;
    const last = input.candles[bars - 1]!.t;
    const spanned = Math.floor((last - first) / interval) + 1;
    missingBars = Math.max(0, spanned - bars);
  }
  const elapsed = input.nowMs - input.asOfMs;
  const quietIntervals = elapsed > 0 ? Math.floor(elapsed / interval) : 0;
  const thin = bars < CHART_COVERAGE_THIN_BARS;
  const gappy = missingBars > 0;
  const quiet = quietIntervals >= CHART_COVERAGE_QUIET_INTERVALS;
  return {
    timeframe: input.timeframe,
    bars,
    barMs: interval,
    missingBars,
    quietIntervals,
    thin,
    gappy,
    quiet,
    complete: !thin && !gappy && !quiet,
  };
}
