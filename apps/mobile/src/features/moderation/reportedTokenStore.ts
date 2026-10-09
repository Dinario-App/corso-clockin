import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { MOVING_MINT_PATTERN } from '@/src/features/moving/types';

export const REPORTED_TOKENS_STORAGE_KEY = 'corso.reportedTokens.v1';
/**
 * A person reports a handful of pairs, not a feed. Past this the newest report
 * evicts the oldest, which keeps the suppression list from growing without
 * bound on a device that never clears storage. The evicted pair reappears only
 * if the server still serves it, and by then the report has been filed.
 */
export const REPORTED_TOKENS_MAX = 200;

export type ReportedToken = {
  mint: string;
  reportedAtMs: number;
};

export type ReportedTokensState = {
  /** False until AsyncStorage has been read once. */
  hydrated: boolean;
  /** Newest report first. */
  tokens: readonly ReportedToken[];
};

export type ReportedTokenStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const EMPTY: ReportedTokensState = Object.freeze({
  hydrated: false,
  tokens: Object.freeze([]) as readonly ReportedToken[],
});

let state: ReportedTokensState = EMPTY;
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;
let generation = 0;

/* ─── Pure ──────────────────────────────────────────────────────────────────── */

export function isReportableMint(value: unknown): value is string {
  return typeof value === 'string' && MOVING_MINT_PATTERN.test(value);
}

function parseEntry(value: unknown): ReportedToken | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!isReportableMint(record.mint)) return null;
  const reportedAtMs =
    typeof record.reportedAtMs === 'number' &&
    Number.isFinite(record.reportedAtMs)
      ? record.reportedAtMs
      : null;
  if (reportedAtMs === null) return null;
  return { mint: record.mint, reportedAtMs };
}

/** Newest first, one entry per mint, capped. Never throws. */
export function normalizeReportedTokens(
  entries: readonly ReportedToken[],
): ReportedToken[] {
  const byMint = new Map<string, ReportedToken>();
  for (const entry of entries) {
    const existing = byMint.get(entry.mint);
    if (!existing || entry.reportedAtMs > existing.reportedAtMs)
      byMint.set(entry.mint, entry);
  }
  return [...byMint.values()]
    .sort((a, b) => b.reportedAtMs - a.reportedAtMs)
    .slice(0, REPORTED_TOKENS_MAX);
}

/** Hostile-safe read of the persisted JSON. Anything malformed is the empty list. */
export function parseReportedTokens(raw: unknown): ReportedToken[] {
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
  const entries: ReportedToken[] = [];
  for (const item of list) {
    const entry = parseEntry(item);
    if (entry) entries.push(entry);
  }
  return normalizeReportedTokens(entries);
}

export function serializeReportedTokens(
  tokens: readonly ReportedToken[],
): string {
  return JSON.stringify({
    version: 1,
    tokens: normalizeReportedTokens(tokens),
  });
}

export function isReported(
  tokens: readonly ReportedToken[],
  mint: string,
): boolean {
  return tokens.some((token) => token.mint === mint);
}

export function addReported(
  tokens: readonly ReportedToken[],
  mint: string,
  nowMs: number,
): ReportedToken[] {
  const entry = parseEntry({ mint, reportedAtMs: nowMs });
  if (!entry) return [...tokens];
  return normalizeReportedTokens([entry, ...tokens]);
}

/** The set the list presenters filter against. */
export function reportedMintSet(
  tokens: readonly ReportedToken[],
): ReadonlySet<string> {
  return new Set(tokens.map((token) => token.mint));
}

/* ─── Store ─────────────────────────────────────────────────────────────────── */

export function readReportedTokens(): ReportedTokensState {
  return state;
}

export function subscribeReportedTokens(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(next: ReportedTokensState): void {
  state = next;
  for (const listener of listeners) listener();
}

function persist(
  tokens: readonly ReportedToken[],
  storage: ReportedTokenStorage,
): void {
  void storage
    .setItem(REPORTED_TOKENS_STORAGE_KEY, serializeReportedTokens(tokens))
    .catch(() => {
      // The in-memory hide is already in force for this session, which is the
      // promise the copy makes. A failed write costs the hide on the NEXT
      // launch only, and the report itself has already been sent.
    });
}

/** Read the persisted list once. Concurrent callers share the same read. */
export function hydrateReportedTokens(
  storage: ReportedTokenStorage = AsyncStorage,
): Promise<void> {
  if (state.hydrated) return Promise.resolve();
  if (hydration) return hydration;
  const epoch = generation;
  const read = storage
    .getItem(REPORTED_TOKENS_STORAGE_KEY)
    .then((raw) => {
      if (epoch !== generation) return;
      // A report filed while the read was in flight wins over disk.
      const merged = normalizeReportedTokens([
        ...state.tokens,
        ...parseReportedTokens(raw),
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

export async function clearReportedTokensFromPhone(
  storage: { removeItem: (key: string) => Promise<void> } = AsyncStorage,
): Promise<void> {
  generation += 1;
  hydration = null;
  write({ hydrated: true, tokens: EMPTY.tokens });
  await storage.removeItem(REPORTED_TOKENS_STORAGE_KEY);
}

/**
 * Hide a pair for this install. Idempotent: reporting twice is one entry, so
 * a retry after a failed send never grows the list.
 */
export function hideReportedToken(
  mint: string,
  deps: { nowMs?: number; storage?: ReportedTokenStorage } = {},
): void {
  const tokens = addReported(state.tokens, mint, deps.nowMs ?? Date.now());
  write({ hydrated: state.hydrated, tokens });
  persist(tokens, deps.storage ?? AsyncStorage);
}

export type UseReportedTokens = ReportedTokensState & {
  isReported: (mint: string) => boolean;
  mints: ReadonlySet<string>;
  hide: (mint: string) => void;
};

/** The screen's view of the store. Hydrates on first use. */
export function useReportedTokens(): UseReportedTokens {
  const snapshot = useSyncExternalStore(
    subscribeReportedTokens,
    readReportedTokens,
    readReportedTokens,
  );
  if (!snapshot.hydrated) void hydrateReportedTokens();
  return {
    ...snapshot,
    isReported: (mint) => isReported(snapshot.tokens, mint),
    mints: reportedMintSet(snapshot.tokens),
    hide: (mint) => hideReportedToken(mint),
  };
}

export function __resetReportedTokensForTests(): void {
  generation += 1;
  state = EMPTY;
  listeners.clear();
  hydration = null;
}
