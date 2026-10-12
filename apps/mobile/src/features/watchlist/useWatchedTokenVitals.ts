import { useEffect, useRef, useState } from 'react';
import { resolveTokenVitalsConfig } from '@/src/lib/apiConfig';
import { fetchVitals } from '@/src/features/tokenVitals/fetchVitals';
import type {
  SafetyVerdict,
  VitalsPrice,
} from '@/src/features/tokenVitals/types';

export type WatchedTokenVitalsStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'off'
  | 'unavailable';

export type WatchedTokenVitals = {
  status: WatchedTokenVitalsStatus;
  price: VitalsPrice | null;
  safety: SafetyVerdict | null;
};

const IDLE: WatchedTokenVitals = { status: 'idle', price: null, safety: null };

export type UseWatchedTokenVitalsDeps = {
  fetchVitalsImpl?: typeof fetchVitals;
  resolveConfig?: typeof resolveTokenVitalsConfig;
};

/** Pure: is the vitals read armed for this device? Same predicate `useVitals` uses. */
export function vitalsReadArmed(config: {
  tokenVitalsEnabled: boolean;
  network: { state: string; cluster?: string };
}): boolean {
  return (
    config.tokenVitalsEnabled &&
    config.network.state === 'known' &&
    config.network.cluster === 'mainnet-beta'
  );
}

export function useWatchedTokenVitals(
  mint: string | null,
  /** Bump to re-read (pull-to-refresh). */
  refreshKey: number,
  deps: UseWatchedTokenVitalsDeps = {},
): WatchedTokenVitals {
  const [state, setState] = useState<WatchedTokenVitals>(IDLE);
  const requestId = useRef(0);
  const fetchImpl = deps.fetchVitalsImpl ?? fetchVitals;
  const resolveConfig = deps.resolveConfig ?? resolveTokenVitalsConfig;

  useEffect(() => {
    if (!mint) {
      setState(IDLE);
      return;
    }
    const id = ++requestId.current;
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: 'loading' }));

    void (async () => {
      let next: WatchedTokenVitals;
      try {
        const config = await resolveConfig();
        if (!vitalsReadArmed(config)) {
          next = { status: 'off', price: null, safety: null };
        } else {
          const result = await fetchImpl({
            mint,
            timeframe: '1d',
            sections: ['price', 'safety'],
            tokenVitalsEnabled: true,
            signal: controller.signal,
          });
          next = result.ok
            ? {
                status: 'ready',
                price: result.vitals.price,
                safety: result.vitals.safety,
              }
            : result.code === 'disabled'
              ? { status: 'off', price: null, safety: null }
              : { status: 'unavailable', price: null, safety: null };
        }
      } catch {
        next = { status: 'unavailable', price: null, safety: null };
      }
      if (id !== requestId.current || controller.signal.aborted) return;
      setState(next);
    })();

    return () => {
      controller.abort();
    };
  }, [mint, refreshKey, fetchImpl, resolveConfig]);

  return state;
}
