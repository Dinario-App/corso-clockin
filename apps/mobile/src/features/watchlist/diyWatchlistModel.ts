import { copy } from '@/constants/copy';
import { MAX_PRICE_MINTS } from '@/src/features/balances/priceSnapshot';
import {
  isWatchlistMint,
  normalizeWatchName,
  normalizeWatchSymbol,
  normalizeWatchlist,
  type WatchedToken,
} from './watchlistEntry';

export const DIY_WATCHLISTS_STORAGE_KEY = 'corso.diyWatchlists.v1';
/** Named lists on one phone. Only the selected list is priced. */
export const DIY_LIST_MAX = 8;
/** One price batch covers the whole selected list. */
export const DIY_LIST_MINT_MAX = MAX_PRICE_MINTS;
export const DIY_NAME_MAX = 24;

export type DiyList = {
  id: string;
  name: string;
  tokens: readonly WatchedToken[];
};

export type DiyWatchlists = {
  lists: readonly DiyList[];
  selectedId: string | null;
  nextSeq: number;
};

export const EMPTY_DIY_WATCHLISTS: DiyWatchlists = Object.freeze({
  lists: Object.freeze([]) as readonly DiyList[],
  selectedId: null,
  nextSeq: 1,
});

export type DiyCommand =
  | { type: 'create'; name: string }
  | { type: 'rename'; id: string; name: string }
  | { type: 'removeList'; id: string }
  | { type: 'select'; id: string }
  | {
      type: 'addMint';
      listId: string;
      mint: string;
      symbol: string;
      name?: string | null;
    }
  | { type: 'removeMint'; listId: string; mint: string };

export type DiyFailure = 'invalid' | 'full' | 'missing';

export type DiyResult =
  | { ok: true; state: DiyWatchlists }
  | { ok: false; reason: DiyFailure; state: DiyWatchlists };

export function cleanDiyName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0 || trimmed.length > DIY_NAME_MAX) return null;
  return trimmed;
}

export function listId(seq: number): string {
  return `list-${seq}`;
}

/** A ticker, or the unresolved label, which is not a ticker. */
function acceptListedSymbol(value: unknown): string | null {
  if (value === copy.diyLists.unknownToken) return copy.diyLists.unknownToken;
  return normalizeWatchSymbol(value);
}

export function watchEntry(
  input: { mint: string; symbol: string; name?: string | null },
  nowMs: number,
): WatchedToken | null {
  if (!isWatchlistMint(input.mint)) return null;
  const symbol = acceptListedSymbol(input.symbol);
  if (symbol == null) return null;
  if (!Number.isFinite(nowMs)) return null;
  return {
    mint: input.mint,
    symbol,
    name: normalizeWatchName(input.name ?? null),
    addedAtMs: nowMs,
  };
}

export function capTokens(tokens: readonly WatchedToken[]): WatchedToken[] {
  return normalizeWatchlist(tokens).slice(0, DIY_LIST_MINT_MAX);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseToken(value: unknown): WatchedToken | null {
  const record = asRecord(value);
  if (!record) return null;
  if (!isWatchlistMint(record.mint)) return null;
  const symbol = acceptListedSymbol(record.symbol);
  if (symbol == null) return null;
  const addedAtMs =
    typeof record.addedAtMs === 'number' && Number.isFinite(record.addedAtMs)
      ? record.addedAtMs
      : null;
  if (addedAtMs == null) return null;
  return {
    mint: record.mint,
    symbol,
    name: normalizeWatchName(record.name),
    addedAtMs,
  };
}

function parseList(value: unknown): DiyList | null {
  const record = asRecord(value);
  if (!record || typeof record.id !== 'string' || record.id.length === 0) {
    return null;
  }
  const name = cleanDiyName(record.name);
  if (name == null) return null;
  if (!Array.isArray(record.tokens)) return null;
  const tokens: WatchedToken[] = [];
  for (const item of record.tokens) {
    const token = parseToken(item);
    if (token) tokens.push(token);
  }
  return { id: record.id, name, tokens: capTokens(tokens) };
}

/** Hostile-safe. Malformed JSON, bad mints and extra lists become a shortlist. */
export function parseDiyWatchlists(raw: unknown): DiyWatchlists {
  if (typeof raw !== 'string' || raw.length === 0) return EMPTY_DIY_WATCHLISTS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return EMPTY_DIY_WATCHLISTS;
  }
  const record = asRecord(parsed);
  if (!record || !Array.isArray(record.lists)) return EMPTY_DIY_WATCHLISTS;
  const lists: DiyList[] = [];
  const seen = new Set<string>();
  for (const item of record.lists) {
    const list = parseList(item);
    if (!list || seen.has(list.id)) continue;
    seen.add(list.id);
    lists.push(list);
    if (lists.length >= DIY_LIST_MAX) break;
  }
  const selectedId =
    typeof record.selectedId === 'string' && seen.has(record.selectedId)
      ? record.selectedId
      : null;
  let nextSeq =
    typeof record.nextSeq === 'number' &&
    Number.isSafeInteger(record.nextSeq) &&
    record.nextSeq > 0
      ? record.nextSeq
      : 1;
  for (const list of lists) {
    const match = /^list-(\d+)$/.exec(list.id);
    if (!match) continue;
    const seq = Number(match[1]);
    if (Number.isSafeInteger(seq) && seq >= nextSeq) nextSeq = seq + 1;
  }
  return { lists, selectedId, nextSeq };
}

export function serializeDiyWatchlists(state: DiyWatchlists): string {
  const normalized = normalizeDiyWatchlists(state);
  return JSON.stringify({
    version: 1,
    selectedId: normalized.selectedId,
    nextSeq: normalized.nextSeq,
    lists: normalized.lists,
  });
}

