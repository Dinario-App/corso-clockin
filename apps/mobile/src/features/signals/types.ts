import {
  VELA_TIMEFRAMES,
  type VelaCandle,
  type VelaOverlays,
  type VelaTimeframe,
} from '@/src/ui/charts/vela/velaBridge';

export { VELA_TIMEFRAMES as SIGNAL_TIMEFRAMES };
export type SignalTimeframe = VelaTimeframe;
export type ChartBundleCandle = VelaCandle;
export type ChartBundleOverlays = VelaOverlays;

export const SIGNAL_KINDS = [
  'market_structure',
  'order_block',
  'fvg',
  'liquidity',
  'divergence',
  'premium_discount',
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const CONFLUENCE_BANDS = [
  'strong_bear',
  'bear',
  'neutral',
  'bull',
  'strong_bull',
] as const;
export type ConfluenceBand = (typeof CONFLUENCE_BANDS)[number];

export type ConfluenceScore = {
  /** 0..100, 50 = balanced. */
  score: number;
  band: ConfluenceBand;
  contributors: Array<{
    kind: SignalKind;
    weight: number;
    contribution: number;
  }>;
};

export const CHART_BUNDLE_SOURCES = ['Birdeye', 'GeckoTerminal'] as const;
export type ChartBundleSource = (typeof CHART_BUNDLE_SOURCES)[number];

export type ChartBundle = {
  mint: string;
  timeframe: SignalTimeframe;
  range: string;
  source: ChartBundleSource;
  /** Most-recent closed bar time. */
  asOfMs: number;
  candles: ChartBundleCandle[];
  overlays: ChartBundleOverlays;
  confluence: ConfluenceScore;
  /** Indicators the server dropped this cycle (honesty note on the surface). */
  degraded: SignalKind[];
};

export function isSignalTimeframe(value: unknown): value is SignalTimeframe {
  return (
    typeof value === 'string' &&
    (VELA_TIMEFRAMES as readonly string[]).includes(value)
  );
}
