import { useEffect, useState } from 'react';
import { resolveTokenVitalsConfig } from '@/src/lib/apiConfig';
import { fetchVitals } from '@/src/features/tokenVitals/fetchVitals';
import type { VitalsSection } from '@/src/features/tokenVitals/types';
import { vitalsReadArmed } from '@/src/features/watchlist/useWatchedTokenVitals';
import {
  PLAIN_RISK_UNAVAILABLE,
  plainRiskOf,
  type PlainRiskRead,
} from './parsePlainRisk';

export const RISK_SECTIONS: readonly VitalsSection[] = [
  'safety',
  'holders',
  'market',
];

/** The server's own safety field TTL is longer; a minute keeps rows honest. */
export const RISK_TTL_MS = 60_000;

export type PlainRiskReaderDeps = {
  fetchVitalsImpl?: typeof fetchVitals;
  resolveConfig?: typeof resolveTokenVitalsConfig;
  nowMs?: () => number;
};

type Entry = { atMs: number; read: Promise<PlainRiskRead> };

/**
 * A coalescing per-mint reader. Exported as a factory so tests get a fresh
 * cache; the app shares `plainRiskReader`.
 */
export function createPlainRiskReader(deps: PlainRiskReaderDeps = {}) {
  const cache = new Map<string, Entry>();
  const fetchImpl = deps.fetchVitalsImpl ?? fetchVitals;
  const resolveConfig = deps.resolveConfig ?? resolveTokenVitalsConfig;
  const now = deps.nowMs ?? Date.now;

  async function load(mint: string): Promise<PlainRiskRead> {
    try {
      const config = await resolveConfig();
      if (!vitalsReadArmed(config)) return PLAIN_RISK_UNAVAILABLE;
      const result = await fetchImpl({
        mint,
        timeframe: '1d',
        sections: RISK_SECTIONS,
        tokenVitalsEnabled: true,
      });
      return result.ok ? plainRiskOf(result.vitals) : PLAIN_RISK_UNAVAILABLE;
    } catch {
      return PLAIN_RISK_UNAVAILABLE;
    }
  }

  return {
    read(mint: string): Promise<PlainRiskRead> {
      const hit = cache.get(mint);
      if (hit && now() - hit.atMs < RISK_TTL_MS) return hit.read;
      const read = load(mint);
      cache.set(mint, { atMs: now(), read });
      /** A failure is not worth remembering for a minute: drop it. */
      void read.then((r) => {
        if (r.level === 'unavailable' && cache.get(mint)?.read === read) {
          cache.delete(mint);
        }
      });
      return read;
    },
  };
}

export const plainRiskReader = createPlainRiskReader();

/** `null` while the first read is in flight: the surface draws a skeleton. */
export function usePlainRisk(
  mint: string | null,
  reader: ReturnType<typeof createPlainRiskReader> = plainRiskReader,
): PlainRiskRead | null {
  const [read, setRead] = useState<PlainRiskRead | null>(null);
  useEffect(() => {
    if (!mint) {
      setRead(PLAIN_RISK_UNAVAILABLE);
      return;
    }
    let live = true;
    setRead(null);
    void reader.read(mint).then((next) => {
      if (live) setRead(next);
    });
    return () => {
      live = false;
    };
  }, [mint, reader]);
  return read;
}
