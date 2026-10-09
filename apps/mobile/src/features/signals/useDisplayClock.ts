import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export const DISPLAY_CLOCK_INTERVAL_MS = 60_000;

export function subscribeDisplayClock(
  onTick: () => void,
  intervalMs: number = DISPLAY_CLOCK_INTERVAL_MS,
): () => void {
  const timer = setInterval(onTick, intervalMs);
  const subscription = AppState.addEventListener('change', (next) => {
    if (next === 'active') onTick();
  });
  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}

export type SharedDisplayClockSource = {
  nowMs: () => number;
  subscribe: (onTick: () => void) => () => void;
};

const defaultSharedSource: SharedDisplayClockSource = {
  nowMs: () => Date.now(),
  subscribe: (onTick) => subscribeDisplayClock(onTick),
};

let sharedSource: SharedDisplayClockSource = defaultSharedSource;
let sharedNow = Date.now();
const sharedListeners = new Set<() => void>();
let sharedStop: (() => void) | null = null;

function notifyShared(): void {
  sharedNow = sharedSource.nowMs();
  for (const listener of sharedListeners) listener();
}

function ensureSharedClock(): void {
  if (sharedStop) return;
  sharedNow = sharedSource.nowMs();
  sharedStop = sharedSource.subscribe(() => notifyShared());
}

function releaseSharedClockIfIdle(): void {
  if (sharedListeners.size > 0) return;
  sharedStop?.();
  sharedStop = null;
}

export function setSharedDisplayClockSourceForTest(
  source: SharedDisplayClockSource | null,
): void {
  sharedStop?.();
  sharedStop = null;
  sharedListeners.clear();
  sharedSource = source ?? defaultSharedSource;
  sharedNow = sharedSource.nowMs();
}

export function sharedDisplayClockListenerCountForTest(): number {
  return sharedListeners.size;
}

export type DisplayClockDeps = {
  nowMs?: () => number;
  subscribe?: (onTick: () => void) => () => void;
  /** False skips the subscription, so an unarmed surface starts no minute tick. */
  enabled?: boolean;
};

export function useDisplayClock(deps: DisplayClockDeps = {}): number {
  const enabled = deps.enabled !== false;
  const injected = deps.nowMs != null || deps.subscribe != null;
  const nowMs = deps.nowMs ?? Date.now;
  const subscribe = deps.subscribe ?? subscribeDisplayClock;
  const [now, setNow] = useState(() => (injected ? nowMs() : sharedNow));

  useEffect(() => {
    if (!enabled) return;
    if (injected) {
      return subscribe(() => setNow(nowMs()));
    }
    ensureSharedClock();
    setNow(sharedNow);
    const listener = () => setNow(sharedNow);
    sharedListeners.add(listener);
    return () => {
      sharedListeners.delete(listener);
      releaseSharedClockIfIdle();
    };
  }, [enabled, injected, nowMs, subscribe]);

  return now;
}

export function resolveSignalRefreshOnBundle(input: {
  previousBundleFetchedAtMs: number | null;
  bundleFetchedAtMs: number | null;
}): { refresh: boolean; seen: number | null } {
  if (input.bundleFetchedAtMs == null) {
    return { refresh: false, seen: null };
  }
  if (
    input.previousBundleFetchedAtMs == null ||
    input.bundleFetchedAtMs === input.previousBundleFetchedAtMs
  ) {
    return { refresh: false, seen: input.bundleFetchedAtMs };
  }
  return { refresh: true, seen: input.bundleFetchedAtMs };
}

export function useSignalRefreshOnBundle(
  bundleFetchedAtMs: number | null,
  refresh: () => void,
): void {
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const decision = resolveSignalRefreshOnBundle({
      previousBundleFetchedAtMs: seen.current,
      bundleFetchedAtMs,
    });
    seen.current = decision.seen;
    if (decision.refresh) refresh();
  }, [bundleFetchedAtMs, refresh]);
}
