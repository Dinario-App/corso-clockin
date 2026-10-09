import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import { parseChartBundle } from './parseChartBundle';
import {
  isSignalTimeframe,
  type ChartBundle,
  type SignalTimeframe,
} from './types';

export type FetchChartBundleResult =
  | { ok: true; bundle: ChartBundle }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'invalid_request'
        | 'missing_api_url'
        | 'network'
        | 'aborted'
        | 'http'
        | 'rate_limited'
        | 'schema'
        | 'unsupported_network'
        | 'no_data'
        /** Valid timeframe the server cannot compute natively yet (plan 09b). */
        | 'timeframe_not_computed'
        | 'unavailable';
      httpStatus?: number;
      retryAfterSec?: number;
    };

export type FetchChartBundleArgs = {
  mint: string;
  timeframe: SignalTimeframe;
  /** Kill switch from public config (`flags.signalsEnabled`). */
  signalsEnabled: boolean;
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
  return raw ? raw.replace(/\/$/, '') : null;
}

function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const seconds = Number(trimmed);
  return Number.isInteger(seconds) && seconds > 0 ? seconds : undefined;
}

export function buildChartBundleUrl(args: {
  base: string;
  mint: string;
  timeframe: SignalTimeframe;
}): string {
  const params = new URLSearchParams({
    mint: args.mint,
    timeframe: args.timeframe,
  });
  return `${args.base}/v1/chart-bundle?${params.toString()}`;
}

export async function fetchChartBundle(
  args: FetchChartBundleArgs,
): Promise<FetchChartBundleResult> {
  if (!args.signalsEnabled) return { ok: false, code: 'disabled' };
  if (
    !isValidPriceMint(args.mint, 'mainnet-beta') ||
    !isSignalTimeframe(args.timeframe)
  ) {
    return { ok: false, code: 'invalid_request' };
  }
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };

  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(
      buildChartBundleUrl({ base, mint: args.mint, timeframe: args.timeframe }),
      {
        method: 'GET',
        signal: args.signal,
        headers: { accept: 'application/json' },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      return { ok: false, code: 'aborted' };
    return { ok: false, code: 'network' };
  }

  if (response.status === 429) {
    return {
      ok: false,
      code: 'rate_limited',
      httpStatus: 429,
      retryAfterSec: parseRetryAfterSeconds(
        response.headers.get('retry-after'),
      ),
    };
  }
  if (response.status === 503)
    return { ok: false, code: 'disabled', httpStatus: 503 };
  if (!response.ok)
    return { ok: false, code: 'http', httpStatus: response.status };

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, code: 'schema' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { ok: false, code: 'schema' };
  const body = raw as Record<string, unknown>;
  if (body.ok === false) {
    const reason = body.reason;
    if (reason === 'unsupported_network')
      return { ok: false, code: 'unsupported_network' };
    if (reason === 'no_data') return { ok: false, code: 'no_data' };
    if (reason === 'timeframe_not_computed')
      return { ok: false, code: 'timeframe_not_computed' };
    return { ok: false, code: 'unavailable' };
  }
  const bundle = parseChartBundle(body);
  if (
    !bundle ||
    bundle.mint !== args.mint ||
    bundle.timeframe !== args.timeframe
  ) {
    return { ok: false, code: 'schema' };
  }
  return { ok: true, bundle };
}
