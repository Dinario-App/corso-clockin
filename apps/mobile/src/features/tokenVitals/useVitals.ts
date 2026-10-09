import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { resolveTokenVitalsConfig } from '@/src/lib/apiConfig';
import { fetchVitals, type FetchVitalsResult } from './fetchVitals';
import { resolveVitalsPollPlan } from './tokenVitalsPresentation';
import type { TimeframeId, VitalsPayload } from './types';

export type VitalsHookState = {
  payload: VitalsPayload | null;
  fetching: boolean;
  fetchFailed: boolean;
  lastFetchedAtMs: number | null;
  /** True while the poll plan says this card is the live one. */
  polling: boolean;
  timeframe: TimeframeId;
  setTimeframe: (timeframe: TimeframeId) => void;
  refresh: () => void;
};

export type UseVitalsDeps = {
  fetchVitalsImpl?: typeof fetchVitals;
  resolveConfig?: typeof resolveTokenVitalsConfig;
  nowMs?: () => number;
};

function appIsActive(status: AppStateStatus | null | undefined): boolean {
  return status == null || status === 'active';
}

export function useVitals(
  args: {
    /** The server-authored seed, when the card arrived with one. */
    seed: VitalsPayload | null;
    mint: string | null;
    focused: boolean;
    enabled: boolean;
  },
  deps: UseVitalsDeps = {},
): VitalsHookState {
  const fetchImpl = deps.fetchVitalsImpl ?? fetchVitals;
  const resolveConfig = deps.resolveConfig ?? resolveTokenVitalsConfig;
  const nowMs = deps.nowMs ?? Date.now;

  const [payload, setPayload] = useState<VitalsPayload | null>(args.seed);
  const [timeframe, setTimeframeState] = useState<TimeframeId>(
    args.seed?.timeframe ?? '1h',
  );
  const [fetching, setFetching] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [lastFetchedAtMs, setLastFetchedAtMs] = useState<number | null>(
    args.seed ? nowMs() : null,
  );
  const [appActive, setAppActive] = useState(
    appIsActive(AppState.currentState),
  );
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestId = useRef(0);
  const seedMint = useRef<string | null>(args.seed?.token.mint ?? null);

  // A new seed for the same card (an Ask landed again) replaces the payload.
  useEffect(() => {
    if (args.seed && args.seed.token.mint !== seedMint.current) {
      seedMint.current = args.seed.token.mint;
      setPayload(args.seed);
      setTimeframeState(args.seed.timeframe);
      setLastFetchedAtMs(nowMs());
      setFetchFailed(false);
    }
  }, [args.seed, nowMs]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      setAppActive(appIsActive(status));
    });
    return () => subscription.remove();
  }, []);

  const plan = resolveVitalsPollPlan({
    enabled: args.enabled,
    focused: args.focused,
    appActive,
    mint: args.mint,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: payload, fetchImpl, resolveConfig and nowMs are read on purpose without being listed; listing them would refetch on every render and every result.
  useEffect(() => {
    if (!args.mint || !args.enabled) return;
    // A refresh or a timeframe change fetches once even when not polling;
    // a card that is not the live one otherwise stays frozen on its snapshot.
    const oneShot =
      refreshNonce > 0 || (payload != null && payload.timeframe !== timeframe);
    if (!plan.poll && !oneShot && payload != null) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const mint = args.mint;

    const run = async () => {
      const id = ++requestId.current;
      setFetching(true);
      const config = await resolveConfig();
      if (cancelled) return;
      if (
        !config.tokenVitalsEnabled ||
        config.network.state !== 'known' ||
        config.network.cluster !== 'mainnet-beta'
      ) {
        setFetching(false);
        setFetchFailed(true);
        return;
      }
      let result: FetchVitalsResult;
      try {
        result = await fetchImpl({
          mint,
          timeframe,
          tokenVitalsEnabled: true,
          signal: controller.signal,
        });
      } catch {
        result = { ok: false, code: 'network' };
      }
      if (cancelled || id !== requestId.current) return;
      setFetching(false);
      if (result.ok) {
        setPayload(result.vitals);
        setFetchFailed(false);
        setLastFetchedAtMs(nowMs());
      } else if (result.code !== 'aborted') {
        setFetchFailed(true);
      }
      if (plan.poll && plan.intervalMs != null && !cancelled) {
        timer = setTimeout(() => void run(), plan.intervalMs);
      }
    };
    void run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
    // `payload` is intentionally not a dependency: a fresh payload must not
    // restart the loop it came from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    args.mint,
    args.enabled,
    timeframe,
    refreshNonce,
    plan.poll,
    plan.intervalMs,
  ]);

  const setTimeframe = useCallback((next: TimeframeId) => {
    setTimeframeState(next);
  }, []);
  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  return {
    payload,
    fetching,
    fetchFailed,
    lastFetchedAtMs,
    polling: plan.poll,
    timeframe,
    setTimeframe,
    refresh,
  };
}
