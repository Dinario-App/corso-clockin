import {
  parseDecimalPrice,
  type FiatCurrency,
  type PriceQuote,
  type PriceQuoteMap,
} from './computeFiatTotal';
import { PublicKey } from '@solana/web3.js';

export const DEFAULT_MAX_AGE_MS = 60_000;
export const DEFAULT_CACHE_TTL_SEC = 20;

const MAX_PRICE_SCALE = 18;
/** Bounded portfolio batch that stays within the GET query-size limit. */
export const MAX_PRICE_MINTS = 10;

export type PriceCluster = 'devnet' | 'mainnet-beta';

export type PriceSnapshotRequest = {
  mints: string[];
  currency: 'USD';
  cluster: PriceCluster;
};

export type PriceLineStatus =
  | 'ok'
  | 'missing'
  | 'stale'
  | 'unsupported'
  | 'bad'
  | 'unavailable';

export type PriceSnapshotLineQuote = {
  mint: string;
  currency: 'USD';
  price: string;
  asOfMs: number;
  /** Opaque upstream label (fixture | jupiter_price | pyth | …). */
  source: string;
  maxAgeMs: number;
};

export type PriceSnapshotLine = {
  mint: string;
  status: PriceLineStatus;
  quote: null | PriceSnapshotLineQuote;
  /** Machine reason for non-ok; safe for logs; never wallet data. */
  reason?: string;
};

export type PriceSnapshotStatus =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'disabled';

export type PriceSnapshot = {
  schemaVersion: 1;
  status: PriceSnapshotStatus;
  currency: 'USD';
  cluster: PriceCluster;
  /** Server clock when snapshot was assembled. */
  asOfMs: number;
  defaultMaxAgeMs: number;
  lines: PriceSnapshotLine[];
  /** Unique opaque upstream labels used for ok lines. */
  sources: string[];
  cacheTtlSec: number;
};

/**
 * Vendor-neutral intermediate — adapters map upstream JSON into this
 * before calling normalizeUpstreamPrice. Never pass raw vendor shapes through.
 */
export type UpstreamPriceIntermediate = {
  mint: string;
  price: unknown;
  asOfMs: unknown;
  source: unknown;
};

export type NormalizeUpstreamPriceArgs = {
  mint: string;
  cluster: PriceCluster;
  currency?: FiatCurrency;
  /** Null/undefined → missing for a valid mint. */
  intermediate: UpstreamPriceIntermediate | null | undefined;
  nowMs: number;
  maxAgeMs?: number;
};

export type PriceSnapshotRequestValidation =
  | { ok: true; request: PriceSnapshotRequest }
  | { ok: false; code: 'invalid_request'; reason: string };

export function isValidPriceMint(
  mint: string,
  _cluster: PriceCluster,
): boolean {
  try {
    return new PublicKey(mint).toBase58() === mint;
  } catch {
    return false;
  }
}

/**
 * Pure request gate for bounded unique Solana mint ids.
 * HTTP 400 mapping is a later BFF concern; here we only emit invalid_request.
 */
export function validatePriceSnapshotRequest(raw: {
  mints: unknown;
  currency?: unknown;
  cluster?: unknown;
}): PriceSnapshotRequestValidation {
  if (!Array.isArray(raw.mints)) {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'mints_not_array',
    };
  }
  if (raw.mints.length === 0) {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'mints_empty',
    };
  }
  if (raw.mints.length > MAX_PRICE_MINTS) {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'mints_cardinality',
    };
  }
  if (!raw.mints.every((m) => typeof m === 'string' && m.length > 0)) {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'mints_not_strings',
    };
  }
  const mints = raw.mints as string[];
  if (new Set(mints).size !== mints.length) {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'mints_not_unique',
    };
  }

  const currency = raw.currency ?? 'USD';
  if (currency !== 'USD') {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'currency_unsupported',
    };
  }

  const cluster = raw.cluster;
  if (cluster !== 'devnet' && cluster !== 'mainnet-beta') {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'cluster_invalid',
    };
  }

  if (!mints.every((mint) => isValidPriceMint(mint, cluster))) {
    return {
      ok: false,
      code: 'invalid_request',
      reason: 'mints_invalid',
    };
  }

  return {
    ok: true,
    request: { mints, currency: 'USD', cluster },
  };
}

/**
 * Normalize a vendor-agnostic intermediate into one PriceSnapshotLine.
 * Never invents a zero price for missing/stale/bad/unsupported.
 */
