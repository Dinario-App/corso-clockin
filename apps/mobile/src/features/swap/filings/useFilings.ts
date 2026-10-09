import { useEffect, useState } from 'react';
import { fetchFilings } from './fetchFilings';
import type { PresentFilingsChipRead } from './presentFilingsChip';
import type { FilingsResponse } from './types';

/**
 * Soft-fail Review filings read. Failures stay null so the chip omits.
 * Does not write Sign, quote, or confirm state.
 */
export function useFilings(mint: string | null): PresentFilingsChipRead {
  const [snapshot, setSnapshot] = useState<FilingsResponse | null>(null);
  useEffect(() => {
    if (!mint) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    void fetchFilings({ mint }).then((result) => {
      if (cancelled) return;
      setSnapshot(result.ok ? result.snapshot : null);
    });
    return () => {
      cancelled = true;
    };
  }, [mint]);
  return { snapshot, mint, nowMs: Date.now() };
}
