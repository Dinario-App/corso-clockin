import type { SafetyVerdict } from '@/src/features/tokenVitals/types';

export const DISCOVERY_SCHEMA_VERSION = 1 as const;

export const LIFECYCLE_STAGES = [
  'new',
  'about_to_graduate',
  'graduated',
  'unknown',
] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const LIFECYCLE_BASES = [
  'graduated_pool',
  'bonding_curve',
  'no_curve_state',
] as const;
export type LifecycleBasis = (typeof LIFECYCLE_BASES)[number];

export const THIN_DATA_REASONS = [
  'young',
  'no_age',
  'no_holder_count',
  'no_liquidity',
  'no_market_cap',
  'no_verdict',
] as const;
export type ThinDataReason = (typeof THIN_DATA_REASONS)[number];

export const INTEL_INSUFFICIENT_REASONS = [
  'no_pool_reference',
  'no_early_trades',
  'no_holders',
  'no_trade_grouping',
  'no_funding_graph',
] as const;
export type IntelInsufficientReason =
  (typeof INTEL_INSUFFICIENT_REASONS)[number];

export const DISCOVERY_MARKET_SOURCES = ['jupiter', 'solana_tracker'] as const;
export type DiscoveryMarketSource = (typeof DISCOVERY_MARKET_SOURCES)[number];

export const DISCOVERY_SNIPER_SOURCES = [
  'onchain_intel',
  'solana_tracker',
] as const;
export type DiscoverySniperSource = (typeof DISCOVERY_SNIPER_SOURCES)[number];

export type DiscoverySniperRead =
  | {
      status: 'known';
      pct: number;
      wallets: number;
      confidence: 'high' | 'medium' | 'low';
      source: DiscoverySniperSource;
    }
  | { status: 'insufficient_data'; reason: IntelInsufficientReason }
  | { status: 'unavailable' };

export type DiscoveryRow = {
  mint: string;
  symbol: string;
  name: string | null;
  launchpad: string | null;
  lifecycle: {
    stage: LifecycleStage;
    basis: LifecycleBasis;
    curvePct: number | null;
  };
  ageMinutes: number | null;
  market: {
    liquidityUsd: number | null;
    holderCount: number | null;
    marketCapUsd: number | null;
    priceUsd: number | null;
    priceChange24hPct: number | null;
    source: DiscoveryMarketSource;
    asOf: string;
  };
  safety: SafetyVerdict | null;
  sniper: DiscoverySniperRead;
  dataCoverage: 'ok' | 'thin';
  thinReasons: ThinDataReason[];
};

export type DiscoveryFilters = {
  minLiquidityUsd: number | null;
  minHolders: number | null;
  maxSniperPct: number | null;
};

export type DiscoveryPayload = {
  render: 'discovery';
  schemaVersion: typeof DISCOVERY_SCHEMA_VERSION;
  band: { marketCapCeilingUsd: number };
  thresholds: { aboutToGraduateCurvePct: number; thinDataAgeMinutes: number };
  groups: Record<LifecycleStage, DiscoveryRow[]>;
  filters: {
    applied: DiscoveryFilters;
    hiddenByFilter: number;
    hiddenUnknown: number;
  };
  counts: { fetched: number; inBand: number; shown: number };
  feed: { source: string; asOf: string };
  disclosures: { isInformationNotAdvice: true; sourcesLabel: string };
  asOf: string;
};

export function isLifecycleStage(value: unknown): value is LifecycleStage {
  return (
    typeof value === 'string' &&
    (LIFECYCLE_STAGES as readonly string[]).includes(value)
  );
}
