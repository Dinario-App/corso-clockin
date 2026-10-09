import { useEffect, useRef, useState } from 'react';
import type { FetchPricesResult } from '@/src/features/balances/fetchPrices';
import type { PriceSnapshot } from '@/src/features/balances/priceSnapshot';
import {
  loadPriceQuotes,
  type LoadPriceQuotesDeps,
  type PriceQuotesStatus,
} from '@/src/features/balances/usePriceQuotes';

const PRICE_CACHE_MS = 60_000;

type CacheEntry = { atMs: number; result: FetchPricesResult };

const cache = new Map<string, CacheEntry>();

export function __resetDiyPriceCacheForTests(): void {
  cache.clear();
}

export async function loadDiyListPrices(
  mints: readonly string[],
  deps: LoadPriceQuotesDeps & { nowMs?: number } = {},
): Promise<FetchPricesResult> {
  const key = mints.join(',');
  const nowMs = deps.nowMs ?? Date.now();
  const hit = cache.get(key);
  if (hit && hit.result.ok && nowMs - hit.atMs < PRICE_CACHE_MS) {
    return hit.result;
  }
  const result = await loadPriceQuotes({ ...deps, mints: [...mints], nowMs });
  if (result.ok) cache.set(key, { atMs: nowMs, result });
  return result;
}

export type DiyListPrices = {
  status: PriceQuotesStatus;
  snapshot: PriceSnapshot | null;
};

type HeldPriceRead = DiyListPrices & { key: string };

/**
 * A mint key that is not the held read is loading, with no leftover snapshot.
 * The previous list's prices must not label the next list "Not priced".
 */
export function diyPriceViewForKey(args: {
  key: string;
  heldKey: string;
  held: DiyListPrices;
}): DiyListPrices {
  if (args.key.length === 0) return { status: 'idle', snapshot: null };
  if (args.key !== args.heldKey) return { status: 'loading', snapshot: null };
  return { status: args.held.status, snapshot: args.held.snapshot };
}

/**
 * Fetches when the mint set changes. An empty list does not fetch.
 * No interval: the screen does not poll while it stays open.
 */
export function useDiyListPrices(mints: readonly string[]): DiyListPrices {
  const key = mints.join(',');
  const [held, setHeld] = useState<HeldPriceRead>({
    key: '',
    status: 'idle',
    snapshot: null,
  });
  const requestId = useRef(0);

  useEffect(() => {
    if (key.length === 0) {
      setHeld({ key: '', status: 'idle', snapshot: null });
      return;
    }
    const id = ++requestId.current;
    const mintsNow = key.split(',');
    void loadDiyListPrices(mintsNow).then((result) => {
      if (id !== requestId.current) return;
      if (result.ok) {
        setHeld({
          key,
          status: result.snapshot.status,
          snapshot: result.snapshot,
        });
        return;
      }
      setHeld({ key, status: 'error', snapshot: null });
    });
  }, [key]);

  return diyPriceViewForKey({
    key,
    heldKey: held.key,
    held,
  });
}
