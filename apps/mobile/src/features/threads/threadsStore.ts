import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import type { AskSellDoor, AskSwapHandoff } from '@/src/features/ask/askClient';
import {
  EMPTY_LIVE_CARDS,
  NO_FOCUS,
  clampFocus,
  readLiveCards,
  restoreLiveCards,
  subscribeLiveCards,
  threadRecencyMs,
  writeLiveCards,
  type LiveCard,
  type LiveCardDone,
  type LiveCardStatus,
  type LiveCardsState,
  type LiveThreadItem,
} from '@/src/features/switcher/liveCards';
import {
  parseVitalsDisambiguation,
  parseVitalsPayload,
} from '@/src/features/tokenVitals/parseVitals';

export const THREADS_STORAGE_KEY = 'corso.threads.v1';
const THREADS_VERSION = 1;
/** Past this the thread that moved longest ago is not saved. */
export const THREADS_MAX = 50;
/** A thread keeps its newest turns. */
export const THREAD_ITEMS_MAX = 120;
export const THREAD_NAME_MAX = 80;

export type ThreadsStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/* ─── Pure: parse and serialize ─────────────────────────────────────────────── */

const KINDS: readonly LiveCard['kind'][] = ['swap', 'ask', 'movers', 'vitals'];
const STATUSES: readonly LiveCardStatus[] = ['needs-sign', 'signed', 'expired'];
const ATOMIC = /^\d{1,40}$/;

function rec(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function decimals(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 18
    ? (value as number)
    : null;
}

function parseItem(value: unknown): LiveThreadItem | null {
  const item = rec(value);
  if (!item) return null;
  const id = text(item.id, 200);
  const body = text(item.text, 4000);
  if (!id || body === null) return null;
  if (item.role !== 'user' && item.role !== 'coach') return null;
  return { id, role: item.role, text: body };
}

function parseHandoff(value: unknown): AskSwapHandoff | null {
  const swap = rec(value);
  if (!swap) return null;
  const fromSymbol = text(swap.fromSymbol, 32);
  const toSymbol = text(swap.toSymbol, 32);
  const toMint = text(swap.toMint, 64);
  const toDecimals = decimals(swap.toDecimals);
  const inAmountAtomic = text(swap.inAmountAtomic, 40);
  if (
    !fromSymbol ||
    !toSymbol ||
    !toMint ||
    toDecimals === null ||
    !inAmountAtomic ||
    !ATOMIC.test(inAmountAtomic)
  )
    return null;
  if (swap.amountGuard !== undefined && swap.amountGuard !== 'sol-reserve')
    return null;
  return {
    fromSymbol,
    toSymbol,
    toMint,
    toDecimals,
    inAmountAtomic,
    ...(swap.amountGuard === 'sol-reserve'
      ? { amountGuard: 'sol-reserve' as const }
      : {}),
  };
}

function parseDone(value: unknown): LiveCardDone | null {
  const done = rec(value);
  if (!done) return null;
  const payText = text(done.payText, 64);
  const receiveText = text(done.receiveText, 64);
  const receiveSymbol = text(done.receiveSymbol, 32);
  if (payText === null || receiveText === null || receiveSymbol === null)
    return null;
  return { payText, receiveText, receiveSymbol };
}

function parseSellDoor(value: unknown): AskSellDoor | null {
  const door = rec(value);
  if (!door) return null;
  const mint = text(door.mint, 64);
  const symbol = text(door.symbol, 32);
  const label = text(door.label, 120);
  const places = decimals(door.decimals);
  if (!mint || !symbol || !label || places === null) return null;
  return { mint, symbol, decimals: places, label };
}

function parseStrings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length <= max,
  );
}

/** One saved card, rebuilt field by field. `null` when it is not a card. */
export function parseSavedCard(value: unknown): LiveCard | null {
  const card = rec(value);
  if (!card) return null;
  const id = text(card.id, 200);
  const kind = KINDS.find((entry) => entry === card.kind);
  const createdAtMs = finite(card.createdAtMs);
  const title = text(card.title, 1000);
  if (!id || !kind || createdAtMs === null || title === null) return null;
  const status =
    card.status === null ? null : STATUSES.find((entry) => entry === card.status);
  if (status === undefined) return null;
  const thread = Array.isArray(card.thread)
    ? card.thread
        .map(parseItem)
        .filter((item): item is LiveThreadItem => item !== null)
        .slice(-THREAD_ITEMS_MAX)
    : [];
  if (thread.length === 0) return null;
  const name = typeof card.name === 'string' ? card.name.trim() : '';
  const updatedAtMs = finite(card.updatedAtMs);
  const pinnedAtMs = card.pinned === true ? finite(card.pinnedAtMs) : null;
  return {
    id,
    kind,
    createdAtMs,
    updatedAtMs: updatedAtMs ?? createdAtMs,
    title,
    subtitle: text(card.subtitle, 200),
    status,
    thread,
    swap: parseHandoff(card.swap),
    swapAmountText: text(card.swapAmountText, 64),
    done: parseDone(card.done),
    movers: card.movers === true,
    chips: parseStrings(card.chips, 200),
    sellDoors: Array.isArray(card.sellDoors)
      ? card.sellDoors
          .map(parseSellDoor)
          .filter((door): door is AskSellDoor => door !== null)
      : [],
    vitals: parseVitalsPayload(card.vitals),
    vitalsChoices: parseVitalsDisambiguation(card.vitalsChoices),
    unavailable: card.unavailable === true,
    ...(card.perClientRateLimit === true
      ? { perClientRateLimit: true as const }
      : {}),
    ...(card.addMoney === true ? { addMoney: true as const } : {}),
    name: name.length > 0 ? name.slice(0, THREAD_NAME_MAX) : null,
    pinned: card.pinned === true,
    ...(pinnedAtMs !== null ? { pinnedAtMs } : {}),
  };
}

