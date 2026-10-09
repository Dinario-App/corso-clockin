import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MarketsChangeRead,
  MarketsPricesRead,
} from './marketsMovingPresentation';
import {
  readMarketsChanges,
  readMarketsPrices,
  refreshMarketsPrices,
} from './marketsMovingRead';

export type MarketsMovingReads = {
  prices: MarketsPricesRead;
  changes: MarketsChangeRead;
  /**
   * Re-read prices only (focus or pull-to-refresh). Vitals stay one per
   * mount. Settles when the read does, so a pull's spinner can track it.
   */
  refresh: () => Promise<void>;
};

const NO_CHANGES: MarketsChangeRead = Object.freeze({});

/**
 * Markets' reads. Prices on mount and on focus; vitals once per mount. No
 * polling.
 */
export function useMarketsMoving(): MarketsMovingReads {
  const [prices, setPrices] = useState<MarketsPricesRead>({ phase: 'pending' });
  const [changes, setChanges] = useState<MarketsChangeRead>(NO_CHANGES);
  const latest = useRef(prices);
  latest.current = prices;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void readMarketsPrices().then((next) => {
      if (mounted.current) setPrices(next);
    });
    void readMarketsChanges({ signal: controller.signal }).then((read) => {
      if (mounted.current) setChanges(read);
    });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    if (latest.current.phase === 'pending') return;
    await refreshMarketsPrices(latest.current).then((next) => {
      if (mounted.current && next !== latest.current) setPrices(next);
    });
  }, []);

  return { prices, changes, refresh };
}
