import { useEffect, useState } from 'react';
import { fetchFearGreed } from './fetchFearGreed';
import type { FearGreedResponse } from './types';
import type { PresentFearGreedChipRead } from './presentFearGreedChip';

/**
 * Soft-fail Review mood read. Failures stay `null` so the chip omits.
 * Does not write Sign, quote, or confirm state.
 */
export function useFearGreed(): PresentFearGreedChipRead {
  const [snapshot, setSnapshot] = useState<FearGreedResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchFearGreed().then((result) => {
      if (cancelled) return;
      setSnapshot(result.ok ? result.snapshot : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { snapshot, nowMs: Date.now() };
}
