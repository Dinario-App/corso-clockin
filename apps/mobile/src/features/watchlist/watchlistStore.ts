import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import {
  DIY_WATCHLISTS_STORAGE_KEY,
  EMPTY_DIY_WATCHLISTS,
  mergeDiyWatchlists,
  parseDiyWatchlists,
  reduceDiyCommand,
  serializeDiyWatchlists,
  type DiyCommand,
  type DiyResult,
  type DiyWatchlists,
} from './diyWatchlistModel';
import { listedTokenFromFacts, type ListedTokenFacts } from './listedToken';
import {
  isWatchlistMint,
  normalizeWatchName,
  normalizeWatchSymbol,
  normalizeWatchlist,
  type WatchedToken,
} from './watchlistEntry';

export {
  WATCHLIST_MAX,
  WATCHLIST_NAME_MAX,
  WATCHLIST_SYMBOL_MAX,
  isWatchlistMint,
  normalizeWatchName,
  normalizeWatchSymbol,
  normalizeWatchlist,
} from './watchlistEntry';
export type { WatchedToken } from './watchlistEntry';

export const WATCHLIST_STORAGE_KEY = 'corso.watchlist.v1';

export type WatchlistState = {
  /** False until AsyncStorage has been read once; the screen shows "reading" rather than "empty". */
  hydrated: boolean;
  /** Newest star first. */
  tokens: readonly WatchedToken[];
};

export type WatchlistStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const EMPTY: WatchlistState = Object.freeze({
  hydrated: false,
  tokens: Object.freeze([]) as readonly WatchedToken[],
});

let state: WatchlistState = EMPTY;
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;
let diyHydration: Promise<void> | null = null;

type MutableDiyRuntime = {
  hydrated: boolean;
  loadError: boolean;
  data: DiyWatchlists;
};

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

/** What readers receive. Fields, lists, and items are readonly. */
export type DiyWatchlistsRuntime = DeepReadonly<MutableDiyRuntime>;

