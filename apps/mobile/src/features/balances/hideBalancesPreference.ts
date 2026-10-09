import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export const HIDE_BALANCES_STORAGE_KEY = '@corso/display/hideBalances';

export type HideBalancesState = {
  /** False until AsyncStorage has been read once. */
  hydrated: boolean;
  hidden: boolean;
};

export type HideBalancesStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const EMPTY: HideBalancesState = Object.freeze({
  hydrated: false,
  hidden: false,
});

let state: HideBalancesState = EMPTY;
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;
/** A toggle that landed while the disk read was in flight wins over disk. */
let pendingWrite = false;

/** Only an exact `'1'` is on. Anything else is the default. */
export function parseHideBalances(raw: unknown): boolean {
  return raw === '1';
}

export function serializeHideBalances(hidden: boolean): string {
  return hidden ? '1' : '0';
}

export function readHideBalances(): HideBalancesState {
  return state;
}

export function subscribeHideBalances(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(next: HideBalancesState): void {
  state = next;
  for (const listener of listeners) listener();
}

/** Read the stored choice once. Concurrent callers share the same read. */
export function hydrateHideBalances(
  storage: HideBalancesStorage = AsyncStorage,
): Promise<void> {
  if (state.hydrated) return Promise.resolve();
  if (hydration) return hydration;
  const read = storage
    .getItem(HIDE_BALANCES_STORAGE_KEY)
    .then((raw) => {
      write({
        hydrated: true,
        hidden: pendingWrite ? state.hidden : parseHideBalances(raw),
      });
    })
    .catch(() => {
      write({ hydrated: true, hidden: pendingWrite ? state.hidden : false });
    })
    .finally(() => {
      if (hydration === read) hydration = null;
    });
  hydration = read;
  return read;
}

/** Takes effect at once on every mounted surface; persisted in the background. */
export function setHideBalances(
  hidden: boolean,
  deps: { storage?: HideBalancesStorage } = {},
): void {
  pendingWrite = true;
  write({ hydrated: state.hydrated, hidden });
  void (deps.storage ?? AsyncStorage)
    .setItem(HIDE_BALANCES_STORAGE_KEY, serializeHideBalances(hidden))
    .catch(() => {
      // The in-memory choice still holds for this session; the next toggle
      // retries the write.
    });
}

/** What a passive surface reads: hidden, or not yet known (fail closed). */
export function balancesHidden(snapshot: HideBalancesState): boolean {
  return !snapshot.hydrated || snapshot.hidden;
}

/** Passive surfaces: `true` = draw `••••` in place of holdings figures. */
export function useHideBalances(): boolean {
  const snapshot = useSyncExternalStore(
    subscribeHideBalances,
    readHideBalances,
    readHideBalances,
  );
  if (!snapshot.hydrated) void hydrateHideBalances();
  return balancesHidden(snapshot);
}

/** The Preferences switch. Shows off until the disk read lands. */
export function useHideBalancesSetting(): {
  hidden: boolean;
  hydrated: boolean;
  setHidden: (hidden: boolean) => void;
} {
  const snapshot = useSyncExternalStore(
    subscribeHideBalances,
    readHideBalances,
    readHideBalances,
  );
  if (!snapshot.hydrated) void hydrateHideBalances();
  return {
    hidden: snapshot.hidden,
    hydrated: snapshot.hydrated,
    setHidden: (hidden) => setHideBalances(hidden),
  };
}

export function __resetHideBalancesForTests(): void {
  state = EMPTY;
  listeners.clear();
  hydration = null;
  pendingWrite = false;
}
