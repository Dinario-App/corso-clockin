import type { SignalTimeframe } from './types';

export const SIGNAL_TIMEFRAME_MS: Record<SignalTimeframe, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '1H': 60 * 60_000,
  '4H': 4 * 60 * 60_000,
  '1D': 24 * 60 * 60_000,
};

/** Grace after a bar closes before the next fetch, so the server has computed it. */
export const CHART_BUNDLE_SETTLE_MS = 20_000;

export const CHART_BUNDLE_MIN_REFRESH_MS = 60_000;

export type ChartBundleRefreshPlan =
  | { refresh: true; delayMs: number; reason: 'bar_cadence' }
  | {
      refresh: false;
      delayMs: null;
      reason: 'disabled' | 'backgrounded' | 'not_focused' | 'no_bundle';
    };

/**
 * When to fetch next. `asOfMs` is the server's last closed bar; the next bar
 * closes one interval later, so the delay is (next close + settle) - now,
 * floored at the minimum. A stale bundle (next close already passed) refreshes
 * after the minimum, not immediately, so a flapping server cannot make the
 * phone hammer it.
 */
export function resolveChartBundleRefreshPlan(input: {
  enabled: boolean;
  focused: boolean;
  appActive: boolean;
  timeframe: SignalTimeframe;
  asOfMs: number | null;
  nowMs: number;
}): ChartBundleRefreshPlan {
  if (!input.enabled)
    return { refresh: false, delayMs: null, reason: 'disabled' };
  if (!input.appActive)
    return { refresh: false, delayMs: null, reason: 'backgrounded' };
  if (!input.focused)
    return { refresh: false, delayMs: null, reason: 'not_focused' };
  if (input.asOfMs == null)
    return { refresh: false, delayMs: null, reason: 'no_bundle' };
  const interval = SIGNAL_TIMEFRAME_MS[input.timeframe];
  const nextClose = input.asOfMs + interval;
  const delay = nextClose + CHART_BUNDLE_SETTLE_MS - input.nowMs;
  return {
    refresh: true,
    delayMs: Math.max(CHART_BUNDLE_MIN_REFRESH_MS, delay),
    reason: 'bar_cadence',
  };
}

export function resolveChartBundleFailure(input: {
  previous: { mint: string; timeframe: SignalTimeframe } | null;
  mint: string;
  timeframe: SignalTimeframe;
}): { keepBundle: boolean; status: 'ready' | 'unavailable' } {
  const keep =
    input.previous != null &&
    input.previous.mint === input.mint &&
    input.previous.timeframe === input.timeframe;
  return { keepBundle: keep, status: keep ? 'ready' : 'unavailable' };
}
