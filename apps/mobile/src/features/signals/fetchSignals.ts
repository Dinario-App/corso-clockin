import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import {
  CHART_BUNDLE_SOURCES,
  CONFLUENCE_BANDS,
  SIGNAL_KINDS,
  isSignalTimeframe,
  type ChartBundleSource,
  type ConfluenceBand,
  type ConfluenceScore,
  type SignalKind,
  type SignalTimeframe,
} from './types';

export type SignalDirection = 'bullish' | 'bearish' | 'neutral';

export const SIGNAL_DIRECTIONS = [
  'bullish',
  'bearish',
  'neutral',
] as const satisfies readonly SignalDirection[];

export type SignalEvent = {
  kind: SignalKind;
  direction: SignalDirection;
  timeframe: SignalTimeframe;
  barCloseMs: number;
  priceLevel?: string;
  zone?: { top: string; bottom: string };
  confidence: number;
  labelKey: string;
  labelParams?: Record<string, string | number>;
};

export type SignalsPayload = {
  mint: string;
  timeframe: SignalTimeframe;
  asOfMs: number;
  source: ChartBundleSource;
  confluence: ConfluenceScore;
  signals: SignalEvent[];
  degraded: SignalKind[];
};

export type FetchSignalsResult =
  | { ok: true; payload: SignalsPayload }
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
        | 'timeframe_not_computed'
        | 'unavailable';
      httpStatus?: number;
      retryAfterSec?: number;
    };

export type FetchSignalsArgs = {
  mint: string;
  timeframe: SignalTimeframe;
  /** Kill switch from public config (`flags.signalsEnabled`). */
  signalsEnabled: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

const DECIMAL = /^-?(?:\d+)(?:\.\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDecimalString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DECIMAL.test(value) &&
    Number.isFinite(Number(value))
  );
}

function isMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

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

export function buildSignalsUrl(args: {
  base: string;
  mint: string;
  timeframe: SignalTimeframe;
}): string {
  const params = new URLSearchParams({
    mint: args.mint,
    timeframe: args.timeframe,
  });
  return `${args.base}/v1/signals?${params.toString()}`;
}

function parseConfluence(raw: unknown): ConfluenceScore | null {
  if (!isRecord(raw)) return null;
  const { score, band, contributors } = raw;
  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100
  ) {
    return null;
  }
  if (
    typeof band !== 'string' ||
    !(CONFLUENCE_BANDS as readonly string[]).includes(band)
  ) {
    return null;
  }
  if (!Array.isArray(contributors)) return null;
  const parsed: ConfluenceScore['contributors'] = [];
  for (const item of contributors) {
    if (!isRecord(item)) return null;
    const { kind, weight, contribution } = item;
    if (
      typeof kind !== 'string' ||
      !(SIGNAL_KINDS as readonly string[]).includes(kind)
    ) {
      return null;
    }
    if (typeof weight !== 'number' || !Number.isFinite(weight)) return null;
    if (typeof contribution !== 'number' || !Number.isFinite(contribution)) {
      return null;
    }
    parsed.push({ kind: kind as SignalKind, weight, contribution });
  }
  return { score, band: band as ConfluenceBand, contributors: parsed };
}

function parseDegraded(raw: unknown): SignalKind[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SignalKind[] = [];
  for (const item of raw) {
    if (
      typeof item !== 'string' ||
      !(SIGNAL_KINDS as readonly string[]).includes(item)
    ) {
      return null;
    }
    out.push(item as SignalKind);
  }
  return out;
}

function parseLabelParams(
  raw: unknown,
): Record<string, string | number> | undefined | null {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) return null;
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    out[key] = value;
  }
  return out;
}

function parseEvent(raw: unknown): SignalEvent | null {
  if (!isRecord(raw)) return null;
  const {
    kind,
    direction,
    timeframe,
    barCloseMs,
    confidence,
    labelKey,
    priceLevel,
    zone,
    labelParams,
  } = raw;
  if (
    typeof kind !== 'string' ||
    !(SIGNAL_KINDS as readonly string[]).includes(kind)
  ) {
    return null;
  }
  if (
    typeof direction !== 'string' ||
    !(SIGNAL_DIRECTIONS as readonly string[]).includes(direction)
  ) {
    return null;
  }
  if (!isSignalTimeframe(timeframe)) return null;
  if (!isMs(barCloseMs)) return null;
  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return null;
  }
  if (typeof labelKey !== 'string' || labelKey.length === 0) return null;
  const event: SignalEvent = {
    kind: kind as SignalKind,
    direction: direction as SignalDirection,
    timeframe,
    barCloseMs,
    confidence,
    labelKey,
  };
  if (priceLevel !== undefined) {
    if (!isDecimalString(priceLevel)) return null;
    event.priceLevel = priceLevel;
  }
  if (zone !== undefined) {
    if (
      !isRecord(zone) ||
      !isDecimalString(zone.top) ||
      !isDecimalString(zone.bottom)
    ) {
      return null;
    }
    event.zone = { top: zone.top, bottom: zone.bottom };
  }
  const params = parseLabelParams(labelParams);
  if (params === null) return null;
  if (params !== undefined) event.labelParams = params;
  return event;
}

function parseSignals(raw: unknown): SignalEvent[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SignalEvent[] = [];
  for (const item of raw) {
    const event = parseEvent(item);
    if (!event) return null;
    out.push(event);
  }
  return out;
}

/**
 * Parse the `ok: true` body of `/v1/signals`. Returns `null` for anything
 * off-contract. The caller still checks `mint` / `timeframe` against the ask.
 */
export function parseSignalsPayload(raw: unknown): SignalsPayload | null {
  if (!isRecord(raw) || raw.ok !== true) return null;
  const { mint, timeframe, source, asOfMs } = raw;
  if (typeof mint !== 'string' || mint.length === 0) return null;
  if (!isSignalTimeframe(timeframe)) return null;
  if (
    typeof source !== 'string' ||
    !(CHART_BUNDLE_SOURCES as readonly string[]).includes(source)
  ) {
    return null;
  }
  if (!isMs(asOfMs)) return null;
  const confluence = parseConfluence(raw.confluence);
  if (!confluence) return null;
  const signals = parseSignals(raw.signals);
  if (!signals) return null;
  const degraded = parseDegraded(raw.degraded);
  if (!degraded) return null;
  return {
    mint,
    timeframe,
    asOfMs,
    source: source as ChartBundleSource,
    confluence,
    signals,
    degraded,
  };
}

export async function fetchSignals(
  args: FetchSignalsArgs,
): Promise<FetchSignalsResult> {
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
      buildSignalsUrl({
        base,
        mint: args.mint,
        timeframe: args.timeframe,
      }),
      {
        method: 'GET',
        signal: args.signal,
        headers: { accept: 'application/json' },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, code: 'aborted' };
    }
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
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'schema' };
  }
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
  const payload = parseSignalsPayload(body);
  if (
    !payload ||
    payload.mint !== args.mint ||
    payload.timeframe !== args.timeframe
  ) {
    return { ok: false, code: 'schema' };
  }
  return { ok: true, payload };
}
