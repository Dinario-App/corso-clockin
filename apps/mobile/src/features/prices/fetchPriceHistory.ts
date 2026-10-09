import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';

export const PRICE_HISTORY_RANGES = ['1H', '1D', '1W', '1M', 'ALL'] as const;
export const GECKOTERMINAL_PRICE_HISTORY_SOURCE = 'GeckoTerminal Public API';
export const BIRDEYE_PRICE_HISTORY_SOURCE = 'Birdeye';
export type PriceHistoryRange = (typeof PRICE_HISTORY_RANGES)[number];
export type PriceHistorySource =
  | typeof GECKOTERMINAL_PRICE_HISTORY_SOURCE
  | typeof BIRDEYE_PRICE_HISTORY_SOURCE;

export type PriceHistoryChartPoint = {
  timestampMs: number;
  priceUsd: string;
};

export type FetchPriceHistoryResult =
  | {
      ok: true;
      series: PriceHistoryChartPoint[];
      source: PriceHistorySource;
      poolAddress: string | null;
      coverageKind: 'top_indexed_pool' | 'token_aggregated';
      liquidityUsd: string | null;
      volume24hUsd: string | null;
      marketDataAsOfMs: number | null;
    }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'invalid_request'
        | 'missing_api_url'
        | 'network'
        | 'http'
        | 'schema';
    };

export type FetchPriceHistoryArgs = {
  mint: string;
  range: PriceHistoryRange;
  pricesEnabled: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

type OhlcPoint = {
  timestampMs: number;
  openUsd: string;
  highUsd: string;
  lowUsd: string;
  closeUsd: string;
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
  if (typeof value !== 'string') return false;
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function parseNullableNonNegativeDecimal(
  value: unknown,
): string | null | undefined {
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 64 ||
    !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)
  ) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? value : undefined;
}

function parsePoint(raw: unknown, priorTimestampMs: number): OhlcPoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const point = raw as Record<string, unknown>;
  if (
    typeof point.timestampMs !== 'number' ||
    !Number.isSafeInteger(point.timestampMs) ||
    point.timestampMs <= priorTimestampMs ||
    !isPositiveDecimal(point.openUsd) ||
    !isPositiveDecimal(point.highUsd) ||
    !isPositiveDecimal(point.lowUsd) ||
    !isPositiveDecimal(point.closeUsd)
  ) {
    return null;
  }
  const open = Number(point.openUsd);
  const high = Number(point.highUsd);
  const low = Number(point.lowUsd);
  const close = Number(point.closeUsd);
  if (
    high < low ||
    high < open ||
    high < close ||
    low > open ||
    low > close
  ) {
    return null;
  }
  return {
    timestampMs: point.timestampMs,
    openUsd: point.openUsd,
    highUsd: point.highUsd,
    lowUsd: point.lowUsd,
    closeUsd: point.closeUsd,
  };
}

