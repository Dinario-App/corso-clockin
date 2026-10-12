import { parseDecimalPrice } from '@/src/features/balances/computeFiatTotal';
import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import {
  resolvePricesConfig,
  type PricesConfig,
} from '@/src/lib/apiConfig';

export type PriceAt = {
  mint: string;
  /** Human USD per 1 whole token, decimal string. */
  price: string;
  /** The vendor point's own time, which labels the price. */
  asOfMs: number;
};

export type FetchPriceAtArgs = {
  mint: string;
  /** The past moment to price, in ms. */
  atMs: number;
  signal?: AbortSignal;
  /** Test seams. */
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  resolveConfig?: () => Promise<PricesConfig>;
};

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    const trimmed = override?.trim() ?? '';
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

/** Parse a `/v1/prices/at` body for `mint`; anything else is `null`. */
export function parsePriceAtBody(raw: unknown, mint: string): PriceAt | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.status !== 'ok' || body.mint !== mint || body.currency !== 'USD') {
    return null;
  }
  if (typeof body.price !== 'string' || !parseDecimalPrice(body.price)) {
    return null;
  }
  if (
    typeof body.asOfMs !== 'number' ||
    !Number.isSafeInteger(body.asOfMs) ||
    body.asOfMs <= 0
  ) {
    return null;
  }
  return { mint, price: body.price, asOfMs: body.asOfMs };
}

export async function fetchPriceAt(
  args: FetchPriceAtArgs,
): Promise<PriceAt | null> {
  try {
    if (!isValidPriceMint(args.mint, 'mainnet-beta')) return null;
    if (!Number.isSafeInteger(args.atMs) || args.atMs <= 0) return null;
    const base = resolveApiBaseUrl(args.apiBaseUrl);
    if (!base) return null;
    const config = await (args.resolveConfig ?? resolvePricesConfig)();
    if (!config.pricesEnabled) return null;
    if (
      config.network.state !== 'known' ||
      config.network.cluster !== 'mainnet-beta'
    ) {
      return null;
    }
    const params = new URLSearchParams({
      mint: args.mint,
      ts: String(Math.floor(args.atMs / 1000)),
    });
    const response = await (args.fetchImpl ?? fetch)(
      `${base}/v1/prices/at?${params.toString()}`,
      { method: 'GET', signal: args.signal },
    );
    if (!response.ok) return null;
    return parsePriceAtBody(await response.json(), args.mint);
  } catch {
    return null;
  }
}
