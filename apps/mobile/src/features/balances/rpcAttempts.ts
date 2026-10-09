import { scrubProviderErrorMessage } from '@/src/lib/analyticsScrub';

/**
 * How one RPC refused. Deliberately the same vocabulary `fetchPrices` uses for
 * the BFF (`rate_limited` / `forbidden` / `http` / `network`) so the two
 * network surfaces classify failures the same way.
 */
export type RpcFailureCode =
  | 'rate_limited'
  | 'forbidden'
  | 'not_found'
  | 'server_error'
  | 'http'
  | 'rpc_error'
  | 'network'
  | 'rejected'
  | 'unknown'
  /** The API is reachable but has no RPC configured (503). */
  | 'unconfigured'
  /** The API reached its RPC and refused to read the answer (502/504). */
  | 'unreadable'
  | 'cluster_mismatch'
  | 'mint_mismatch';

export type RpcAttemptFailure = {
  /** Origin only — never path, query or userinfo. See module note. */
  url: string;
  code: RpcFailureCode;
  /** HTTP status when one could be recovered from the provider error. */
  httpStatus?: number;
  /** JSON-RPC error code when the provider answered with one. */
  rpcCode?: number;
};

const UNKNOWN_ORIGIN = 'unknown-rpc-origin';

export function redactRpcUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return UNKNOWN_ORIGIN;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return UNKNOWN_ORIGIN;
    }
    // `origin` is scheme + host + port, and excludes userinfo/path/query.
    const origin = parsed.origin;
    if (!origin || origin === 'null') return UNKNOWN_ORIGIN;
    return origin;
  } catch {
    return UNKNOWN_ORIGIN;
  }
}

/** Own-data-property read only — never invokes getters or proxy traps. */
function ownNumber(value: unknown, key: string): number | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc || !('value' in desc)) return undefined;
    return typeof desc.value === 'number' && Number.isFinite(desc.value)
      ? desc.value
      : undefined;
  } catch {
    return undefined;
  }
}

function codeForHttpStatus(status: number): RpcFailureCode {
  if (status === 429) return 'rate_limited';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'http';
}

export function classifyRpcFailure(error: unknown): {
  code: RpcFailureCode;
  httpStatus?: number;
  rpcCode?: number;
} {
  // Our own fail-closed shape rejection, thrown by fetchUsdcBalance.
  const scrubbed = scrubProviderErrorMessage(error);
  if (scrubbed.startsWith('USDC balance rejected:')) {
    return { code: 'rejected' };
  }

  // `${res.status} ${res.statusText}: ${body}` — take the status, drop the rest.
  const httpMatch = /^(\d{3})\s/.exec(scrubbed);
  if (httpMatch) {
    const status = Number(httpMatch[1]);
    if (status >= 100 && status <= 599) {
      return { code: codeForHttpStatus(status), httpStatus: status };
    }
  }

  // SolanaJSONRPCError carries a numeric JSON-RPC `code` as an own property.
  const rpcCode = ownNumber(error, 'code');
  if (rpcCode !== undefined) return { code: 'rpc_error', rpcCode };

  if (scrubbed.length > 0) return { code: 'network' };
  return { code: 'unknown' };
}

/** One attempt rendered as `origin (code status)` — no provider text. */
export function formatRpcAttemptFailure(failure: RpcAttemptFailure): string {
  const parts: string[] = [failure.code];
  if (failure.httpStatus !== undefined) parts.push(`HTTP ${failure.httpStatus}`);
  if (failure.rpcCode !== undefined) parts.push(`JSON-RPC ${failure.rpcCode}`);
  return `${failure.url} (${parts.join(' ')})`;
}

/**
 * The aggregated failure. Carries every attempt, in the order tried.
 *
 * ⚠️ `attempts` is the machine-readable half and the message is the human
 * half; both name every URL, so neither can quietly report only the last one.
 */
export class RpcAttemptsError extends Error {
  readonly attempts: readonly RpcAttemptFailure[];

  constructor(operation: string, attempts: readonly RpcAttemptFailure[]) {
    const summary =
      attempts.length === 0
        ? 'no RPC URLs configured'
        : attempts.map(formatRpcAttemptFailure).join('; ');
    super(`${operation} failed on ${attempts.length} RPC(s): ${summary}`);
    this.name = 'RpcAttemptsError';
    this.attempts = attempts;
  }
}

export async function readFromRpcUrls<T>(
  operation: string,
  rpcUrls: readonly string[],
  read: (rpcUrl: string) => Promise<T>,
): Promise<T> {
  const result = await readAttemptFromRpcUrls(rpcUrls, read);
  if (result.ok) return result.value;
  throw new RpcAttemptsError(operation, result.attempts);
}

export async function readAttemptFromRpcUrls<T>(
  rpcUrls: readonly string[],
  read: (rpcUrl: string) => Promise<T>,
): Promise<
  { ok: true; value: T } | { ok: false; attempts: RpcAttemptFailure[] }
> {
  const attempts: RpcAttemptFailure[] = [];

  for (const rpcUrl of rpcUrls) {
    try {
      return { ok: true, value: await read(rpcUrl) };
    } catch (error) {
      attempts.push({
        url: redactRpcUrl(rpcUrl),
        ...classifyRpcFailure(error),
      });
    }
  }

  return { ok: false, attempts };
}
