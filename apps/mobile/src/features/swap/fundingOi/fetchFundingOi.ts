import {
  FUNDING_OI_ASSETS,
  FUNDING_OI_CLIENT_CACHE_TTL_MS,
  FUNDING_OI_MAX_ABS_RATE,
  FUNDING_OI_VENUES,
  type FundingOiAsset,
  type FundingOiInstrument,
  type FundingOiResponse,
  type FundingOiVenue,
} from './types';

export type FetchFundingOiSuccess = {
  ok: true;
  snapshot: FundingOiResponse;
};

export type FetchFundingOiFailure = {
  ok: false;
};

export type FetchFundingOiResult =
  | FetchFundingOiSuccess
  | FetchFundingOiFailure;

export type FundingOiClientCache = {
  get(nowMs: number): FundingOiResponse | null;
  set(snapshot: FundingOiResponse, storedAtMs: number): void;
};

const ASSETS = new Set<string>(FUNDING_OI_ASSETS);
const VENUES = new Set<string>(FUNDING_OI_VENUES);

export function createFundingOiClientCache(): FundingOiClientCache {
  let entry: { snapshot: FundingOiResponse; storedAtMs: number } | null = null;
  return {
    get(nowMs) {
      if (!entry) return null;
      if (nowMs - entry.storedAtMs > FUNDING_OI_CLIENT_CACHE_TTL_MS) {
        entry = null;
        return null;
      }
      return entry.snapshot;
    },
    set(snapshot, storedAtMs) {
      entry = { snapshot, storedAtMs };
    },
  };
}

const defaultCache = createFundingOiClientCache();

export type FetchFundingOiArgs = {
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  nowMs?: number;
  cache?: FundingOiClientCache;
  signal?: AbortSignal;
};

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

function parseSnapshot(raw: unknown): FundingOiResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as {
    schemaVersion?: unknown;
    status?: unknown;
    instruments?: unknown;
    venues?: unknown;
    fetchedAtMs?: unknown;
    cacheTtlSec?: unknown;
  };
  if (body.schemaVersion !== 1) return null;
  if (body.status === 'unavailable') {
    return { schemaVersion: 1, status: 'unavailable' };
  }
  if (body.status !== 'ready') return null;
  if (!Array.isArray(body.instruments) || body.instruments.length === 0) {
    return null;
  }
  const instruments: FundingOiInstrument[] = [];
  for (const row of body.instruments) {
    const parsed = parseInstrument(row);
    if (!parsed) return null;
    instruments.push(parsed);
  }
  if (!Array.isArray(body.venues) || body.venues.length === 0) return null;
  const venues: FundingOiVenue[] = [];
  for (const venue of body.venues) {
    if (typeof venue !== 'string' || !VENUES.has(venue)) return null;
    venues.push(venue as FundingOiVenue);
  }
  if (
    typeof body.fetchedAtMs !== 'number' ||
    !Number.isFinite(body.fetchedAtMs)
  ) {
    return null;
  }
  if (typeof body.cacheTtlSec !== 'number' || body.cacheTtlSec < 1800) {
    return null;
  }
  return {
    schemaVersion: 1,
    status: 'ready',
    instruments,
    venues,
    fetchedAtMs: body.fetchedAtMs,
    cacheTtlSec: body.cacheTtlSec,
  };
}

function parseInstrument(raw: unknown): FundingOiInstrument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as {
    asset?: unknown;
    fundingRate?: unknown;
    openInterestUsd?: unknown;
    observedAtMs?: unknown;
    venue?: unknown;
  };
  if (typeof row.asset !== 'string' || !ASSETS.has(row.asset)) return null;
  if (
    typeof row.fundingRate !== 'number' ||
    !Number.isFinite(row.fundingRate) ||
    Math.abs(row.fundingRate) > FUNDING_OI_MAX_ABS_RATE
  ) {
    return null;
  }
  let openInterestUsd: number | null = null;
  if (row.openInterestUsd != null) {
    if (
      typeof row.openInterestUsd !== 'number' ||
      !Number.isFinite(row.openInterestUsd) ||
      row.openInterestUsd <= 0
    ) {
      return null;
    }
    openInterestUsd = row.openInterestUsd;
  }
  if (
    typeof row.observedAtMs !== 'number' ||
    !Number.isFinite(row.observedAtMs)
  ) {
    return null;
  }
  if (typeof row.venue !== 'string' || !VENUES.has(row.venue)) return null;
  return {
    asset: row.asset as FundingOiAsset,
    fundingRate: row.fundingRate,
    openInterestUsd,
    observedAtMs: row.observedAtMs,
    venue: row.venue as FundingOiVenue,
  };
}

export async function fetchFundingOi(
  args: FetchFundingOiArgs = {},
): Promise<FetchFundingOiResult> {
  const nowMs = args.nowMs ?? Date.now();
  const cache = args.cache ?? defaultCache;
  const cached = cache.get(nowMs);
  if (cached) return { ok: true, snapshot: cached };
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false };
  try {
    const response = await (args.fetchImpl ?? fetch)(
      `${base}/v1/review/funding-oi`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: args.signal,
      },
    );
    if (!response.ok) return { ok: false };
    const snapshot = parseSnapshot(await response.json());
    if (!snapshot) return { ok: false };
    cache.set(snapshot, nowMs);
    return { ok: true, snapshot };
  } catch {
    return { ok: false };
  }
}
