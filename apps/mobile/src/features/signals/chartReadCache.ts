import { useEffect } from 'react';
import type { LatestSignalPresentation } from './useLatestSignal';
import type { ChartBundle, SignalTimeframe } from './types';
import type { ChartBundleHookState } from './useChartBundle';

export type ChartReadSnapshot = {
  mint: string;
  timeframe: SignalTimeframe;
  signal: LatestSignalPresentation | null;
  chart: Pick<
    ChartBundleHookState,
    'status' | 'bundle' | 'errorCode' | 'lastFetchedAtMs'
  >;
};

export function chartReadKey(mint: string, timeframe: SignalTimeframe): string {
  return `${mint}:${timeframe}`;
}

/** Oldest published read leaves once the map is past this many keys. */
export const CHART_READ_CACHE_CAP = 32;

let cache = new Map<string, ChartReadSnapshot>();
const listeners = new Set<() => void>();

export function getChartReadCacheSnapshot(): ReadonlyMap<
  string,
  ChartReadSnapshot
> {
  return cache;
}

export function subscribeChartReadCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function publishChartRead(entry: ChartReadSnapshot): void {
  const key = chartReadKey(entry.mint, entry.timeframe);
  const next = new Map(cache);
  next.delete(key);
  next.set(key, entry);
  while (next.size > CHART_READ_CACHE_CAP) {
    const oldest = next.keys().next().value;
    if (oldest == null) break;
    next.delete(oldest);
  }
  cache = next;
  emit();
}

export function readChartRead(
  mint: string,
  timeframe: SignalTimeframe,
): ChartReadSnapshot | null {
  return cache.get(chartReadKey(mint, timeframe)) ?? null;
}

export function resetChartReadCacheForTest(): void {
  cache = new Map();
  emit();
}

export function usePublishChartRead(input: {
  mint: string | null;
  timeframe: SignalTimeframe;
  signal: LatestSignalPresentation | null;
  status: ChartBundleHookState['status'];
  bundle: ChartBundle | null;
  errorCode: ChartBundleHookState['errorCode'];
  lastFetchedAtMs: number | null;
}): void {
  const {
    mint,
    timeframe,
    signal,
    status,
    bundle,
    errorCode,
    lastFetchedAtMs,
  } = input;
  useEffect(() => {
    if (!mint) return;
    if (signal == null && bundle == null) return;
    publishChartRead({
      mint,
      timeframe,
      signal,
      chart: { status, bundle, errorCode, lastFetchedAtMs },
    });
  }, [mint, timeframe, signal, status, bundle, errorCode, lastFetchedAtMs]);
}
