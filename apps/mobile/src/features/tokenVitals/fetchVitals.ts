import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import { parseVitalsPayload } from './parseVitals';
import {
  VITALS_SECTIONS,
  type TimeframeId,
  type VitalsPayload,
  type VitalsSection,
} from './types';

export type FetchVitalsResult =
  | { ok: true; vitals: VitalsPayload }
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
        | 'not_found';
      httpStatus?: number;
      retryAfterSec?: number;
    };

export type FetchVitalsArgs = {
  mint: string;
  timeframe: TimeframeId;
  sections?: readonly VitalsSection[];
  /** Kill switch from public config (`flags.signalsEnabled`). */
  tokenVitalsEnabled: boolean;
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

export function buildVitalsUrl(args: {
  base: string;
  mint: string;
  timeframe: TimeframeId;
  sections?: readonly VitalsSection[];
}): string {
  const params = new URLSearchParams({ timeframe: args.timeframe });
  if (args.sections && args.sections.length > 0) {
    params.set('sections', [...new Set(args.sections)].join(','));
  }
  return `${args.base}/v1/tokens/${encodeURIComponent(args.mint)}/vitals?${params.toString()}`;
}

export async function fetchVitals(
  args: FetchVitalsArgs,
): Promise<FetchVitalsResult> {
  if (!args.tokenVitalsEnabled) return { ok: false, code: 'disabled' };
  if (
    !isValidPriceMint(args.mint, 'mainnet-beta') ||
    (args.sections &&
      !args.sections.every((s) =>
        (VITALS_SECTIONS as readonly string[]).includes(s),
      ))
  ) {
    return { ok: false, code: 'invalid_request' };
  }
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };

  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(
      buildVitalsUrl({
        base,
        mint: args.mint,
        timeframe: args.timeframe,
        sections: args.sections,
      }),
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
  if (response.status === 404) {
    return { ok: false, code: 'not_found', httpStatus: 404 };
  }
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
    return {
      ok: false,
      code:
        body.reason === 'unsupported_network'
          ? 'unsupported_network'
          : 'not_found',
    };
  }
  if (body.ok !== true) return { ok: false, code: 'schema' };
  const vitals = parseVitalsPayload(body.vitals);
  if (!vitals || vitals.token.mint !== args.mint)
    return { ok: false, code: 'schema' };
  return { ok: true, vitals };
}