function parseReadyResponse(
  raw: unknown,
  request: { mint: string; range: PriceHistoryRange },
): Extract<FetchPriceHistoryResult, { ok: true }> | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (
    body.schemaVersion !== 1 ||
    body.status !== 'ready' ||
    body.currency !== 'USD' ||
    body.mint !== request.mint ||
    body.range !== request.range ||
    (body.source !== GECKOTERMINAL_PRICE_HISTORY_SOURCE &&
      body.source !== BIRDEYE_PRICE_HISTORY_SOURCE) ||
    !Array.isArray(body.points) ||
    body.points.length < 2 ||
    body.points.length > 512 ||
    !body.coverage ||
    typeof body.coverage !== 'object'
  ) {
    return null;
  }
  const coverage = body.coverage as Record<string, unknown>;
  if (
    coverage.history !== 'provider_available_ohlcv' ||
    coverage.allRangeMaxDays !== 180
  ) {
    return null;
  }

  const points: OhlcPoint[] = [];
  let priorTimestampMs = -1;
  for (const rawPoint of body.points) {
    const point = parsePoint(rawPoint, priorTimestampMs);
    if (!point) return null;
    points.push(point);
    priorTimestampMs = point.timestampMs;
  }

  let poolAddress: string | null;
  let coverageKind: 'top_indexed_pool' | 'token_aggregated';
  let liquidityUsd: string | null;
  let volume24hUsd: string | null;
  let marketDataAsOfMs: number | null;
  if (body.source === GECKOTERMINAL_PRICE_HISTORY_SOURCE) {
    const hasMarketDepth =
      Object.hasOwn(coverage, 'liquidityUsd') ||
      Object.hasOwn(coverage, 'volume24hUsd') ||
      Object.hasOwn(coverage, 'marketDataAsOfMs');
    const parsedLiquidity = hasMarketDepth
      ? parseNullableNonNegativeDecimal(coverage.liquidityUsd)
      : null;
    const parsedVolume = hasMarketDepth
      ? parseNullableNonNegativeDecimal(coverage.volume24hUsd)
      : null;
    const parsedAsOf = hasMarketDepth
      ? coverage.marketDataAsOfMs === null
        ? null
        : typeof coverage.marketDataAsOfMs === 'number' &&
            Number.isSafeInteger(coverage.marketDataAsOfMs) &&
            coverage.marketDataAsOfMs >= 0
          ? coverage.marketDataAsOfMs
          : undefined
      : null;
    if (
      coverage.kind !== 'top_indexed_pool' ||
      typeof coverage.poolAddress !== 'string' ||
      !isValidPriceMint(coverage.poolAddress, 'mainnet-beta') ||
      parsedLiquidity === undefined ||
      parsedVolume === undefined ||
      parsedAsOf === undefined
    ) {
      return null;
    }
    poolAddress = coverage.poolAddress;
    coverageKind = coverage.kind;
    liquidityUsd = parsedLiquidity;
    volume24hUsd = parsedVolume;
    marketDataAsOfMs = parsedAsOf;
  } else {
    const lastTimestampMs = points.at(-1)!.timestampMs;
    if (
      coverage.kind !== 'token_aggregated' ||
      Object.hasOwn(coverage, 'poolAddress') ||
      Object.hasOwn(coverage, 'liquidityUsd') ||
      Object.hasOwn(coverage, 'volume24hUsd') ||
      coverage.marketDataAsOfMs !== lastTimestampMs
    ) {
      return null;
    }
    poolAddress = null;
    coverageKind = coverage.kind;
    liquidityUsd = null;
    volume24hUsd = null;
    marketDataAsOfMs = lastTimestampMs;
  }
  return {
    ok: true,
    series: points.map((point) => ({
      timestampMs: point.timestampMs,
      priceUsd: point.closeUsd,
    })),
    source: body.source,
    poolAddress,
    coverageKind,
    liquidityUsd,
    volume24hUsd,
    marketDataAsOfMs,
  };
}

export async function fetchPriceHistory(
  args: FetchPriceHistoryArgs,
): Promise<FetchPriceHistoryResult> {
  if (!args.pricesEnabled) return { ok: false, code: 'disabled' };
  if (
    !isValidPriceMint(args.mint, 'mainnet-beta') ||
    !PRICE_HISTORY_RANGES.includes(args.range)
  ) {
    return { ok: false, code: 'invalid_request' };
  }
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };

  const params = new URLSearchParams({ mint: args.mint, range: args.range });
  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(
      `${base}/v1/price-history?${params.toString()}`,
      {
        method: 'GET',
        signal: args.signal,
        headers: { accept: 'application/json' },
      },
    );
  } catch {
    return { ok: false, code: 'network' };
  }
  if (!response.ok) return { ok: false, code: 'http' };

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, code: 'schema' };
  }
  return parseReadyResponse(raw, { mint: args.mint, range: args.range }) ?? {
    ok: false,
    code: 'schema',
  };
}
