import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '@/constants/copy';
import { fetchUsdcBalanceAtomic } from '@/src/features/balances/fetchUsdcBalance';
import { reportBalanceReadFailure } from '@/src/features/balances/reportBalanceReadFailure';

export type UsdcBalanceStatus = 'idle' | 'loading' | 'ready' | 'error';

export type UsdcBalanceState = {
  status: UsdcBalanceStatus;
  /** Atomic units (decimals=6) when ready; null when unknown. */
  atomic: bigint | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

/**
 * Bounded native USDC balance for the signed-in address.
 * Independent of SOL: failures never clear SOL; stale responses after
 * session switch are dropped via request id.
 */
export function useUsdcBalance(address: string | undefined): UsdcBalanceState {
  const [status, setStatus] = useState<UsdcBalanceStatus>('idle');
  const [atomic, setAtomic] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!address) {
        setStatus('idle');
        setAtomic(null);
        setError(null);
        setRefreshing(false);
        return;
      }

      const id = ++requestId.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setStatus((prev) => (prev === 'ready' ? prev : 'loading'));
        setError(null);
      }

      try {
        const next = await fetchUsdcBalanceAtomic(address);
        if (id !== requestId.current) return;
        setAtomic(next);
        setStatus('ready');
        setError(null);
      } catch (error) {
        reportBalanceReadFailure('USDC', error);
        if (id !== requestId.current) return;
        // Keep last known USDC on refresh fail; only clear on first load miss.
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
        setError(copy.home.usdcBalanceError);
        if (mode === 'initial') {
          setAtomic(null);
        }
      } finally {
        if (id === requestId.current) {
          setRefreshing(false);
        }
      }
    },
    [address],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  return { status, atomic, error, refreshing, refresh };
}

export function shouldApplyBalanceFetch(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}
