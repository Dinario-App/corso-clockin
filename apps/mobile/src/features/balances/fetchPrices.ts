import { SOL_MINT, usdcMintForCluster } from '@/src/features/swap/tokens';
import {
  buildPriceSnapshot,
  MAX_PRICE_MINTS,
  isValidPriceMint,
  normalizeUpstreamPrice,
  type PriceCluster,
  type PriceLineStatus,
  type PriceSnapshot,
  type PriceSnapshotLine,
  type PriceSnapshotStatus,
} from '@/src/features/balances/priceSnapshot';

export type PricesClientErrorCode =
  | 'missing_api_url'
  | 'invalid_request'
  | 'network'
  | 'schema'
  | 'rate_limited'
  | 'forbidden'
  | 'http';

export type FetchPricesSuccess = {
  ok: true;
  snapshot: PriceSnapshot;
};

export type FetchPricesFailure = {
  ok: false;
  code: PricesClientErrorCode;
  message: string;
  httpStatus?: number;
  /** Present on 429 when the server sent a delta-seconds Retry-After. */
  retryAfterSec?: number;
};

export type FetchPricesResult = FetchPricesSuccess | FetchPricesFailure;

export type FetchPricesArgs = {
  cluster: PriceCluster;
  /**
   * Kill switch from public config (`flags.pricesEnabled`).
   * When false, skip network and return a disabled snapshot.
   */
  pricesEnabled: boolean;
  mints?: string[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  /** Client clock for fail-closed re-normalization / disabled assembly. */
  nowMs?: number;
};

const LINE_STATUSES = new Set<PriceLineStatus>([
  'ok',
  'missing',
  'stale',
  'unsupported',
  'bad',
  'unavailable',
]);

const SNAPSHOT_STATUSES = new Set<PriceSnapshotStatus>([
  'ready',
  'partial',
  'unavailable',
  'disabled',
]);

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

/** Preserve requested order for valid unique Solana mint ids. */
export function resolvePriceRequestMints(
  cluster: PriceCluster,
  requested?: string[],
): string[] {
  const usdc = usdcMintForCluster(cluster);
  const defaults = [SOL_MINT, usdc];
  const source = requested ?? defaults;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const mint of source) {
    if (typeof mint !== 'string' || mint.length === 0) continue;
    if (!isValidPriceMint(mint, cluster)) continue;
    if (seen.has(mint)) continue;
    seen.add(mint);
    out.push(mint);
    if (out.length >= MAX_PRICE_MINTS) break;
  }
  return out;
}

/**
 * Parse Retry-After as delta-seconds only.
 * HTTP-date forms are ignored (caller may still back off with a default).
 */
export function parseRetryAfterSeconds(
  value: string | null,
): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const seconds = Number(trimmed);
  if (!Number.isInteger(seconds) || seconds <= 0) return null;
  return seconds;
}

