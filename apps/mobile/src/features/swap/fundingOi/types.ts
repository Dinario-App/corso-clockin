export const FUNDING_OI_ASSETS = ['BTC', 'ETH', 'SOL'] as const;
export type FundingOiAsset = (typeof FUNDING_OI_ASSETS)[number];

export const FUNDING_OI_VENUES = ['okx', 'bybit', 'binance'] as const;
export type FundingOiVenue = (typeof FUNDING_OI_VENUES)[number];

export const FUNDING_OI_STALE_MS = 12 * 60 * 60 * 1000;
export const FUNDING_OI_CLIENT_CACHE_TTL_MS = 30 * 60 * 1000;
export const FUNDING_OI_MAX_ABS_RATE = 0.05;
export const FUNDING_OI_CHIP_KEY = 'funding' as const;

export type FundingOiInstrument = {
  asset: FundingOiAsset;
  fundingRate: number;
  openInterestUsd: number | null;
  observedAtMs: number;
  venue: FundingOiVenue;
};

export type FundingOiReady = {
  schemaVersion: 1;
  status: 'ready';
  instruments: readonly FundingOiInstrument[];
  venues: readonly FundingOiVenue[];
  fetchedAtMs: number;
  cacheTtlSec: number;
};

export type FundingOiUnavailable = {
  schemaVersion: 1;
  status: 'unavailable';
};

export type FundingOiResponse = FundingOiReady | FundingOiUnavailable;

export type FundingOiChip = {
  key: typeof FUNDING_OI_CHIP_KEY;
  label: string;
  asset: FundingOiAsset;
  fundingRate: number;
  openInterestUsd: number | null;
  venues: readonly FundingOiVenue[];
  freshness: string;
};
