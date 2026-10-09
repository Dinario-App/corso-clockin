import {
  EDGAR_FORM_CODES,
  FILINGS_CLIENT_CACHE_TTL_MS,
  type EdgarFormCode,
  type FilingLink,
  type FilingsResponse,
} from './types';

export type FetchFilingsSuccess = {
  ok: true;
  snapshot: FilingsResponse;
};

export type FetchFilingsFailure = {
  ok: false;
};

export type FetchFilingsResult = FetchFilingsSuccess | FetchFilingsFailure;

export type FilingsClientCache = {
  get(mint: string, nowMs: number): FilingsResponse | null;
  set(mint: string, snapshot: FilingsResponse, storedAtMs: number): void;
};

const FORM_CODES = new Set<string>(EDGAR_FORM_CODES);

export function createFilingsClientCache(): FilingsClientCache {
  const entries = new Map<
    string,
    { snapshot: FilingsResponse; storedAtMs: number }
  >();
  return {
    get(mint, nowMs) {
      const entry = entries.get(mint);
      if (!entry) return null;
      if (nowMs - entry.storedAtMs > FILINGS_CLIENT_CACHE_TTL_MS) {
        entries.delete(mint);
        return null;
      }
      return entry.snapshot;
    },
    set(mint, snapshot, storedAtMs) {
      if (snapshot.status !== 'ready') return;
      entries.set(mint, { snapshot, storedAtMs });
    },
  };
}

const defaultCache = createFilingsClientCache();

export type FetchFilingsArgs = {
  mint: string;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  nowMs?: number;
  cache?: FilingsClientCache;
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

function parseFiling(raw: unknown): FilingLink | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as {
    form?: unknown;
    title?: unknown;
    filer?: unknown;
    filedOn?: unknown;
    href?: unknown;
  };
  if (typeof row.form !== 'string' || !FORM_CODES.has(row.form)) return null;
  if (row.title !== 'Form 4' && row.title !== 'Form 13F') return null;
  if (typeof row.filer !== 'string' || row.filer.length === 0) return null;
  if (
    typeof row.filedOn !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.filedOn)
  ) {
    return null;
  }
  if (
    typeof row.href !== 'string' ||
    !row.href.startsWith('https://www.sec.gov/Archives/edgar/data/')
  ) {
    return null;
  }
  return {
    form: row.form as EdgarFormCode,
    title: row.title,
    filer: row.filer,
    filedOn: row.filedOn,
    href: row.href,
  };
}

function parseSnapshot(raw: unknown): FilingsResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as {
    schemaVersion?: unknown;
    status?: unknown;
    mint?: unknown;
    ticker?: unknown;
    cik?: unknown;
    issuer?: unknown;
    filings?: unknown;
    fetchedAtMs?: unknown;
    cacheTtlSec?: unknown;
  };
  if (body.schemaVersion !== 1) return null;
  if (body.status === 'unmapped')
    return { schemaVersion: 1, status: 'unmapped' };
  if (body.status === 'unavailable')
    return { schemaVersion: 1, status: 'unavailable' };
  if (body.status !== 'ready') return null;
  if (typeof body.mint !== 'string' || typeof body.ticker !== 'string')
    return null;
  if (typeof body.cik !== 'string' || typeof body.issuer !== 'string')
    return null;
  if (
    !Array.isArray(body.filings) ||
    body.filings.length === 0 ||
    body.filings.length > 2
  ) {
    return null;
  }
  const filings: FilingLink[] = [];
  for (const row of body.filings) {
    const filing = parseFiling(row);
    if (!filing) return null;
    filings.push(filing);
  }
  if (
    typeof body.fetchedAtMs !== 'number' ||
    !Number.isFinite(body.fetchedAtMs)
  ) {
    return null;
  }
  if (typeof body.cacheTtlSec !== 'number' || body.cacheTtlSec < 6 * 60 * 60) {
    return null;
  }
  return {
    schemaVersion: 1,
    status: 'ready',
    mint: body.mint,
    ticker: body.ticker,
    cik: body.cik,
    issuer: body.issuer,
    filings,
    fetchedAtMs: body.fetchedAtMs,
    cacheTtlSec: body.cacheTtlSec,
  };
}

export async function fetchFilings(
  args: FetchFilingsArgs,
): Promise<FetchFilingsResult> {
  const nowMs = args.nowMs ?? Date.now();
  const cache = args.cache ?? defaultCache;
  const cached = cache.get(args.mint, nowMs);
  if (cached) return { ok: true, snapshot: cached };
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false };
  try {
    const response = await (args.fetchImpl ?? fetch)(
      `${base}/v1/review/filings?mint=${encodeURIComponent(args.mint)}`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: args.signal,
      },
    );
    if (!response.ok) return { ok: false };
    const snapshot = parseSnapshot(await response.json());
    if (!snapshot) return { ok: false };
    cache.set(args.mint, snapshot, nowMs);
    return { ok: true, snapshot };
  } catch {
    return { ok: false };
  }
}
