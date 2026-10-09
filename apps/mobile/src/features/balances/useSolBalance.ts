import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '@/constants/copy';
import { fetchSolBalanceLamports } from '@/src/features/balances/fetchSolBalance';
import { reportBalanceReadFailure } from '@/src/features/balances/reportBalanceReadFailure';

export type SolBalanceStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SolBalanceState = {
  status: SolBalanceStatus;
  lamports: number | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

/**
 * SOL balance for the signed-in address.
 * Fetches on mount (when address is set) and exposes pull-to-refresh.
 */
export function useSolBalance(address: string | undefined): SolBalanceState {
  const [status, setStatus] = useState<SolBalanceStatus>('idle');
  const [lamports, setLamports] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!address) {
        setStatus('idle');
        setLamports(null);
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
        const next = await fetchSolBalanceLamports(address);
        if (id !== requestId.current) return;
        setLamports(next);
        setStatus('ready');
        setError(null);
      } catch (error) {
        reportBalanceReadFailure('SOL', error);
        if (id !== requestId.current) return;
        // Keep last known balance if refresh fails; only clear on first load miss.
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
        setError(copy.home.balanceError);
        if (mode === 'initial') {
          setLamports(null);
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

  return { status, lamports, error, refreshing, refresh };
}