export function normalizeDiyWatchlists(state: DiyWatchlists): DiyWatchlists {
  const lists: DiyList[] = [];
  const seen = new Set<string>();
  for (const list of state.lists) {
    const name = cleanDiyName(list.name);
    if (name == null || seen.has(list.id) || list.id.length === 0) continue;
    seen.add(list.id);
    lists.push({ id: list.id, name, tokens: capTokens(list.tokens) });
    if (lists.length >= DIY_LIST_MAX) break;
  }
  const selectedId =
    state.selectedId != null && seen.has(state.selectedId)
      ? state.selectedId
      : null;
  let nextSeq =
    Number.isSafeInteger(state.nextSeq) && state.nextSeq > 0
      ? state.nextSeq
      : 1;
  for (const list of lists) {
    const match = /^list-(\d+)$/.exec(list.id);
    if (!match) continue;
    const seq = Number(match[1]);
    if (seq >= nextSeq) nextSeq = seq + 1;
  }
  return { lists, selectedId, nextSeq };
}

export function selectedDiyList(state: DiyWatchlists): DiyList | null {
  return state.lists.find((list) => list.id === state.selectedId) ?? null;
}

/**
 * A list edited while the disk read was in flight wins. Disk-only lists are
 * kept. The mint cap still applies after the union.
 */
export function mergeDiyWatchlists(
  memory: DiyWatchlists,
  disk: DiyWatchlists,
): DiyWatchlists {
  const local = normalizeDiyWatchlists(memory);
  const stored = normalizeDiyWatchlists(disk);
  if (local.lists.length === 0 && local.selectedId == null) {
    return normalizeDiyWatchlists({
      ...stored,
      nextSeq: Math.max(local.nextSeq, stored.nextSeq),
    });
  }
  const localIds = new Set(local.lists.map((list) => list.id));
  const diskById = new Map(stored.lists.map((list) => [list.id, list]));
  const lists = local.lists.map((list) => {
    const previous = diskById.get(list.id);
    if (!previous) return list;
    return { ...list, tokens: capTokens([...list.tokens, ...previous.tokens]) };
  });
  for (const list of stored.lists) {
    if (!localIds.has(list.id)) lists.push(list);
  }
  return normalizeDiyWatchlists({
    lists,
    selectedId: local.selectedId ?? stored.selectedId,
    nextSeq: Math.max(local.nextSeq, stored.nextSeq),
  });
}

function fail(state: DiyWatchlists, reason: DiyFailure): DiyResult {
  return { ok: false, reason, state };
}

function freshId(state: DiyWatchlists): { id: string; nextSeq: number } {
  const taken = new Set(state.lists.map((list) => list.id));
  let seq = state.nextSeq > 0 ? state.nextSeq : 1;
  let id = listId(seq);
  while (taken.has(id)) {
    seq += 1;
    id = listId(seq);
  }
  return { id, nextSeq: seq + 1 };
}

/**
 * Pure create / rename / remove / select / add / remove. Never throws.
 * The store commits this result. Callers do not persist it themselves.
 */
export function reduceDiyCommand(
  state: DiyWatchlists,
  command: DiyCommand,
  nowMs: number,
): DiyResult {
  const current = normalizeDiyWatchlists(state);
  if (command.type === 'create') {
    const name = cleanDiyName(command.name);
    if (name == null) return fail(current, 'invalid');
    if (current.lists.length >= DIY_LIST_MAX) return fail(current, 'full');
    const minted = freshId(current);
    const list: DiyList = { id: minted.id, name, tokens: [] };
    return {
      ok: true,
      state: {
        lists: [list, ...current.lists],
        selectedId: list.id,
        nextSeq: minted.nextSeq,
      },
    };
  }
  if (command.type === 'rename') {
    const name = cleanDiyName(command.name);
    if (name == null) return fail(current, 'invalid');
    if (!current.lists.some((list) => list.id === command.id)) {
      return fail(current, 'missing');
    }
    return {
      ok: true,
      state: {
        ...current,
        lists: current.lists.map((list) =>
          list.id === command.id ? { ...list, name } : list,
        ),
      },
    };
  }
  if (command.type === 'removeList') {
    if (!current.lists.some((list) => list.id === command.id)) {
      return fail(current, 'missing');
    }
    const lists = current.lists.filter((list) => list.id !== command.id);
    const selectedId =
      current.selectedId === command.id
        ? (lists[0]?.id ?? null)
        : current.selectedId;
    return { ok: true, state: { ...current, lists, selectedId } };
  }
  if (command.type === 'select') {
    if (!current.lists.some((list) => list.id === command.id)) {
      return fail(current, 'missing');
    }
    return { ok: true, state: { ...current, selectedId: command.id } };
  }
  const list = current.lists.find((item) => item.id === command.listId);
  if (!list) return fail(current, 'missing');
  if (command.type === 'removeMint') {
    return {
      ok: true,
      state: {
        ...current,
        lists: current.lists.map((item) =>
          item.id === list.id
            ? {
                ...item,
                tokens: item.tokens.filter(
                  (token) => token.mint !== command.mint,
                ),
              }
            : item,
        ),
      },
    };
  }
  const entry = watchEntry(command, nowMs);
  if (!entry) return fail(current, 'invalid');
  const exists = list.tokens.some((token) => token.mint === entry.mint);
  if (!exists && list.tokens.length >= DIY_LIST_MINT_MAX) {
    return fail(current, 'full');
  }
  return {
    ok: true,
    state: {
      ...current,
      lists: current.lists.map((item) =>
        item.id === list.id
          ? { ...item, tokens: capTokens([entry, ...item.tokens]) }
          : item,
      ),
    },
  };
}