function freezeCopy<T>(value: T): DeepReadonly<T> {
  if (value === null || typeof value !== 'object') {
    return value as DeepReadonly<T>;
  }
  if (Array.isArray(value)) {
    const copy = value.map((item: unknown) => freezeCopy(item));
    return Object.freeze(copy) as DeepReadonly<T>;
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    copy[key] = freezeCopy((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(copy) as DeepReadonly<T>;
}

let diy: MutableDiyRuntime = {
  hydrated: false,
  loadError: false,
  data: EMPTY_DIY_WATCHLISTS,
};
/** Frozen snapshot for readers. Writers keep the unfrozen `diy` and replace it. */
let published: DiyWatchlistsRuntime = freezeCopy(diy);
let generation = 0;

/* ─── Pure ──────────────────────────────────────────────────────────────────── */

function parseEntry(value: unknown): WatchedToken | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!isWatchlistMint(record.mint)) return null;
  const symbol = normalizeWatchSymbol(record.symbol);
  if (symbol === null) return null;
  const addedAtMs =
    typeof record.addedAtMs === 'number' && Number.isFinite(record.addedAtMs)
      ? record.addedAtMs
      : null;
  if (addedAtMs === null) return null;
  return {
    mint: record.mint,
    symbol,
    name: normalizeWatchName(record.name),
    addedAtMs,
  };
}

/** Hostile-safe read of the persisted JSON. Anything malformed becomes the empty list. */
export function parseWatchlist(raw: unknown): WatchedToken[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' &&
        parsed !== null &&
        Array.isArray((parsed as { tokens?: unknown }).tokens)
      ? (parsed as { tokens: unknown[] }).tokens
      : null;
  if (!list) return [];
  const entries: WatchedToken[] = [];
  for (const item of list) {
    const entry = parseEntry(item);
    if (entry) entries.push(entry);
  }
  return normalizeWatchlist(entries);
}

export function serializeWatchlist(tokens: readonly WatchedToken[]): string {
  return JSON.stringify({ version: 1, tokens: normalizeWatchlist(tokens) });
}

export function isWatched(
  tokens: readonly WatchedToken[],
  mint: string,
): boolean {
  return tokens.some((token) => token.mint === mint);
}

export function addWatched(
  tokens: readonly WatchedToken[],
  input: { mint: string; symbol: string; name?: string | null },
  nowMs: number,
): WatchedToken[] {
  const entry = parseEntry({
    mint: input.mint,
    symbol: input.symbol,
    name: input.name ?? null,
    addedAtMs: nowMs,
  });
  if (!entry) return [...tokens];
  return normalizeWatchlist([entry, ...tokens]);
}

export function removeWatched(
  tokens: readonly WatchedToken[],
  mint: string,
): WatchedToken[] {
  return tokens.filter((token) => token.mint !== mint);
}

/* ─── Store ─────────────────────────────────────────────────────────────────── */

export function readWatchlist(): WatchlistState {
  return state;
}

export function subscribeWatchlist(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

function write(next: WatchlistState): void {
  state = next;
  notify();
}

function writeDiy(next: MutableDiyRuntime): void {
  diy = next;
  published = freezeCopy(next);
  notify();
}

function persist(
  tokens: readonly WatchedToken[],
  storage: WatchlistStorage,
): void {
  void storage
    .setItem(WATCHLIST_STORAGE_KEY, serializeWatchlist(tokens))
    .catch(() => {
      // The in-memory list is still right for this session; the next star
      // retries the write. Nothing here is money, so no alarm is raised.
    });
}

/** Read the persisted list once. Concurrent callers share the same read. */
export function hydrateWatchlist(
  storage: WatchlistStorage = AsyncStorage,
): Promise<void> {
  if (state.hydrated) return Promise.resolve();
  if (hydration) return hydration;
  const epoch = generation;
  const read = storage
    .getItem(WATCHLIST_STORAGE_KEY)
    .then((raw) => {
      if (epoch !== generation) return;
      // A star that landed while the read was in flight wins over disk.
      const merged = normalizeWatchlist([
        ...state.tokens,
        ...parseWatchlist(raw),
      ]);
      write({ hydrated: true, tokens: merged });
    })
    .catch(() => {
      if (epoch !== generation) return;
      write({ hydrated: true, tokens: state.tokens });
    })
    .finally(() => {
      if (hydration === read) hydration = null;
    });
  hydration = read;
  return read;
}

export async function clearWatchlistFromPhone(
  storage: { removeItem: (key: string) => Promise<void> } = AsyncStorage,
): Promise<void> {
  generation += 1;
  hydration = null;
  diyHydration = null;
  write({ hydrated: true, tokens: EMPTY.tokens });
  writeDiy({ hydrated: true, loadError: false, data: EMPTY_DIY_WATCHLISTS });
  await storage.removeItem(WATCHLIST_STORAGE_KEY);
  await storage.removeItem(DIY_WATCHLISTS_STORAGE_KEY);
}

export function watchToken(
  input: { mint: string; symbol: string; name?: string | null },
  deps: { nowMs?: number; storage?: WatchlistStorage } = {},
): void {
  const tokens = addWatched(state.tokens, input, deps.nowMs ?? Date.now());
  write({ hydrated: state.hydrated, tokens });
  persist(tokens, deps.storage ?? AsyncStorage);
}

export function unwatchToken(
  mint: string,
  deps: { storage?: WatchlistStorage } = {},
): void {
  if (!isWatched(state.tokens, mint)) return;
  const tokens = removeWatched(state.tokens, mint);
  write({ hydrated: state.hydrated, tokens });
  persist(tokens, deps.storage ?? AsyncStorage);
}

export function toggleWatchToken(
  input: { mint: string; symbol: string; name?: string | null },
  deps: { nowMs?: number; storage?: WatchlistStorage } = {},
): boolean {
  if (isWatched(state.tokens, input.mint)) {
    unwatchToken(input.mint, deps);
    return false;
  }
  watchToken(input, deps);
  return true;
}

export type UseWatchlist = WatchlistState & {
  isWatched: (mint: string) => boolean;
  watch: (input: {
    mint: string;
    symbol: string;
    name?: string | null;
  }) => void;
  unwatch: (mint: string) => void;
  toggle: (input: {
    mint: string;
    symbol: string;
    name?: string | null;
  }) => boolean;
};

/** The screen's view of the store. Hydrates on first use. */
export function useWatchlist(): UseWatchlist {
  const snapshot = useSyncExternalStore(
    subscribeWatchlist,
    readWatchlist,
    readWatchlist,
  );
  if (!snapshot.hydrated) void hydrateWatchlist();
  return {
    ...snapshot,
    isWatched: (mint) => isWatched(snapshot.tokens, mint),
    watch: (input) => watchToken(input),
    unwatch: (mint) => unwatchToken(mint),
    toggle: (input) => toggleWatchToken(input),
  };
}

export function readDiyWatchlists(): DiyWatchlistsRuntime {
  return published;
}

function persistDiy(data: DiyWatchlists, storage: WatchlistStorage): void {
  void storage
    .setItem(DIY_WATCHLISTS_STORAGE_KEY, serializeDiyWatchlists(data))
    .catch(() => {
      // The in-memory list is still right for this session. Nothing here is money.
    });
}

/** Read the named lists once. Concurrent callers share the same read. */
export function hydrateDiyWatchlists(
  storage: WatchlistStorage = AsyncStorage,
): Promise<void> {
  if (diy.hydrated) return Promise.resolve();
  if (diyHydration) return diyHydration;
  const epoch = generation;
  const read = storage
    .getItem(DIY_WATCHLISTS_STORAGE_KEY)
    .then((raw) => {
      if (epoch !== generation) return;
      writeDiy({
        hydrated: true,
        loadError: false,
        data: mergeDiyWatchlists(diy.data, parseDiyWatchlists(raw)),
      });
    })
    .catch(() => {
      if (epoch !== generation) return;
      writeDiy({ hydrated: true, loadError: true, data: diy.data });
    })
    .finally(() => {
      if (diyHydration === read) diyHydration = null;
    });
  diyHydration = read;
  return read;
}

/**
 * Create, rename, remove, select, and remove a mint.
 * Adding a mint is `addListedMint`.
 */
export type DiyStoredCommand = Exclude<DiyCommand, { type: 'addMint' }>;

function commitDiyResult(
  result: DiyResult,
  storage: WatchlistStorage = AsyncStorage,
): DiyResult {
  if (!result.ok) return result;
  writeDiy({ hydrated: diy.hydrated, loadError: false, data: result.state });
  persistDiy(result.state, storage);
  return result;
}

export function runDiyCommand(
  command: DiyStoredCommand,
  deps: { nowMs?: number; storage?: WatchlistStorage } = {},
): DiyResult {
  return commitDiyResult(
    reduceDiyCommand(diy.data, command, deps.nowMs ?? Date.now()),
    deps.storage ?? AsyncStorage,
  );
}

export function addListedMint(
  listId: string,
  mint: string,
  facts: ListedTokenFacts | null,
  deps: { nowMs?: number; storage?: WatchlistStorage } = {},
): DiyResult {
  const listed = listedTokenFromFacts({ mint, facts });
  if (!listed) {
    return {
      ok: false,
      reason: 'invalid',
      state: diy.data,
    };
  }
  return commitDiyResult(
    reduceDiyCommand(
      diy.data,
      {
        type: 'addMint',
        listId,
        mint: listed.mint,
        symbol: listed.symbol,
        name: listed.name,
      },
      deps.nowMs ?? Date.now(),
    ),
    deps.storage ?? AsyncStorage,
  );
}

export function useDiyWatchlists(): DiyWatchlistsRuntime {
  const snapshot = useSyncExternalStore(
    subscribeWatchlist,
    readDiyWatchlists,
    readDiyWatchlists,
  );
  if (!snapshot.hydrated) void hydrateDiyWatchlists();
  return snapshot;
}

export function __resetWatchlistForTests(): void {
  generation += 1;
  state = EMPTY;
  diy = { hydrated: false, loadError: false, data: EMPTY_DIY_WATCHLISTS };
  published = freezeCopy(diy);
  listeners.clear();
  hydration = null;
  diyHydration = null;
}
