import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import { createSseParser, type SseEvent } from '@/src/features/aiConnect/translate/sse';
import type { PriceHistoryChartPoint } from './fetchPriceHistory';

export type PriceStreamTransport = 'ws' | 'rest' | 'none';

export type PriceStreamTick = {
  mint: string;
  priceUsd: string;
  tsMs: number;
  transport: 'ws' | 'rest';
};

export type PriceStreamFrame =
  | { kind: 'status'; transport: PriceStreamTransport }
  | { kind: 'tick'; tick: PriceStreamTick }
  | { kind: 'end' };

export { createSseParser };
export type { SseEvent };

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export function isValidStreamPrice(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 40 || !DECIMAL.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

/** One SSE event → one frame, or `null` for anything off-contract (dropped, never thrown). */
export function parsePriceStreamEvent(event: SseEvent, mint: string): PriceStreamFrame | null {
  if (event.event === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(event.data);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const body = data as Record<string, unknown>;
  if (event.event === 'end') return { kind: 'end' };
  if (body.mint !== mint) return null;
  if (event.event === 'status') {
    return body.transport === 'ws' || body.transport === 'rest' || body.transport === 'none'
      ? { kind: 'status', transport: body.transport }
      : null;
  }
  if (event.event === 'tick') {
    if (
      !isValidStreamPrice(body.priceUsd) ||
      typeof body.tsMs !== 'number' ||
      !Number.isSafeInteger(body.tsMs) ||
      body.tsMs <= 0 ||
      (body.transport !== 'ws' && body.transport !== 'rest')
    ) {
      return null;
    }
    return { kind: 'tick', tick: { mint, priceUsd: body.priceUsd, tsMs: body.tsMs, transport: body.transport } };
  }
  return null;
}

export const PRICE_STREAM_RECONNECT_BASE_MS = 1_000;
export const PRICE_STREAM_RECONNECT_MAX_MS = 30_000;

/** Bounded exponential backoff; a clean `end` reconnects at once (attempt 0). */
export function resolvePriceStreamReconnectDelayMs(attempt: number): number {
  if (attempt <= 0) return 0;
  return Math.min(PRICE_STREAM_RECONNECT_MAX_MS, PRICE_STREAM_RECONNECT_BASE_MS * 2 ** (attempt - 1));
}

export type PriceStreamPlan =
  | { connect: true; url: string }
  | { connect: false; reason: 'disabled' | 'invalid_mint' | 'missing_api_url' | 'backgrounded' | 'inactive' };

/** Whether to hold a stream open right now. Foreground + focused + flag + mainnet only. */
export function resolvePriceStreamPlan(input: {
  mint: string | null | undefined;
  enabled: boolean;
  pricesEnabled: boolean;
  appActive: boolean;
  apiBaseUrl: string | null;
}): PriceStreamPlan {
  if (!input.enabled) return { connect: false, reason: 'inactive' };
  if (!input.pricesEnabled) return { connect: false, reason: 'disabled' };
  if (!input.appActive) return { connect: false, reason: 'backgrounded' };
  if (!input.mint || !isValidPriceMint(input.mint, 'mainnet-beta')) {
    return { connect: false, reason: 'invalid_mint' };
  }
  const base = input.apiBaseUrl?.trim().replace(/\/$/, '');
  if (!base) return { connect: false, reason: 'missing_api_url' };
  return { connect: true, url: `${base}/v1/price-stream?${new URLSearchParams({ mint: input.mint }).toString()}` };
}

/**
 * Paint the live close onto a closed-bar series. A tick inside the last
 * bar's window replaces that bar's close; a tick after it opens a new bar at
 * the next boundary; a tick older than the last bar is ignored. The result
 * is a fresh array only when something changed.
 */
export function overlayLiveTick(
  series: readonly PriceHistoryChartPoint[],
  tick: { priceUsd: string; tsMs: number } | null,
  intervalMs: number,
): readonly PriceHistoryChartPoint[] {
  if (!tick || series.length === 0 || !isValidStreamPrice(tick.priceUsd)) return series;
  const last = series[series.length - 1]!;
  if (tick.tsMs < last.timestampMs) return series;
  if (tick.tsMs < last.timestampMs + intervalMs) {
    if (last.priceUsd === tick.priceUsd) return series;
    return [...series.slice(0, -1), { timestampMs: last.timestampMs, priceUsd: tick.priceUsd }];
  }
  const boundary = last.timestampMs + Math.floor((tick.tsMs - last.timestampMs) / intervalMs) * intervalMs;
  return [...series, { timestampMs: boundary, priceUsd: tick.priceUsd }];
}
