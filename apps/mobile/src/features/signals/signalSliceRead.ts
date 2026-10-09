import { copy } from '@/constants/copy';
import { CHART_BUNDLE_SETTLE_MS, SIGNAL_TIMEFRAME_MS } from './chartBundlePlan';
import type { SignalTimeframe } from './types';

export function signalSliceWindowMs(timeframe: SignalTimeframe): number {
  return SIGNAL_TIMEFRAME_MS[timeframe] + CHART_BUNDLE_SETTLE_MS;
}

export function isSignalSliceFresh(input: {
  asOfMs: number;
  timeframe: SignalTimeframe;
  nowMs: number;
}): boolean {
  if (!Number.isFinite(input.asOfMs) || input.asOfMs <= 0) return false;
  if (!Number.isFinite(input.nowMs)) return false;
  const age = input.nowMs - input.asOfMs;
  if (age < -CHART_BUNDLE_SETTLE_MS) return false;
  return age <= signalSliceWindowMs(input.timeframe);
}

/**
 * The score's clock is the wall. `lastFetchedAtMs` is when a fetch landed;
 * using it as `now` keeps a close on screen after the bar window has passed.
 * Probe (a)'s mutation is returning `lastFetchedAtMs` from here.
 */
export function resolveDisplayedSignalNowMs(input: {
  wallNowMs: number;
  lastFetchedAtMs: number | null;
}): number {
  return input.wallNowMs;
}

/**
 * A close we can name. Zero, NaN, and null are not a bar.
 * `This close could not be read.` is only for one of these.
 */
function realCloseMs(asOfMs: number | null): asOfMs is number {
  return typeof asOfMs === 'number' && Number.isFinite(asOfMs) && asOfMs > 0;
}

/** Too old, or no usable clock. Never a score. */
export function signalSliceUnknownReason(input: {
  asOfMs: number | null;
  timeframe: SignalTimeframe;
  nowMs: number;
}): string {
  if (!realCloseMs(input.asOfMs)) return copy.chartEdge.unavailable;
  if (
    Number.isFinite(input.nowMs) &&
    input.nowMs - input.asOfMs > signalSliceWindowMs(input.timeframe)
  ) {
    return copy.chartEdge.unknownStale;
  }
  return copy.chartEdge.unknownUnreadable;
}
