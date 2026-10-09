import type { PublicAppConfig } from '@/src/lib/apiConfig';
import { usdcMintForCluster } from './usdcConstants';

export type UsdcBalanceClientErrorCode =
  | 'missing_api_url'
  | 'invalid_request'
  | 'network'
  | 'schema'
  | 'rate_limited'
  | 'forbidden'
  | 'unconfigured'
  | 'unreadable'
  | 'http'
  | 'cluster_mismatch'
  | 'mint_mismatch';

export type FetchUsdcBalanceSuccess = {
  ok: true;
  atomic: bigint;
  cluster: PublicAppConfig['cluster'];
  mint: string;
};

export type FetchUsdcBalanceFailure = {
  ok: false;
  code: UsdcBalanceClientErrorCode;
  httpStatus?: number;
};

export type FetchUsdcBalanceResult =
  | FetchUsdcBalanceSuccess
  | FetchUsdcBalanceFailure;

export type FetchUsdcBalanceArgs = {
  address: string;
  cluster: PublicAppConfig['cluster'];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
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

/**
 * Atomic amounts are decimal strings on the wire: a plausible balance exceeds
 * `Number.MAX_SAFE_INTEGER` and JSON has no integer type that survives it.
 * Anything that is not a non-negative integer string is refused — a balance
 * that does not parse is unknown, not zero.
 */
export function parseAtomicFromApi(raw: unknown): bigint | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function fetchUsdcBalanceViaApi(
  args: FetchUsdcBalanceArgs,
): Promise<FetchUsdcBalanceResult> {
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (base === null) return { ok: false, code: 'missing_api_url' };

  const url = `${base}/v1/balances/usdc?${new URLSearchParams({
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
    mint?: unknown;
    decimals?: unknown;
    atomic?: unknown;
  };

  if (body.cluster !== 'devnet' && body.cluster !== 'mainnet-beta') {
    return { ok: false, code: 'cluster_mismatch' };
  }
  if (body.cluster !== args.cluster) {
    return { ok: false, code: 'cluster_mismatch' };
  }

  if (typeof body.mint !== 'string' || body.mint !== usdcMintForCluster(args.cluster)) {
    return { ok: false, code: 'mint_mismatch' };
  }

  if (body.decimals !== 6) return { ok: false, code: 'schema' };

  const atomic = parseAtomicFromApi(body.atomic);
  if (atomic === null) return { ok: false, code: 'schema' };

  return { ok: true, atomic, cluster: body.cluster, mint: body.mint };
}