/**
 * Hostile-safe read of the saved JSON for this owner. Anything malformed, of
 * another version, or saved for another wallet reads as no threads.
 */
export function parseThreads(raw: unknown, owner: string): LiveCard[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const body = rec(parsed);
  if (!body || body.version !== THREADS_VERSION || body.owner !== owner)
    return [];
  if (!Array.isArray(body.threads)) return [];
  const seen = new Set<string>();
  const cards: LiveCard[] = [];
  for (const entry of body.threads) {
    const card = parseSavedCard(entry);
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    cards.push(card);
  }
  return capThreads(cards);
}

/** The newest `THREADS_MAX` by last turn, in their original order. */
function capThreads(cards: readonly LiveCard[]): LiveCard[] {
  if (cards.length <= THREADS_MAX) return [...cards];
  const keep = new Set(
    [...cards]
      .sort((a, b) => threadRecencyMs(b) - threadRecencyMs(a))
      .slice(0, THREADS_MAX)
      .map((card) => card.id),
  );
  return cards.filter((card) => keep.has(card.id));
}

/** The seed candles are the one heavy field; restore drops them anyway. */
function slim(card: LiveCard): LiveCard {
  const trimmed = { ...card, thread: card.thread.slice(-THREAD_ITEMS_MAX) };
  if (!card.vitals?.chart.seedCandles) return trimmed;
  const { seedCandles: _candles, ...chart } = card.vitals.chart;
  return { ...trimmed, vitals: { ...card.vitals, chart } };
}

export function serializeThreads(
  owner: string,
  cards: readonly LiveCard[],
): string {
  return JSON.stringify({
    version: THREADS_VERSION,
    owner,
    threads: capThreads(cards).map(slim),
  });
}

/** What Delete took out, kept for its Undo: the card, where it sat, and whether it was on Home. */
export type DeletedThread = {
  card: LiveCard;
  index: number;
  wasFocused: boolean;
};

function changeCard(
  state: LiveCardsState,
  id: string,
  change: (card: LiveCard) => LiveCard | null,
): LiveCardsState {
  const index = state.cards.findIndex((card) => card.id === id);
  if (index < 0) return state;
  const next = change(state.cards[index]!);
  if (next === null) return state;
  const cards = state.cards.slice();
  cards[index] = next;
  return { cards, focusIndex: state.focusIndex };
}

/**
 * The name the person gave a thread. Trimmed and capped; a blank one clears
 * it, so the row shows the auto-title again. The title underneath and the
 * thread's place in the list do not move.
 */
export function renameThread(
  state: LiveCardsState,
  id: string,
  name: string | null,
): LiveCardsState {
  const trimmed = (name ?? '').trim().slice(0, THREAD_NAME_MAX).trim();
  const next = trimmed.length > 0 ? trimmed : null;
  return changeCard(state, id, (card) =>
    (card.name ?? null) === next ? null : { ...card, name: next },
  );
}

export function setThreadPinned(
  state: LiveCardsState,
  id: string,
  pinned: boolean,
  nowMs: number,
): LiveCardsState {
  return changeCard(state, id, (card) => {
    if ((card.pinned === true) === pinned) return null;
    const { pinnedAtMs: _was, ...rest } = card;
    return pinned ? { ...rest, pinned: true, pinnedAtMs: nowMs } : { ...rest, pinned: false };
  });
}

export function deleteThread(
  state: LiveCardsState,
  id: string,
): { state: LiveCardsState; removed: DeletedThread | null } {
  const index = state.cards.findIndex((card) => card.id === id);
  if (index < 0) return { state, removed: null };
  const hasFocus = state.focusIndex !== NO_FOCUS;
  const focus = clampFocus(state.focusIndex, state.cards.length);
  const wasFocused = hasFocus && focus === index;
  const cards = state.cards.filter((_, at) => at !== index);
  const focusIndex = !hasFocus || wasFocused ? NO_FOCUS : index < focus ? focus - 1 : focus;
  return {
    state: { cards, focusIndex },
    removed: { card: state.cards[index]!, index, wasFocused },
  };
}

