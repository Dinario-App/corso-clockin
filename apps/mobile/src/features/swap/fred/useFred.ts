import { useEffect, useState } from 'react';
import { fetchFred } from './fetchFred';
import type { PresentFredChipRead } from './presentFredChip';
import type { FredResponse } from './types';

/**
 * Soft-fail Review macro read. Failures stay `null` so the chip omits.
 * Does not write Sign, quote, or confirm state.
 */
export function useFred(): PresentFredChipRead {
  const [snapshot, setSnapshot] = useState<FredResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchFred().then((result) => {
      if (cancelled) return;
      setSnapshot(result.ok ? result.snapshot : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { snapshot, nowMs: Date.now() };
}
