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
  isTodayMajor,
  type TodayChangeRead,
  type TodayPricesRead,
} from './todayCardPresentation';

export type TodayPricesDeps = {
  resolveConfig?: () => Promise<PricesConfig>;
  loadQuotes?: typeof loadPriceQuotes;
};

/**
 * First read. Emits `unknown` → (`off` | `pending` → `settled`). Settling is
 * unconditional: a throw anywhere still reaches `settled`, because a phase
 * stuck on `pending` is a reserved box that never collapses.
 */
export async function runTodayPricesRead(
  args: { emit: (read: TodayPricesRead) => void } & TodayPricesDeps,
): Promise<void> {
  args.emit({ phase: 'unknown' });
  let config: PricesConfig;
  try {
    config = await (args.resolveConfig ?? resolvePricesConfig)();
  } catch {
    args.emit({ phase: 'off' });
    return;
  }
  if (!config.pricesEnabled) {
    args.emit({ phase: 'off' });
    return;
  }
  args.emit({ phase: 'pending' });
  args.emit({
    phase: 'settled',
    snapshot: await readSnapshot(config, args.loadQuotes),
    refreshFailed: false,
  });
}

/**
 * A later read (Home regained focus). A failure holds the last good snapshot
 * and marks it, so the card goes `stale` instead of blanking.
 */
export async function refreshTodayPrices(
  previous: TodayPricesRead,
  deps: TodayPricesDeps = {},
): Promise<TodayPricesRead> {
  if (previous.phase !== 'settled') return previous;
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
  previous: Extract<TodayPricesRead, { phase: 'settled' }>,
): TodayPricesRead {
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
      mints: MAJOR_ASSETS.filter(isTodayMajor).map((asset) => asset.mint),
    });
  } catch {
    return null;
  }
  return result.ok ? result.snapshot : null;
}

export type TodayChangeDeps = {
  resolveConfig?: () => Promise<{ tokenVitalsEnabled: boolean }>;
  fetchVitalsImpl?: (args: FetchVitalsArgs) => Promise<FetchVitalsResult>;
  signal?: AbortSignal;
};

/**
 * One vitals read per major. Any failure — flag off, 503 while signals are
 * unarmed, network, schema, or a served `changePct24h: null` — is `null` for
 * that mint, and that row shows its price only.
 */
export async function readTodayChanges(
  deps: TodayChangeDeps = {},
): Promise<TodayChangeRead> {
  let enabled = false;
  try {
    enabled = (await (deps.resolveConfig ?? resolveTokenVitalsConfig)())
      .tokenVitalsEnabled;
  } catch {
    enabled = false;
  }
  const fetchImpl = deps.fetchVitalsImpl ?? fetchVitals;
  const entries = await Promise.all(
    MAJOR_ASSETS.filter(isTodayMajor).map(async ({ mint }): Promise<[string, number | null]> => {
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
          typeof change === 'number' && Number.isFinite(change) ? change : null,
        ];
      } catch {
        return [mint, null];
      }
    }),
  );
  return Object.fromEntries(entries);
}
