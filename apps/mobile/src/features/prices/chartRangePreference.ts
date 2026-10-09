import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import {
  PRICE_CHART_DEFAULT_VISIBLE_RANGES,
  PRICE_CHART_RANGE_ROW_SM_WIDTH,
  coerceVisibleChartRanges,
  type PriceChartRange,
} from './usePriceChartSeries';

export { PRICE_CHART_RANGE_ROW_SM_WIDTH };

export const CHART_RANGE_STORAGE_KEY = 'corso.chartRanges.v1';

export type ChartRangePreferenceState = {
  /** False until AsyncStorage has been read once. */
  hydrated: boolean;
  /** Always four, shortest → longest. */
  visible: readonly PriceChartRange[];
};

export type ChartRangeStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const DEFAULT_VISIBLE: readonly PriceChartRange[] = Object.freeze([
  ...PRICE_CHART_DEFAULT_VISIBLE_RANGES,
]);

const EMPTY: ChartRangePreferenceState = Object.freeze({
  hydrated: false,
  visible: DEFAULT_VISIBLE,
});

let state: ChartRangePreferenceState = EMPTY;
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;
/** A write that landed while the disk read was in flight wins over disk. */
let pendingWrite = false;
let generation = 0;

export function parseChartRangePreference(raw: unknown): PriceChartRange[] {
  if (typeof raw !== 'string' || raw.length === 0) {
    return [...PRICE_CHART_DEFAULT_VISIBLE_RANGES];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [...PRICE_CHART_DEFAULT_VISIBLE_RANGES];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { ranges?: unknown }).ranges)
      ? (parsed as { ranges: unknown[] }).ranges
      : null;
  if (!list) return [...PRICE_CHART_DEFAULT_VISIBLE_RANGES];
  return coerceVisibleChartRanges(list);
}

export function serializeChartRangePreference(
  ranges: readonly PriceChartRange[],
): string {
  return JSON.stringify({
    version: 1,
    ranges: coerceVisibleChartRanges(ranges),
  });
}

export function readChartRangePreference(): ChartRangePreferenceState {
  return state;
}

export function subscribeChartRangePreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(next: ChartRangePreferenceState): void {
  state = next;
  for (const listener of listeners) listener();
}

function persist(ranges: readonly PriceChartRange[], storage: ChartRangeStorage): void {
  void storage
    .setItem(CHART_RANGE_STORAGE_KEY, serializeChartRangePreference(ranges))
    .catch(() => {
      // The in-memory four are still right for this session; the next change
      // retries the write. Nothing here is money, so no alarm is raised.
    });
}

/** Read the persisted four once. Concurrent callers share the same read. */
export function hydrateChartRangePreference(
  storage: ChartRangeStorage = AsyncStorage,
): Promise<void> {
  if (state.hydrated) return Promise.resolve();
  if (hydration) return hydration;
  const epoch = generation;
  const read = storage
    .getItem(CHART_RANGE_STORAGE_KEY)
    .then((raw) => {
      if (epoch !== generation) return;
      if (pendingWrite) {
        write({ hydrated: true, visible: state.visible });
        return;
      }
      write({ hydrated: true, visible: parseChartRangePreference(raw) });
    })
    .catch(() => {
      if (epoch !== generation) return;
      write({ hydrated: true, visible: pendingWrite ? state.visible : DEFAULT_VISIBLE });
    })
    .finally(() => {
      if (hydration === read) hydration = null;
    });
  hydration = read;
  return read;
}

export function setVisibleChartRanges(
  ranges: readonly PriceChartRange[],
  deps: { storage?: ChartRangeStorage } = {},
): void {
  const visible = coerceVisibleChartRanges(ranges);
  pendingWrite = true;
  write({ hydrated: state.hydrated, visible });
  persist(visible, deps.storage ?? AsyncStorage);
}

/**
 * Sign-out: the four leave memory and the phone. The next session starts
 * on 15s · 1H · 1D · 1W. A sign-out that throws must not call this.
 */
export async function clearChartRangePreferenceOnSignOut(
  storage: ChartRangeStorage = AsyncStorage,
): Promise<void> {
  generation += 1;
  pendingWrite = false;
  hydration = null;
  write({ hydrated: true, visible: DEFAULT_VISIBLE });
  await storage.removeItem(CHART_RANGE_STORAGE_KEY);
}

export type UseChartRangePreference = ChartRangePreferenceState & {
  setVisible: (ranges: readonly PriceChartRange[]) => void;
};

/** The chart's view of the store. Hydrates on first use. */
export function useChartRangePreference(): UseChartRangePreference {
  const snapshot = useSyncExternalStore(
    subscribeChartRangePreference,
    readChartRangePreference,
    readChartRangePreference,
  );
  if (!snapshot.hydrated) void hydrateChartRangePreference();
  return {
    ...snapshot,
    setVisible: (ranges) => setVisibleChartRanges(ranges),
  };
}

export function __resetChartRangePreferenceForTests(): void {
  generation += 1;
  state = EMPTY;
  listeners.clear();
  hydration = null;
  pendingWrite = false;
}
