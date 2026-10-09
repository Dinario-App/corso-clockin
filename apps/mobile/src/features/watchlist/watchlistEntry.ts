/**
 * Pure mint/symbol checks shared by the star list and named lists.
 * Kept out of the store module so neither list imports the other's runtime.
 */
import { MOVING_MINT_PATTERN } from '@/src/features/moving/types';

/** A watchlist is a shortlist. Past this the newest star evicts the oldest. */
export const WATCHLIST_MAX = 24;
export const WATCHLIST_SYMBOL_MAX = 16;
export const WATCHLIST_NAME_MAX = 48;

export type WatchedToken = {
  mint: string;
  symbol: string;
  name: string | null;
  addedAtMs: number;
};

export function isWatchlistMint(value: unknown): value is string {
  return typeof value === 'string' && MOVING_MINT_PATTERN.test(value);
}

export function normalizeWatchSymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, '');
  if (trimmed.length === 0 || trimmed.length > WATCHLIST_SYMBOL_MAX)
    return null;
  return trimmed.toUpperCase();
}

export function normalizeWatchName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, WATCHLIST_NAME_MAX);
}

/** Newest first, one entry per mint, capped. Never throws. */
export function normalizeWatchlist(
  entries: readonly WatchedToken[],
): WatchedToken[] {
  const byMint = new Map<string, WatchedToken>();
  for (const entry of entries) {
    const existing = byMint.get(entry.mint);
    if (!existing || entry.addedAtMs > existing.addedAtMs)
      byMint.set(entry.mint, entry);
  }
  return [...byMint.values()]
    .sort((a, b) => b.addedAtMs - a.addedAtMs)
    .slice(0, WATCHLIST_MAX);
}
