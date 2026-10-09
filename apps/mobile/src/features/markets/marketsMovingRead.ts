import type { FetchPricesResult } from '@/src/features/balances/fetchPrices';
import { MAJOR_ASSETS } from '@/src/features/balances/majors';
import { loadPriceQuotes } from '@/src/features/balances/usePriceQuotes';
import type { PriceSnapshot } from '@/src/features/balances/priceSnapshot';
import {
  fetchVitals,
  type FetchVitalsArgs,
  type FetchVitalsResult,
} from '@/src/features/tokenVitals/fetchVitals';
import {
  resolvePricesConfig,
  resolveTokenVitalsConfig,
  type PricesConfig,
} from '@/src/lib/apiConfig';
import {
  isMarketsMajor,
  type MarketsChangeRead,
  type MarketsPricesRead,
} from './marketsMovingPresentation';

export type MarketsPricesDeps = {
  resolveConfig?: () => Promise<PricesConfig>;
  loadQuotes?: typeof loadPriceQuotes;
};

/** First read. Always settles: a throw anywhere is `off` or a null snapshot. */
export async function readMarketsPrices(
  deps: MarketsPricesDeps = {},
): Promise<MarketsPricesRead> {
  let config: PricesConfig;
  try {
    config = await (deps.resolveConfig ?? resolvePricesConfig)();
  } catch {
    return { phase: 'off' };
  }
  if (!config.pricesEnabled) return { phase: 'off' };
  return {
    phase: 'settled',
    snapshot: await readSnapshot(config, deps.loadQuotes),
    refreshFailed: false,
  };
}

/**
 * A later read (Markets regained focus). A failure holds the last good
 * snapshot and marks it, so the section goes `stale` instead of blanking.
 */
export async function refreshMarketsPrices(
  previous: MarketsPricesRead,
  deps: MarketsPricesDeps = {},
): Promise<MarketsPricesRead> {
  if (previous.phase !== 'settled') return readMarketsPrices(deps);
  let config: PricesConfig;
  try {
    config = await (deps.resolveConfig ?? resolvePricesConfig)();
  } catch {
    return holdPrevious(previous);
  }
  if (!config.pricesEnabled) return { phase: 'off' };
  const next = await readSnapshot(config, deps.loadQuotes);
  if (next) return { phase: 'settled', snapshot: next, refreshFailed: false };
  return holdPrevious(previous);
}

function holdPrevious(
  previous: Extract<MarketsPricesRead, { phase: 'settled' }>,
): MarketsPricesRead {
  return previous.snapshot
    ? { ...previous, refreshFailed: true }
    : { phase: 'settled', snapshot: null, refreshFailed: false };
}

async function readSnapshot(
  config: PricesConfig,
  loadQuotes: typeof loadPriceQuotes = loadPriceQuotes,
): Promise<PriceSnapshot | null> {
  let result: FetchPricesResult;
  try {
    result = await loadQuotes({
      resolveConfig: async () => config,
      mints: MAJOR_ASSETS.filter(isMarketsMajor).map((asset) => asset.mint),
    });
  } catch {
    return null;
  }
  return result.ok ? result.snapshot : null;
}

export type MarketsChangeDeps = {
  resolveConfig?: () => Promise<{ tokenVitalsEnabled: boolean }>;
  fetchVitalsImpl?: (args: FetchVitalsArgs) => Promise<FetchVitalsResult>;
  signal?: AbortSignal;
};

/**
 * One vitals read per major. Any failure — flag off, 503, network, schema, or
 * a served `changePct24h: null` — is `null` for that mint, and that row shows
 * its price only.
 */
export async function readMarketsChanges(
  deps: MarketsChangeDeps = {},
): Promise<MarketsChangeRead> {
  let enabled = false;
  try {
    enabled = (await (deps.resolveConfig ?? resolveTokenVitalsConfig)())
      .tokenVitalsEnabled;
  } catch {
    enabled = false;
  }
  const fetchImpl = deps.fetchVitalsImpl ?? fetchVitals;
  const entries = await Promise.all(
    MAJOR_ASSETS.filter(isMarketsMajor).map(
      async ({ mint }): Promise<[string, number | null]> => {
        if (!enabled) return [mint, null];
        try {
          const result = await fetchImpl({
            mint,
            timeframe: '1h',
            sections: ['price'],
            tokenVitalsEnabled: enabled,
            signal: deps.signal,
          });
          if (!result.ok) return [mint, null];
          const change = result.vitals.price?.changePct24h;
          return [
            mint,
            typeof change === 'number' && Number.isFinite(change)
              ? change
              : null,
          ];
        } catch {
          return [mint, null];
        }
      },
    ),
  );
  return Object.fromEntries(entries);
}
