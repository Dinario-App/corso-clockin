export const EDGAR_FORM_CODES = ['4', '4/A', '13F-HR', '13F-HR/A'] as const;
export type EdgarFormCode = (typeof EDGAR_FORM_CODES)[number];

export const FILINGS_CHIP_KEY = 'filings' as const;
export const FILINGS_SOURCE = 'SEC' as const;
export const FILINGS_STALE_MS = 400 * 24 * 60 * 60 * 1000;
export const FILINGS_CLIENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const FILINGS_MAX = 2;

export type FilingLink = {
  form: EdgarFormCode;
  title: string;
  filer: string;
  filedOn: string;
  href: string;
};

export type FilingsReady = {
  schemaVersion: 1;
  status: 'ready';
  mint: string;
  ticker: string;
  cik: string;
  issuer: string;
  filings: readonly FilingLink[];
  fetchedAtMs: number;
  cacheTtlSec: number;
};

export type FilingsUnmapped = {
  schemaVersion: 1;
  status: 'unmapped';
};

export type FilingsUnavailable = {
  schemaVersion: 1;
  status: 'unavailable';
};

export type FilingsResponse =
  | FilingsReady
  | FilingsUnmapped
  | FilingsUnavailable;

export type FilingsChipLine = {
  form: EdgarFormCode;
  title: string;
  filer: string;
  filedOn: string;
  href: string;
  label: string;
  freshness: string;
};

export type FilingsChip = {
  key: typeof FILINGS_CHIP_KEY;
  lines: readonly FilingsChipLine[];
};
