import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import { buildDisabledTokenFacts } from '@/src/features/tokenFacts/buildDisabledTokenFacts';
import { parseTokenFactsResponse } from '@/src/features/tokenFacts/parseTokenFacts';
import type { TokenFactsResponse } from '@/src/features/tokenFacts/types';

export type TokenFactsClientErrorCode =
  | 'missing_api_url'
  | 'invalid_request'
  | 'network'
  | 'schema'
  | 'rate_limited'
  | 'forbidden'
  | 'http';

export type FetchTokenFactsSuccess = {
  ok: true;
  facts: TokenFactsResponse;
};

export type FetchTokenFactsFailure = {
  ok: false;
  code: TokenFactsClientErrorCode;
  message: string;
  httpStatus?: number;
  retryAfterSec?: number;
};

export type FetchTokenFactsResult =
  | FetchTokenFactsSuccess
  | FetchTokenFactsFailure;

export type FetchTokenFactsArgs = {
  mint: string;
  cluster: PriceCluster;
  /**
   * Kill switch from public config (`flags.tokenFactsEnabled`).
   * When false, skip network and return a disabled facts payload.
   */
  tokenFactsEnabled: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  nowMs?: number;
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

/** Trim + reject empty mint before any network I/O. */
export function normalizeTokenFactsMint(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse Retry-After as delta-seconds only (same contract as prices client).
 */
export function parseRetryAfterSeconds(value: string | null): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const seconds = Number(trimmed);
  if (!Number.isInteger(seconds) || seconds <= 0) return null;
  return seconds;
}

/**
 * Fetch TokenFacts from pulse-api. Does not retry on 429/5xx/network.
 */
export async function fetchTokenFacts(
  args: FetchTokenFactsArgs,
): Promise<FetchTokenFactsResult> {
  const nowMs = args.nowMs ?? Date.now();
  const mint = normalizeTokenFactsMint(args.mint);
  if (mint == null) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'Mint is required.',
    };
  }

  const cluster = args.cluster;

  if (!args.tokenFactsEnabled) {
    return {
      ok: true,
      facts: buildDisabledTokenFacts({ mint, cluster, nowMs }),
    };
  }

  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) {
    return {
      ok: false,
      code: 'missing_api_url',
      message: 'Token facts API URL is not configured.',
    };
  }

  const params = new URLSearchParams({ cluster });
  const url = `${base}/v1/tokens/${encodeURIComponent(mint)}/facts?${params.toString()}`;
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'GET',
      signal: args.signal,
      headers: { accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        ok: false,
        code: 'network',
        message: 'Token facts request was cancelled.',
      };
    }
    return {
      ok: false,
      code: 'network',
      message: 'Could not reach the token facts service.',
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      code: 'rate_limited',
      message: 'Too many token facts requests. Try again shortly.',
      httpStatus: 429,
      retryAfterSec:
        parseRetryAfterSeconds(response.headers.get('retry-after')) ?? undefined,
    };
  }

  if (response.status === 403) {
    return {
      ok: false,
      code: 'forbidden',
      message: 'Token facts requests are accepted only from the native app.',
      httpStatus: 403,
    };
  }

  if (response.status === 400) {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'Token facts request was rejected.',
      httpStatus: 400,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      code: 'http',
      message: 'Token facts service is temporarily unavailable.',
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
      message: 'Token facts response was not valid JSON.',
      httpStatus: response.status,
    };
  }

  const facts = parseTokenFactsResponse(raw, { mint, cluster });
  if (!facts) {
    return {
      ok: false,
      code: 'schema',
      message: 'Token facts response failed schema validation.',
      httpStatus: response.status,
    };
  }

  return { ok: true, facts };
}
