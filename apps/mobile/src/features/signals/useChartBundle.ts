import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { resolveTokenVitalsConfig } from '@/src/lib/apiConfig';
import {
  resolveChartBundleFailure,
  resolveChartBundleRefreshPlan,
} from './chartBundlePlan';
import {
  fetchChartBundle,
  type FetchChartBundleResult,
} from './fetchChartBundle';
import type { ChartBundle, SignalTimeframe } from './types';

export type ChartBundleStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'disabled'
  | 'unavailable'
  /** The server has no native bars for this timeframe yet — explicit, not coarsened. */
  | 'not_computed';

export type ChartBundleHookState = {
  status: ChartBundleStatus;
  bundle: ChartBundle | null;
  /** The last failure code, kept beside a still-shown older bundle. */
  errorCode: Exclude<FetchChartBundleResult, { ok: true }>['code'] | null;
  lastFetchedAtMs: number | null;
  refresh: () => void;
};

export type UseChartBundleDeps = {
  fetchImpl?: typeof fetchChartBundle;
  resolveConfig?: typeof resolveTokenVitalsConfig;
  nowMs?: () => number;
};

function appIsActive(status: AppStateStatus | null | undefined): boolean {
  return status == null || status === 'active';
}

export function useChartBundle(
  args: { mint: string | null; timeframe: SignalTimeframe; focused: boolean },
  deps: UseChartBundleDeps = {},
): ChartBundleHookState {
  const fetchImpl = deps.fetchImpl ?? fetchChartBundle;
  const resolveConfig = deps.resolveConfig ?? resolveTokenVitalsConfig;
  const nowMs = deps.nowMs ?? Date.now;

  const [status, setStatus] = useState<ChartBundleStatus>('idle');
  const [bundle, setBundle] = useState<ChartBundle | null>(null);
  const [errorCode, setErrorCode] =
    useState<ChartBundleHookState['errorCode']>(null);
  const [lastFetchedAtMs, setLastFetchedAtMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [appActive, setAppActive] = useState(
    appIsActive(AppState.currentState),
  );
  const enabledRef = useRef(true);
  // Mirror of `bundle` for the failure path, which must know which tape is up
  // without re-running the fetch effect on every bundle change.
  const bundleRef = useRef<ChartBundle | null>(null);
  bundleRef.current = bundle;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setAppActive(appIsActive(next));
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  // The fetch. Re-runs on mint/timeframe change and on every refresh tick.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is the refresh trigger and is listed on purpose so refresh() re-runs the fetch.
  useEffect(() => {
    if (!args.mint) {
      setStatus('idle');
      setBundle(null);
      return undefined;
    }
    const mint = args.mint;
    const timeframe = args.timeframe;
    const controller = new AbortController();
    let cancelled = false;
    // A bundle computed for ANOTHER timeframe must never stay painted under
    // the newly selected pill (plan 09a: no silent coarsen on the device
    // either). Same-timeframe refreshes keep the older bundle through a
    // transient failure.
    setBundle((previous) =>
      previous && previous.timeframe === timeframe ? previous : null,
    );
    setStatus((previous) => (previous === 'ready' ? previous : 'loading'));

    void (async () => {
      const config = await resolveConfig();
      if (cancelled) return;
      const enabled =
        config.tokenVitalsEnabled &&
        config.network.state === 'known' &&
        config.network.cluster === 'mainnet-beta';
      enabledRef.current = enabled;
      if (!enabled) {
        setStatus('disabled');
        setBundle(null);
        setErrorCode('disabled');
        return;
      }
      const result = await fetchImpl({
        mint,
        timeframe,
        signalsEnabled: true,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (result.ok) {
        setBundle(result.bundle);
        setErrorCode(null);
        setStatus('ready');
        setLastFetchedAtMs(nowMs());
        return;
      }
      if (result.code === 'aborted') return;
      setErrorCode(result.code);
      if (result.code === 'disabled') {
        setBundle(null);
        setStatus('disabled');
        return;
      }
      if (result.code === 'timeframe_not_computed') {
        // Honest, fail-closed: nothing is painted for this timeframe, and no
        // bar-cadence refresh is armed (status is not 'ready').
        setBundle(null);
        setStatus('not_computed');
        return;
      }
      // Keep an older bundle through a transient failure only when it is the
      // same mint + timeframe; a failure after a pill change (including the
      // server's honest `no_data` for that timeframe) drops the stale tape so
      // the named state can show. See `resolveChartBundleFailure`.
      const failure = resolveChartBundleFailure({
        previous: bundleRef.current,
        mint,
        timeframe,
      });
      if (!failure.keepBundle) setBundle(null);
      setStatus(failure.status);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [args.mint, args.timeframe, tick, fetchImpl, resolveConfig, nowMs]);

  useEffect(() => {
    const plan = resolveChartBundleRefreshPlan({
      enabled: enabledRef.current && status === 'ready',
      focused: args.focused,
      appActive,
      timeframe: args.timeframe,
      asOfMs: bundle?.asOfMs ?? null,
      nowMs: nowMs(),
    });
    if (!plan.refresh) return undefined;
    const timer = setTimeout(refresh, plan.delayMs);
    return () => clearTimeout(timer);
  }, [status, bundle, args.focused, args.timeframe, appActive, refresh, nowMs]);

  return { status, bundle, errorCode, lastFetchedAtMs, refresh };
}
