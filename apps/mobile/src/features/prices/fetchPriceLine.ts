import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import { BIRDEYE_PRICE_HISTORY_SOURCE, type PriceHistoryChartPoint } from './fetchPriceHistory';

export const PRICE_LINE_INTERVALS = ['15s'] as const;
export type PriceLineInterval = (typeof PRICE_LINE_INTERVALS)[number];
export const PRICE_LINE_INTERVAL_MS: Record<PriceLineInterval, number> = { '15s': 15_000 };

export type FetchPriceLineResult =
  | {
      ok: true;
      series: PriceHistoryChartPoint[];
      source: typeof BIRDEYE_PRICE_HISTORY_SOURCE;
      interval: PriceLineInterval;
      intervalMs: number;
      asOfMs: number;
    }
  | {
      ok: false;
      code: 'disabled' | 'invalid_request' | 'missing_api_url' | 'network' | 'http' | 'schema';
      httpStatus?: number;
    };

export type FetchPriceLineArgs = {
  mint: string;
  interval: PriceLineInterval;
  pricesEnabled: boolean;
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

function isPositiveDecimal(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function parsePriceLineResponse(
  raw: unknown,
  request: { mint: string; interval: PriceLineInterval },
): Extract<FetchPriceLineResult, { ok: true }> | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const intervalMs = PRICE_LINE_INTERVAL_MS[request.interval];
  if (
    body.schemaVersion !== 1 ||
    body.status !== 'ready' ||
    body.currency !== 'USD' ||
    body.mint !== request.mint ||
    body.interval !== request.interval ||
    body.intervalMs !== intervalMs ||
    body.source !== BIRDEYE_PRICE_HISTORY_SOURCE ||
    typeof body.asOfMs !== 'number' ||
    !Number.isSafeInteger(body.asOfMs) ||
    body.asOfMs <= 0 ||
    !Array.isArray(body.points) ||
    body.points.length < 2 ||
    body.points.length > 512
  ) {
    return null;
  }
  const series: PriceHistoryChartPoint[] = [];
  let prior = -1;
  for (const rawPoint of body.points) {
    if (!rawPoint || typeof rawPoint !== 'object') return null;
    const point = rawPoint as Record<string, unknown>;
    if (
      typeof point.timestampMs !== 'number' ||
      !Number.isSafeInteger(point.timestampMs) ||
      point.timestampMs <= prior ||
      (prior >= 0 && point.timestampMs - prior !== intervalMs) ||
      !isPositiveDecimal(point.closeUsd) ||
      !isPositiveDecimal(point.openUsd) ||
      !isPositiveDecimal(point.highUsd) ||
      !isPositiveDecimal(point.lowUsd)
    ) {
      return null;
    }
    series.push({ timestampMs: point.timestampMs, priceUsd: point.closeUsd });
    prior = point.timestampMs;
  }
  if (body.asOfMs !== prior) return null;
  return {
    ok: true,
    series,
    source: BIRDEYE_PRICE_HISTORY_SOURCE,
    interval: request.interval,
    intervalMs,
    asOfMs: body.asOfMs,
  };
}

export async function fetchPriceLine(args: FetchPriceLineArgs): Promise<FetchPriceLineResult> {
  if (!args.pricesEnabled) return { ok: false, code: 'disabled' };
  if (
    !isValidPriceMint(args.mint, 'mainnet-beta') ||
    !PRICE_LINE_INTERVALS.includes(args.interval)
  ) {
    return { ok: false, code: 'invalid_request' };
  }
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };
  const params = new URLSearchParams({ mint: args.mint, interval: args.interval });
  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(`${base}/v1/price-line?${params.toString()}`, {
      method: 'GET',
      signal: args.signal,
      headers: { accept: 'application/json' },
    });
  } catch {
    return { ok: false, code: 'network' };
  }
  if (!response.ok) return { ok: false, code: 'http', httpStatus: response.status };
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, code: 'schema' };
  }
  return parsePriceLineResponse(raw, { mint: args.mint, interval: args.interval }) ?? { ok: false, code: 'schema' };
}
