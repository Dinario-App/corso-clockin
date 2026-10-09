import {
  FEAR_GREED_ATTRIBUTION,
  FEAR_GREED_CLASSIFICATIONS,
  FEAR_GREED_CLIENT_CACHE_TTL_MS,
  FEAR_GREED_CLIENT_NEGATIVE_CACHE_TTL_MS,
  type FearGreedClassification,
  type FearGreedResponse,
} from './types';

export type FetchFearGreedSuccess = {
  ok: true;
  snapshot: FearGreedResponse;
};

export type FetchFearGreedFailure = {
  ok: false;
};

export type FetchFearGreedResult =
  | FetchFearGreedSuccess
  | FetchFearGreedFailure;

export type FearGreedClientCache = {
  get(nowMs: number): FearGreedResponse | null;
  set(snapshot: FearGreedResponse, storedAtMs: number): void;
};

const CLASSIFICATIONS = new Set<string>(FEAR_GREED_CLASSIFICATIONS);

export function createFearGreedClientCache(): FearGreedClientCache {
  let entry: {
    snapshot: FearGreedResponse;
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
            ? FEAR_GREED_CLIENT_CACHE_TTL_MS
            : FEAR_GREED_CLIENT_NEGATIVE_CACHE_TTL_MS,
      };
    },
  };
}

const defaultCache = createFearGreedClientCache();

export type FetchFearGreedArgs = {
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  nowMs?: number;
  cache?: FearGreedClientCache;
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

function parseSnapshot(raw: unknown): FearGreedResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as {
    schemaVersion?: unknown;
    status?: unknown;
    value?: unknown;
    classification?: unknown;
    observedAtMs?: unknown;
    fetchedAtMs?: unknown;
    attribution?: unknown;
    cacheTtlSec?: unknown;
  };
  if (body.schemaVersion !== 1) return null;
  if (body.status === 'unavailable') {
    return { schemaVersion: 1, status: 'unavailable' };
  }
  if (body.status !== 'ready') return null;
  if (
    !Number.isInteger(body.value) ||
    (body.value as number) < 0 ||
    (body.value as number) > 100
  ) {
    return null;
  }
  if (
    typeof body.classification !== 'string' ||
    !CLASSIFICATIONS.has(body.classification)
  ) {
    return null;
  }
  if (
    typeof body.observedAtMs !== 'number' ||
    !Number.isFinite(body.observedAtMs)
  ) {
    return null;
  }
  if (
    typeof body.fetchedAtMs !== 'number' ||
    !Number.isFinite(body.fetchedAtMs)
  ) {
    return null;
  }
  if (body.attribution !== FEAR_GREED_ATTRIBUTION) return null;
  if (typeof body.cacheTtlSec !== 'number' || body.cacheTtlSec < 3600) {
    return null;
  }
  return {
    schemaVersion: 1,
    status: 'ready',
    value: body.value as number,
    classification: body.classification as FearGreedClassification,
    observedAtMs: body.observedAtMs,
    fetchedAtMs: body.fetchedAtMs,
    attribution: FEAR_GREED_ATTRIBUTION,
    cacheTtlSec: body.cacheTtlSec,
  };
}

export async function fetchFearGreed(
  args: FetchFearGreedArgs = {},
): Promise<FetchFearGreedResult> {
  const nowMs = args.nowMs ?? Date.now();
  const cache = args.cache ?? defaultCache;
  const cached = cache.get(nowMs);
  if (cached) return { ok: true, snapshot: cached };
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false };
  try {
    const response = await (args.fetchImpl ?? fetch)(
      `${base}/v1/review/fear-greed`,
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