/**
 * Undo: the same card, back where it sat. It takes Home back only if it was on
 * Home and nothing has taken its place since. A second Undo does nothing.
 */
export function undoDeleteThread(
  state: LiveCardsState,
  removed: DeletedThread,
): LiveCardsState {
  if (state.cards.some((card) => card.id === removed.card.id)) return state;
  const index = Math.min(Math.max(0, removed.index), state.cards.length);
  const cards = [
    ...state.cards.slice(0, index),
    removed.card,
    ...state.cards.slice(index),
  ];
  if (state.focusIndex === NO_FOCUS || state.cards.length === 0) {
    return { cards, focusIndex: removed.wasFocused ? index : NO_FOCUS };
  }
  const focus = clampFocus(state.focusIndex, state.cards.length);
  return { cards, focusIndex: index <= focus ? focus + 1 : focus };
}

/* ─── Store binding ─────────────────────────────────────────────────────────── */

let boundOwner: string | null = null;
let boundStorage: ThreadsStorage = AsyncStorage;
let hydration: Promise<void> | null = null;
/** Bumped by every bind and clear, so a read that lands late is dropped. */
let generation = 0;
let stopMirror: (() => void) | null = null;

function persist(owner: string, storage: ThreadsStorage): void {
  void storage
    .setItem(THREADS_STORAGE_KEY, serializeThreads(owner, readLiveCards().cards))
    .catch(() => {
      // The threads in memory are still right for this session, and the next
      // turn retries the write. Nothing here is money, so no alarm is raised.
    });
}

function stopMirroring(): void {
  stopMirror?.();
  stopMirror = null;
}

/**
 * Bind the store to the signed-in wallet: read its saved threads back, then
 * mirror every change to disk. Idempotent per owner.
 *
 * - `null` (no session, or a session mid-resume) changes nothing.
 * - A different wallet than the bound one wipes the threads in memory first:
 *   one person's threads never show under another's wallet.
 * - Nothing is written until the read has landed, so a turn that lands during
 *   the read can never overwrite the saved threads with a shorter list.
 */
export function bindThreadsOwner(
  owner: string | null,
  storage: ThreadsStorage = AsyncStorage,
): Promise<void> {
  if (owner === null || owner.length === 0) return Promise.resolve();
  if (owner === boundOwner && storage === boundStorage) {
    return hydration ?? Promise.resolve();
  }
  const switching = boundOwner !== null && boundOwner !== owner;
  stopMirroring();
  generation += 1;
  const bind = generation;
  boundOwner = owner;
  boundStorage = storage;
  if (switching) writeLiveCards(EMPTY_LIVE_CARDS);

  const read = storage
    .getItem(THREADS_STORAGE_KEY)
    .then(
      (raw) => {
        if (bind !== generation) return;
        writeLiveCards(restoreLiveCards(readLiveCards(), parseThreads(raw, owner)));
      },
      () => {
        // Unreadable: this session starts from what is in memory.
      },
    )
    .then(() => {
      if (bind !== generation) return;
      stopMirror = subscribeLiveCards(() => persist(owner, storage));
      persist(owner, storage);
    })
    .finally(() => {
      if (hydration === read) hydration = null;
    });
  hydration = read;
  return read;
}

export async function clearThreadsOnSignOut(
  storage: ThreadsStorage = boundStorage,
): Promise<void> {
  generation += 1;
  stopMirroring();
  boundOwner = null;
  hydration = null;
  writeLiveCards(EMPTY_LIVE_CARDS);
  await storage.removeItem(THREADS_STORAGE_KEY);
}

export function renameThreadInStore(id: string, name: string | null): void {
  writeLiveCards(renameThread(readLiveCards(), id, name));
}

export function pinThreadInStore(
  id: string,
  pinned: boolean,
  nowMs: number = Date.now(),
): void {
  writeLiveCards(setThreadPinned(readLiveCards(), id, pinned, nowMs));
}

/** Deletes the thread and returns what its Undo needs, or `null` when there was none. */
export function deleteThreadInStore(id: string): DeletedThread | null {
  const { state, removed } = deleteThread(readLiveCards(), id);
  writeLiveCards(state);
  return removed;
}

export function undoDeleteThreadInStore(removed: DeletedThread): void {
  writeLiveCards(undoDeleteThread(readLiveCards(), removed));
}

/**
 * The signed-in shell's one line: keep the threads bound to this wallet.
 * `owner` is the session's wallet address, or `null` while there is none.
 */
export function useThreadsPersistence(owner: string | null): void {
  useEffect(() => {
    void bindThreadsOwner(owner);
  }, [owner]);
}

export function __resetThreadsStoreForTests(): void {
  generation += 1;
  stopMirroring();
  boundOwner = null;
  boundStorage = AsyncStorage;
  hydration = null;
}
