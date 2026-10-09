import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import type { TimeframeId } from '@/src/features/tokenVitals/types';
import { isSignalTimeframe, type SignalTimeframe } from './types';

/** Card pill → signal timeframe, same bar width (case only), except `1w` → `1D`. */
export const CARD_TO_SIGNAL_TIMEFRAME: Record<TimeframeId, SignalTimeframe> = {
  '1m': '1m',
  '5m': '5m',
  '1h': '1H',
  '4h': '4H',
  '1d': '1D',
  '1w': '1D',
};

export function toSignalTimeframe(timeframe: TimeframeId): SignalTimeframe {
  return CARD_TO_SIGNAL_TIMEFRAME[timeframe];
}

export const FULL_CHART_DEFAULT_TIMEFRAME: SignalTimeframe = '1H';

export type FullChartHref = {
  pathname: '/chart/[mint]';
  params: { mint: string; timeframe: SignalTimeframe };
};

/** Href for the escalation door. `null` for anything that is not a mainnet mint. */
export function buildFullChartHref(input: {
  mint: string;
  timeframe?: SignalTimeframe | TimeframeId;
}): FullChartHref | null {
  if (!isValidPriceMint(input.mint, 'mainnet-beta')) return null;
  const requested = input.timeframe;
  const timeframe: SignalTimeframe =
    requested === undefined
      ? FULL_CHART_DEFAULT_TIMEFRAME
      : isSignalTimeframe(requested)
        ? requested
        : toSignalTimeframe(requested);
  return { pathname: '/chart/[mint]', params: { mint: input.mint, timeframe } };
}

export type FullChartParams = { mint: string; timeframe: SignalTimeframe };

/**
 * Route params → validated inputs, fail-closed: a bad mint yields `null`
 * (the screen renders its invalid state, fetches nothing); an unknown
 * timeframe falls back to the default rather than refusing the screen.
 */
export function parseFullChartParams(raw: {
  mint?: string | string[];
  timeframe?: string | string[];
}): FullChartParams | null {
  const mint = Array.isArray(raw.mint) ? raw.mint[0] : raw.mint;
  if (typeof mint !== 'string' || !isValidPriceMint(mint, 'mainnet-beta'))
    return null;
  const tf = Array.isArray(raw.timeframe) ? raw.timeframe[0] : raw.timeframe;
  return {
    mint,
    timeframe: isSignalTimeframe(tf) ? tf : FULL_CHART_DEFAULT_TIMEFRAME,
  };
}
