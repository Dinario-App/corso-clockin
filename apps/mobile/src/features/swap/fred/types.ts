export const FRED_SECONDARY_SERIES = [
  'DGS10',
  'T10Y2Y',
  'DTWEXBGS',
  'CPIAUCSL',
] as const;

export type FredSecondaryId = (typeof FRED_SECONDARY_SERIES)[number];

export const FRED_ATTRIBUTION_NOTICE =
  'This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.';

export const FRED_DAILY_STALE_MS = 14 * 24 * 60 * 60 * 1000;
export const FRED_MONTHLY_STALE_MS = 75 * 24 * 60 * 60 * 1000;
export const FRED_CLIENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const FRED_CLIENT_NEGATIVE_TTL_MS = 10 * 60 * 1000;
export const FRED_CHIP_KEY = 'macro' as const;

export type FredFed =
  | {
      kind: 'target-range';
      lower: number;
      upper: number;
      observedOn: string;
      observedAtMs: number;
    }
  | {
      kind: 'effective';
      value: number;
      observedOn: string;
      observedAtMs: number;
    };

export type FredSecondary = {
  seriesId: FredSecondaryId;
  value: number;
  previousValue: number | null;
  changeRatio: number | null;
  observedOn: string;
  observedAtMs: number;
};

export type FredReady = {
  schemaVersion: 1;
  status: 'ready';
  fetchedAtMs: number;
  attribution: typeof FRED_ATTRIBUTION_NOTICE;
  cacheTtlSec: number;
  fed: FredFed;
  secondary: FredSecondary | null;
};

export type FredUnavailable = {
  schemaVersion: 1;
  status: 'unavailable';
};

export type FredResponse = FredReady | FredUnavailable;

export type FredChip = {
  key: typeof FRED_CHIP_KEY;
  label: string;
  freshness: string;
  notice: typeof FRED_ATTRIBUTION_NOTICE;
};
