import { useEffect, useState } from 'react';
import type { PriceQuote } from '@/src/features/balances/computeFiatTotal';
import { loadPriceQuotes } from '@/src/features/balances/usePriceQuotes';
import { snapshotToQuoteMap } from '@/src/features/balances/priceSnapshot';
import {
  fetchPriceHistory,
  type PriceHistoryChartPoint,
} from '@/src/features/prices/fetchPriceHistory';
import { resolvePricesConfig } from '@/src/lib/apiConfig';

/** The desk's lead major: Solana, by its canonical mint. */
export const LIVE_DESK_MINT = 'So11111111111111111111111111111111111111112';

/** A minute: long enough to carry Welcome into Home, short enough to stay honest. */
export const LIVE_DESK_TTL_MS = 60_000;

export type LiveDeskQuoteRead =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; quote: PriceQuote };

export type LiveDeskSeriesRead =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; points: readonly PriceHistoryChartPoint[] };

export type LiveDeskRead =
  /** Prices are off on this build or network: no card. */
  | { status: 'off' }
  | { status: 'loading' }
  | {
      status: 'settled';
      quote: Exclude<LiveDeskQuoteRead, { status: 'loading' }>;
      series: Exclude<LiveDeskSeriesRead, { status: 'loading' }>;
    };

type Settled = Exclude<LiveDeskRead, { status: 'loading' }>;

export type LiveDeskReaderDeps = {
  loadQuotes?: typeof loadPriceQuotes;
  fetchHistory?: typeof fetchPriceHistory;
  resolveConfig?: typeof resolvePricesConfig;
  nowMs?: () => number;
};

/** Exported as a factory so tests get a fresh cache; the app shares one. */
export function createLiveDeskReader(deps: LiveDeskReaderDeps = {}) {
  const loadQuotes = deps.loadQuotes ?? loadPriceQuotes;
  const fetchHistory = deps.fetchHistory ?? fetchPriceHistory;
  const resolveConfig = deps.resolveConfig ?? resolvePricesConfig;
  const now = deps.nowMs ?? Date.now;
  let entry: {
    atMs: number;
    read: Promise<Settled>;
    settled: Settled | null;
  } | null = null;

  async function readQuote(): Promise<
    'off' | Exclude<LiveDeskQuoteRead, { status: 'loading' }>
  > {
    try {
      const result = await loadQuotes({ mints: [LIVE_DESK_MINT] });
      if (!result.ok) return { status: 'failed' };
      if (result.snapshot.status === 'disabled') return 'off';
      const quote = snapshotToQuoteMap(result.snapshot)[LIVE_DESK_MINT];
      return quote ? { status: 'ready', quote } : { status: 'failed' };
    } catch {
      return { status: 'failed' };
    }
  }

  async function readSeries(): Promise<
    Exclude<LiveDeskSeriesRead, { status: 'loading' }>
  > {
    try {
      const config = await resolveConfig();
      if (
        !config.pricesEnabled ||
        config.network.state !== 'known' ||
        config.network.cluster !== 'mainnet-beta'
      ) {
        return { status: 'failed' };
      }
      const result = await fetchHistory({
        mint: LIVE_DESK_MINT,
        range: '1D',
        pricesEnabled: true,
      });
      // One point is not a line: name it rather than draw a flat dash.
      if (!result.ok || result.series.length < 2) return { status: 'failed' };
      return { status: 'ready', points: result.series };
    } catch {
      return { status: 'failed' };
    }
  }

  async function load(): Promise<Settled> {
    const [quote, series] = await Promise.all([readQuote(), readSeries()]);
    if (quote === 'off') return { status: 'off' };
    return { status: 'settled', quote, series };
  }

  function fresh() {
    return entry != null && now() - entry.atMs < LIVE_DESK_TTL_MS
      ? entry
      : null;
  }

  return {
    /** The settled read, when one is still inside the minute. */
    peek(): Settled | null {
      return fresh()?.settled ?? null;
    },
    read(): Promise<Settled> {
      const hit = fresh();
      if (hit) return hit.read;
      const read = load();
      const next = { atMs: now(), read, settled: null as Settled | null };
      entry = next;
      void read.then((settled) => {
        if (entry !== next) return;
        // A failure is not worth carrying: the next mount asks again.
        const failed =
          settled.status === 'settled' &&
          (settled.quote.status === 'failed' ||
            settled.series.status === 'failed');
        if (failed) entry = null;
        else next.settled = settled;
      });
      return read;
    },
  };
}

export const liveDeskReader = createLiveDeskReader();

export function useLiveDeskRead(
  reader: ReturnType<typeof createLiveDeskReader> = liveDeskReader,
): LiveDeskRead {
  // The carry: a read still inside the minute paints on the first frame.
  const [read, setRead] = useState<LiveDeskRead>(
    () => reader.peek() ?? { status: 'loading' },
  );
  useEffect(() => {
    let live = true;
    void reader.read().then((next) => {
      if (live) setRead(next);
    });
    return () => {
      live = false;
    };
  }, [reader]);
  return read;
}
