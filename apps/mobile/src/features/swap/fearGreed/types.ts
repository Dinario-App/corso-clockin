export const FEAR_GREED_CLASSIFICATIONS = [
  'Extreme Fear',
  'Fear',
  'Neutral',
  'Greed',
  'Extreme Greed',
] as const;

export type FearGreedClassification =
  (typeof FEAR_GREED_CLASSIFICATIONS)[number];

export const FEAR_GREED_ATTRIBUTION = 'alternative.me' as const;
export const FEAR_GREED_STALE_MS = 36 * 60 * 60 * 1000;
export const FEAR_GREED_CLIENT_CACHE_TTL_MS = 60 * 60 * 1000;
/** Misses follow the API negative cache (`FEAR_GREED_NEGATIVE_CACHE_TTL_MS`), not the ready-row hour. */
export const FEAR_GREED_CLIENT_NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
export const FEAR_GREED_CHIP_KEY = 'sentiment' as const;

export type FearGreedReady = {
  schemaVersion: 1;
  status: 'ready';
  value: number;
  classification: FearGreedClassification;
  observedAtMs: number;
  fetchedAtMs: number;
  attribution: typeof FEAR_GREED_ATTRIBUTION;
  cacheTtlSec: number;
};

export type FearGreedUnavailable = {
  schemaVersion: 1;
  status: 'unavailable';
};

export type FearGreedResponse = FearGreedReady | FearGreedUnavailable;

export type FearGreedChip = {
  key: typeof FEAR_GREED_CHIP_KEY;
  label: string;
  value: number;
  classification: FearGreedClassification;
  attribution: typeof FEAR_GREED_ATTRIBUTION;
  freshness: string;
};
