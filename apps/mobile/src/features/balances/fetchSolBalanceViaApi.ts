import type { PublicAppConfig } from '@/src/lib/apiConfig';

export type SolBalanceClientErrorCode =
  | 'missing_api_url'
  | 'invalid_request'
  | 'network'
  | 'schema'
  | 'rate_limited'
  | 'forbidden'
  | 'unconfigured'
  | 'unreadable'
  | 'http'
  | 'cluster_mismatch';

export type FetchSolBalanceSuccess = {
  ok: true;
  lamports: number;
  cluster: PublicAppConfig['cluster'];
};

export type FetchSolBalanceFailure = {
  ok: false;
  code: SolBalanceClientErrorCode;
  httpStatus?: number;
};

export type FetchSolBalanceResult =
  | FetchSolBalanceSuccess
  | FetchSolBalanceFailure;

export type FetchSolBalanceArgs = {
  address: string;
  cluster: PublicAppConfig['cluster'];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

export function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function parseLamportsFromApi(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

export async function fetchSolBalanceViaApi(
  args: FetchSolBalanceArgs,
): Promise<FetchSolBalanceResult> {
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (base === null) return { ok: false, code: 'missing_api_url' };

  const url = `${base}/v1/balances/sol?${new URLSearchParams({
    address: args.address,
  }).toString()}`;

  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(url, {
      method: 'GET',
      ...(args.signal ? { signal: args.signal } : {}),
      // Native-only contract: never attach Origin.
      headers: { accept: 'application/json' },
    });
  } catch {
    return { ok: false, code: 'network' };
  }

  if (response.status === 429) {
    return { ok: false, code: 'rate_limited', httpStatus: 429 };
  }
  if (response.status === 403) {
    return { ok: false, code: 'forbidden', httpStatus: 403 };
  }
  if (response.status === 400) {
    return { ok: false, code: 'invalid_request', httpStatus: 400 };
  }
  if (response.status === 503) {
    return { ok: false, code: 'unconfigured', httpStatus: 503 };
  }
  if (response.status === 502 || response.status === 504) {
    return { ok: false, code: 'unreadable', httpStatus: response.status };
  }
  if (!response.ok) {
    return { ok: false, code: 'http', httpStatus: response.status };
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, code: 'schema' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, code: 'schema' };

  const body = raw as {
    cluster?: unknown;
    decimals?: unknown;
    atomic?: unknown;
  };

  if (body.cluster !== 'devnet' && body.cluster !== 'mainnet-beta') {
    return { ok: false, code: 'cluster_mismatch' };
  }
  if (body.cluster !== args.cluster) {
    return { ok: false, code: 'cluster_mismatch' };
  }

  // Native SOL is 9 decimals. A response claiming otherwise is not describing
  // the asset this function is typed for.
  if (body.decimals !== 9) return { ok: false, code: 'schema' };

  const lamports = parseLamportsFromApi(body.atomic);
  if (lamports === null) return { ok: false, code: 'schema' };

  return { ok: true, lamports, cluster: body.cluster };
}
