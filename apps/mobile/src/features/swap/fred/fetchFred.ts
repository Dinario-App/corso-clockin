import {
  FRED_ATTRIBUTION_NOTICE,
  FRED_CLIENT_CACHE_TTL_MS,
  FRED_CLIENT_NEGATIVE_TTL_MS,
  FRED_SECONDARY_SERIES,
  type FredFed,
  type FredResponse,
  type FredSecondary,
  type FredSecondaryId,
} from './types';

export type FetchFredSuccess = {
  ok: true;
  snapshot: FredResponse;
};

export type FetchFredFailure = {
  ok: false;
};

export type FetchFredResult = FetchFredSuccess | FetchFredFailure;

export type FredClientCache = {
  get(nowMs: number): FredResponse | null;
  set(snapshot: FredResponse, storedAtMs: number): void;
};

const SECONDARIES = new Set<string>(FRED_SECONDARY_SERIES);

export function createFredClientCache(): FredClientCache {
  let entry: {
    snapshot: FredResponse;
    storedAtMs: number;
    ttlMs: number;
  } | null = null;
  return {
    get(nowMs) {
      if (!entry) return null;
      if (nowMs < entry.storedAtMs) return null;
      if (nowMs - entry.storedAtMs > entry.ttlMs) {
        entry = null;
        return null;
      }
      return entry.snapshot;
    },
    set(snapshot, storedAtMs) {
      entry = {
        snapshot,
        storedAtMs,
        ttlMs:
          snapshot.status === 'ready'
            ? Math.min(snapshot.cacheTtlSec * 1000, FRED_CLIENT_CACHE_TTL_MS)
            : FRED_CLIENT_NEGATIVE_TTL_MS,
      };
    },
  };
}

const defaultCache = createFredClientCache();

export type FetchFredArgs = {
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  nowMs?: number;
  cache?: FredClientCache;
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

function parseFed(raw: unknown): FredFed | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as {
    kind?: unknown;
    lower?: unknown;
    upper?: unknown;
    value?: unknown;
    observedOn?: unknown;
    observedAtMs?: unknown;
  };
  if (
    typeof body.observedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.observedOn)
  ) {
    return null;
  }
  if (
    typeof body.observedAtMs !== 'number' ||
    !Number.isFinite(body.observedAtMs)
  ) {
    return null;
  }
  if (body.kind === 'target-range') {
    if (typeof body.lower !== 'number' || typeof body.upper !== 'number')
      return null;
    if (!Number.isFinite(body.lower) || !Number.isFinite(body.upper))
      return null;
    if (body.lower > body.upper) return null;
    return {
      kind: 'target-range',
      lower: body.lower,
      upper: body.upper,
      observedOn: body.observedOn,
      observedAtMs: body.observedAtMs,
    };
  }
  if (body.kind === 'effective') {
    if (typeof body.value !== 'number' || !Number.isFinite(body.value))
      return null;
    return {
      kind: 'effective',
      value: body.value,
      observedOn: body.observedOn,
      observedAtMs: body.observedAtMs,
    };
  }
  return null;
}

function parseSecondary(raw: unknown): FredSecondary | null {
  if (raw == null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as {
    seriesId?: unknown;
    value?: unknown;
    previousValue?: unknown;
    changeRatio?: unknown;
    observedOn?: unknown;
    observedAtMs?: unknown;
  };
  if (typeof body.seriesId !== 'string' || !SECONDARIES.has(body.seriesId))
    return null;
  if (typeof body.value !== 'number' || !Number.isFinite(body.value))
    return null;
  if (
    body.previousValue != null &&
    (typeof body.previousValue !== 'number' ||
      !Number.isFinite(body.previousValue))
  ) {
    return null;
  }
  if (
    body.changeRatio != null &&
    (typeof body.changeRatio !== 'number' || !Number.isFinite(body.changeRatio))
  ) {
    return null;
  }
  if (
    typeof body.observedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.observedOn)
  ) {
    return null;
  }
  if (
    typeof body.observedAtMs !== 'number' ||
    !Number.isFinite(body.observedAtMs)
  ) {
    return null;
  }
  return {
    seriesId: body.seriesId as FredSecondaryId,
    value: body.value,
    previousValue: body.previousValue ?? null,
    changeRatio: body.changeRatio ?? null,
    observedOn: body.observedOn,
    observedAtMs: body.observedAtMs,
  };
}

function parseSnapshot(raw: unknown): FredResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as {
    schemaVersion?: unknown;
    status?: unknown;
    fetchedAtMs?: unknown;
    attribution?: unknown;
    cacheTtlSec?: unknown;
    fed?: unknown;
    secondary?: unknown;
  };
  if (body.schemaVersion !== 1) return null;
  if (body.status === 'unavailable') {
    return { schemaVersion: 1, status: 'unavailable' };
  }
  if (body.status !== 'ready') return null;
  if (body.attribution !== FRED_ATTRIBUTION_NOTICE) return null;
  if (typeof body.cacheTtlSec !== 'number' || body.cacheTtlSec < 3600)
    return null;
  if (
    typeof body.fetchedAtMs !== 'number' ||
    !Number.isFinite(body.fetchedAtMs)
  ) {
    return null;
  }
  const fed = parseFed(body.fed);
  if (!fed) return null;
  if (body.secondary != null) {
    const secondary = parseSecondary(body.secondary);
    if (!secondary) return null;
    return {
      schemaVersion: 1,
      status: 'ready',
      fetchedAtMs: body.fetchedAtMs,
      attribution: FRED_ATTRIBUTION_NOTICE,
      cacheTtlSec: body.cacheTtlSec,
      fed,
      secondary,
    };
  }
  return {
    schemaVersion: 1,
    status: 'ready',
    fetchedAtMs: body.fetchedAtMs,
    attribution: FRED_ATTRIBUTION_NOTICE,
    cacheTtlSec: body.cacheTtlSec,
    fed,
    secondary: null,
  };
}

export async function fetchFred(
  args: FetchFredArgs = {},
): Promise<FetchFredResult> {
  const nowMs = args.nowMs ?? Date.now();
  const cache = args.cache ?? defaultCache;
  const cached = cache.get(nowMs);
  if (cached) return { ok: true, snapshot: cached };
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false };
  try {
    const response = await (args.fetchImpl ?? fetch)(`${base}/v1/review/fred`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: args.signal,
    });
    if (!response.ok) return { ok: false };
    const snapshot = parseSnapshot(await response.json());
    if (!snapshot) return { ok: false };
    cache.set(snapshot, nowMs);
    return { ok: true, snapshot };
  } catch {
    return { ok: false };
  }
}
