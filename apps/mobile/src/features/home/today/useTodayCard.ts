import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFearGreed } from '@/src/features/swap/fearGreed/fetchFearGreed';
import type {
  TodayChangeRead,
  TodayMoodRead,
  TodayPricesRead,
} from './todayCardPresentation';
import {
  readTodayChanges,
  refreshTodayPrices,
  runTodayPricesRead,
} from './todayCardRead';

export type TodayCardReads = {
  prices: TodayPricesRead;
  changes: TodayChangeRead;
  mood: TodayMoodRead;
  /** Re-read prices only (Home regained focus). Vitals stay one per mount. */
  refresh: () => void;
};

const NO_CHANGES: TodayChangeRead = Object.freeze({});

export function useTodayCard(): TodayCardReads {
  const [prices, setPrices] = useState<TodayPricesRead>({ phase: 'unknown' });
  const [changes, setChanges] = useState<TodayChangeRead>(NO_CHANGES);
  const [mood, setMood] = useState<TodayMoodRead>(null);
  const latest = useRef(prices);
  latest.current = prices;
  const mounted = useRef(true);
  const vitalsStarted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void runTodayPricesRead({
      emit: (next) => {
        if (!mounted.current) return;
        setPrices(next);
        if (next.phase === 'pending' && !vitalsStarted.current) {
          vitalsStarted.current = true;
          void readTodayChanges({ signal: controller.signal }).then((read) => {
            if (mounted.current) setChanges(read);
          });
          void fetchFearGreed({ signal: controller.signal }).then((result) => {
            if (mounted.current) setMood(result.ok ? result.snapshot : null);
          });
        }
      },
    });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);

  const refresh = useCallback(() => {
    void refreshTodayPrices(latest.current).then((next) => {
      if (mounted.current && next !== latest.current) setPrices(next);
    });
  }, []);

  return { prices, changes, mood, refresh };
}