export function normalizeUpstreamPrice(
  args: NormalizeUpstreamPriceArgs,
): PriceSnapshotLine {
  const mint = args.mint;
  const currency: FiatCurrency = args.currency ?? 'USD';
  const maxAgeMs = args.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  if (currency !== 'USD') {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'currency_unsupported',
    };
  }

  if (!isValidPriceMint(mint, args.cluster)) {
    return {
      mint,
      status: 'unsupported',
      quote: null,
      reason: 'mint_invalid',
    };
  }

  if (
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs < 0 ||
    !Number.isFinite(args.nowMs)
  ) {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'clock_invalid',
    };
  }

  const intermediate = args.intermediate;
  if (intermediate == null) {
    return {
      mint,
      status: 'missing',
      quote: null,
      reason: 'upstream_empty',
    };
  }

  if (typeof intermediate.mint !== 'string' || intermediate.mint !== mint) {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'mint_mismatch',
    };
  }

  if (typeof intermediate.source !== 'string' || intermediate.source.length === 0) {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'source_invalid',
    };
  }

  if (
    typeof intermediate.asOfMs !== 'number' ||
    !Number.isFinite(intermediate.asOfMs) ||
    intermediate.asOfMs < 0
  ) {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'asOfMs_invalid',
    };
  }

  // Numbers from JSON must already be decimal strings; refuse float/scientific.
  if (typeof intermediate.price !== 'string') {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'price_not_decimal_string',
    };
  }

  const parsed = parseDecimalPrice(intermediate.price);
  if (!parsed) {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'price_invalid',
    };
  }
  if (parsed.scale > MAX_PRICE_SCALE) {
    return {
      mint,
      status: 'bad',
      quote: null,
      reason: 'price_scale_unsafe',
    };
  }

  const age = args.nowMs - intermediate.asOfMs;
  if (age > maxAgeMs) {
    return {
      mint,
      status: 'stale',
      quote: null,
      reason: 'max_age_exceeded',
    };
  }

  const quote: PriceSnapshotLineQuote = {
    mint,
    currency: 'USD',
    price: intermediate.price,
    asOfMs: intermediate.asOfMs,
    source: intermediate.source,
    maxAgeMs,
  };

  return { mint, status: 'ok', quote };
}

export function snapshotToQuoteMap(snapshot: PriceSnapshot): PriceQuoteMap {
  const map: PriceQuoteMap = {};
  for (const line of snapshot.lines) {
    if (line.status === 'ok' && line.quote) {
      const quote: PriceQuote = {
        mint: line.quote.mint,
        currency: line.quote.currency,
        price: line.quote.price,
        asOfMs: line.quote.asOfMs,
        source: line.quote.source,
        maxAgeMs: line.quote.maxAgeMs,
      };
      map[line.mint] = quote;
    } else {
      map[line.mint] = null;
    }
  }
  return map;
}

export type BuildPriceSnapshotArgs = {
  cluster: PriceCluster;
  asOfMs: number;
  lines: PriceSnapshotLine[];
  defaultMaxAgeMs?: number;
  cacheTtlSec?: number;
  /** When true, status is disabled regardless of lines. */
  disabled?: boolean;
  currency?: 'USD';
};

/** Assemble a v1 snapshot and derive ready/partial/unavailable/disabled. */
export function buildPriceSnapshot(args: BuildPriceSnapshotArgs): PriceSnapshot {
  const defaultMaxAgeMs = args.defaultMaxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cacheTtlSec = args.cacheTtlSec ?? DEFAULT_CACHE_TTL_SEC;
  const currency = args.currency ?? 'USD';
  const lines = args.lines;
  const sources = uniqueOkSources(lines);
  const status = args.disabled
    ? 'disabled'
    : deriveSnapshotStatus(lines);

  return {
    schemaVersion: 1,
    status,
    currency,
    cluster: args.cluster,
    asOfMs: args.asOfMs,
    defaultMaxAgeMs,
    lines,
    sources,
    cacheTtlSec,
  };
}

/**
 * ready: every line is ok or intentionally unsupported
 * partial: ≥1 ok and ≥1 missing/stale/bad/unavailable
 * unavailable: zero ok among lines that needed pricing
 */
export function deriveSnapshotStatus(
  lines: PriceSnapshotLine[],
): Exclude<PriceSnapshotStatus, 'disabled'> {
  if (lines.length === 0) return 'unavailable';

  let okCount = 0;
  let needsPricingFail = 0;
  let unsupportedCount = 0;

  for (const line of lines) {
    if (line.status === 'ok') {
      okCount += 1;
      continue;
    }
    if (line.status === 'unsupported') {
      unsupportedCount += 1;
      continue;
    }
    needsPricingFail += 1;
  }

  if (okCount > 0 && needsPricingFail > 0) return 'partial';
  if (okCount > 0) return 'ready';
  if (needsPricingFail === 0 && unsupportedCount === lines.length) {
    return 'ready';
  }
  return 'unavailable';
}

function uniqueOkSources(lines: PriceSnapshotLine[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (line.status === 'ok' && line.quote) {
      const src = line.quote.source;
      if (!seen.has(src)) {
        seen.add(src);
        out.push(src);
      }
    }
  }
  return out;
}