function disabledSnapshot(
  cluster: PriceCluster,
  nowMs: number,
): PriceSnapshot {
  return buildPriceSnapshot({
    cluster,
    asOfMs: nowMs,
    lines: [],
    disabled: true,
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Fail-closed parse + re-normalize of a BFF PriceSnapshot body.
 * Never invents a zero price for missing/bad/stale lines.
 */
export function parseAndNormalizePriceSnapshot(
  raw: unknown,
  args: { cluster: PriceCluster; nowMs: number },
): PriceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;

  if (body.schemaVersion !== 1) return null;
  if (body.currency !== 'USD') return null;
  if (body.cluster !== args.cluster) return null;
  if (
    typeof body.status !== 'string' ||
    !SNAPSHOT_STATUSES.has(body.status as PriceSnapshotStatus)
  ) {
    return null;
  }
  if (!isFiniteNumber(body.asOfMs) || body.asOfMs < 0) return null;
  if (!isFiniteNumber(body.defaultMaxAgeMs) || body.defaultMaxAgeMs < 0) {
    return null;
  }
  if (!isFiniteNumber(body.cacheTtlSec) || body.cacheTtlSec < 0) return null;
  if (!Array.isArray(body.lines)) return null;
  if (!Array.isArray(body.sources)) return null;
  if (!body.sources.every((s) => typeof s === 'string')) return null;

  if (body.status === 'disabled') {
    return buildPriceSnapshot({
      cluster: args.cluster,
      asOfMs: body.asOfMs,
      lines: [],
      disabled: true,
      defaultMaxAgeMs: body.defaultMaxAgeMs,
      cacheTtlSec: body.cacheTtlSec,
    });
  }

  const lines: PriceSnapshotLine[] = [];
  for (const entry of body.lines) {
    if (!entry || typeof entry !== 'object') return null;
    const line = entry as Record<string, unknown>;
    if (typeof line.mint !== 'string' || line.mint.length === 0) return null;
    if (
      typeof line.status !== 'string' ||
      !LINE_STATUSES.has(line.status as PriceLineStatus)
    ) {
      return null;
    }

    const status = line.status as PriceLineStatus;
    if (status !== 'ok') {
      lines.push({
        mint: line.mint,
        status,
        quote: null,
        reason: typeof line.reason === 'string' ? line.reason : undefined,
      });
      continue;
    }

    const quoteRaw = line.quote;
    if (!quoteRaw || typeof quoteRaw !== 'object') {
      lines.push({
        mint: line.mint,
        status: 'bad',
        quote: null,
        reason: 'ok_without_quote',
      });
      continue;
    }
    const quote = quoteRaw as Record<string, unknown>;
    // Pass through for normalizeUpstreamPrice — mint mismatch / bad shapes → bad.
    const intermediateMint =
      typeof quote.mint === 'string' ? quote.mint : '';
    const normalized = normalizeUpstreamPrice({
      mint: line.mint,
      cluster: args.cluster,
      intermediate: {
        mint: intermediateMint,
        price: quote.price,
        asOfMs: quote.asOfMs,
        source: quote.source,
      },
      nowMs: args.nowMs,
      maxAgeMs: isFiniteNumber(quote.maxAgeMs)
        ? quote.maxAgeMs
        : body.defaultMaxAgeMs,
    });
    lines.push(normalized);
  }

  return buildPriceSnapshot({
    cluster: args.cluster,
    asOfMs: body.asOfMs,
    lines,
    defaultMaxAgeMs: body.defaultMaxAgeMs,
    cacheTtlSec: body.cacheTtlSec,
  });
}

/**
 * Fetch a provider-agnostic PriceSnapshot from pulse-api.
 * Does not retry on 429/5xx/network; surfaces Retry-After when present.
 */
export async function fetchPrices(
  args: FetchPricesArgs,
): Promise<FetchPricesResult> {
  const nowMs = args.nowMs ?? Date.now();
  const cluster = args.cluster;

  if (!args.pricesEnabled) {
    return { ok: true, snapshot: disabledSnapshot(cluster, nowMs) };
  }

  const mints = resolvePriceRequestMints(cluster, args.mints);
  if (mints.length === 0) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'No valid Solana mints to request.',
    };
  }

  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) {
    return {
      ok: false,
      code: 'missing_api_url',
      message: 'Price API URL is not configured.',
    };
  }

  const params = new URLSearchParams({
    mints: mints.join(','),
    currency: 'USD',
    cluster,
  });
  const url = `${base}/v1/prices?${params.toString()}`;
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      signal: args.signal,
      // Native-only contract: never attach Origin.
      headers: {
        accept: 'application/json',
      },
    });
  } catch {
    return {
      ok: false,
      code: 'network',
      message: 'Could not reach the price service.',
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      code: 'rate_limited',
      message: 'Too many price requests. Try again shortly.',
      httpStatus: 429,
      retryAfterSec:
        parseRetryAfterSeconds(response.headers.get('retry-after')) ??
        undefined,
    };
  }

  if (response.status === 403) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Price requests are accepted only from the native app.',
      httpStatus: 403,
    };
  }

  if (response.status === 400) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'Price request was rejected.',
      httpStatus: 400,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'http',
      message: 'Price service is temporarily unavailable.',
      httpStatus: response.status,
    };
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return {
      ok: false,
      code: 'schema',
      message: 'Price response was not valid JSON.',
      httpStatus: response.status,
    };
  }

  const snapshot = parseAndNormalizePriceSnapshot(raw, { cluster, nowMs });
  if (!snapshot) {
    return {
      ok: false,
      code: 'schema',
      message: 'Price response failed schema validation.',
      httpStatus: response.status,
    };
  }

  return { ok: true, snapshot };
}
