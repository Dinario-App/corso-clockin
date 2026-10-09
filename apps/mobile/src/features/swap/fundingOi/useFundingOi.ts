import { useEffect, useState } from 'react';
import { fetchFundingOi } from './fetchFundingOi';
import type { PresentFundingOiChipRead } from './presentFundingOiChip';
import type { FundingOiResponse } from './types';

/**
 * Soft-fail Review funding read. Failures stay `null` so the chip omits.
 * Does not write Sign, quote, or confirm state.
 */
export function useFundingOi(args: {
  payMint?: string | null;
  receiveMint?: string | null;
}): PresentFundingOiChipRead {
  const [snapshot, setSnapshot] = useState<FundingOiResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchFundingOi().then((result) => {
      if (cancelled) return;
      setSnapshot(result.ok ? result.snapshot : null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return {
    snapshot,
    nowMs: Date.now(),
    payMint: args.payMint,
    receiveMint: args.receiveMint,
  };
}
