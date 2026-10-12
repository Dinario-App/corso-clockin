import { useEffect, useState } from 'react';
import { resolveTokenVitalsConfig } from '@/src/lib/apiConfig';
import { fetchFearGreed } from '@/src/features/swap/fearGreed/fetchFearGreed';
import { fetchVitals } from '@/src/features/tokenVitals/fetchVitals';
import type { VitalsSection } from '@/src/features/tokenVitals/types';
import { vitalsReadArmed } from '@/src/features/watchlist/useWatchedTokenVitals';
import type { DeskMoodRead, DeskVitalsRead } from './majorDeskReads';

export const DESK_SECTIONS: readonly VitalsSection[] = ['market', 'holders'];

/** A minute keeps the figures honest without a request on every remount. */
export const DESK_READ_TTL_MS = 60_000;

export type DeskVitalsReaderDeps = {
  fetchVitalsImpl?: typeof fetchVitals;
  resolveConfig?: typeof resolveTokenVitalsConfig;
  nowMs?: () => number;
};

type Settled = Exclude<DeskVitalsRead, { status: 'loading' }>;
type Entry = { atMs: number; read: Promise<Settled> };

/** Exported as a factory so tests get a fresh cache; the app shares one. */
export function createDeskVitalsReader(deps: DeskVitalsReaderDeps = {}) {
  const cache = new Map<string, Entry>();
  const fetchImpl = deps.fetchVitalsImpl ?? fetchVitals;
  const resolveConfig = deps.resolveConfig ?? resolveTokenVitalsConfig;
  const now = deps.nowMs ?? Date.now;

  async function load(mint: string): Promise<Settled> {
    try {
      const config = await resolveConfig();
      if (!vitalsReadArmed(config)) return { status: 'off' };
      const result = await fetchImpl({
        mint,
        timeframe: '1d',
        sections: DESK_SECTIONS,
        tokenVitalsEnabled: true,
      });
      if (!result.ok) return { status: 'failed' };
      return {
        status: 'ready',
        market: result.vitals.market ?? null,
        holders: result.vitals.holders ?? null,
      };
    } catch {
      return { status: 'failed' };
    }
  }

  return {
    read(mint: string): Promise<Settled> {
      const hit = cache.get(mint);
      if (hit && now() - hit.atMs < DESK_READ_TTL_MS) return hit.read;
      const read = load(mint);
      cache.set(mint, { atMs: now(), read });
      // A failure is not worth remembering for a minute.
      void read.then((r) => {
        if (r.status === 'failed' && cache.get(mint)?.read === read) {
          cache.delete(mint);
        }
      });
      return read;
    },
  };
}

export const deskVitalsReader = createDeskVitalsReader();

export function useMajorDeskReads(
  mint: string,
  deps: {
    reader?: ReturnType<typeof createDeskVitalsReader>;
    fetchFearGreedImpl?: typeof fetchFearGreed;
  } = {},
): { vitals: DeskVitalsRead; mood: DeskMoodRead } {
  const reader = deps.reader ?? deskVitalsReader;
  const fetchMood = deps.fetchFearGreedImpl ?? fetchFearGreed;
  const [vitals, setVitals] = useState<DeskVitalsRead>({ status: 'loading' });
  const [mood, setMood] = useState<DeskMoodRead>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    setVitals({ status: 'loading' });
    void reader.read(mint).then((next) => {
      if (live) setVitals(next);
    });
    return () => {
      live = false;
    };
  }, [mint, reader]);

  useEffect(() => {
    let live = true;
    void fetchMood()
      .then((result) => {
        if (!live) return;
        setMood(
          result.ok
            ? { status: 'ready', snapshot: result.snapshot }
            : { status: 'failed' },
        );
      })
      .catch(() => {
        if (live) setMood({ status: 'failed' });
      });
    return () => {
      live = false;
    };
  }, [fetchMood]);

  return { vitals, mood };
}
