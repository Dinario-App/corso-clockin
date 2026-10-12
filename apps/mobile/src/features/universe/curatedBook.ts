import { CASH_STABLECOINS, MAJOR_ASSETS } from '@/src/features/balances/majors';
import type { SeriousName } from '@/src/features/home/seriousUniverse';
import {
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
  type SwapToken,
} from '@/src/features/swap/tokens';

export type CuratedName = {
  mint: string;
  symbol: string;
  name: string;
  /**
   * Bundled for the fixed names that carry it. Null for a served name and
   * for cash beside USDC: a picker that needs decimals reads the chain's.
   */
  decimals: number | null;
};

export type CuratedBook = readonly CuratedName[];

type Cluster = 'devnet' | 'mainnet-beta';

const USDC_SYMBOL = 'USDC';

/** The names that need no read. USDC follows the cluster; mainnet when unknown. */
export function fixedCuratedBook(cluster: Cluster | null = null): CuratedBook {
  const book: CuratedName[] = [];
  for (const asset of MAJOR_ASSETS) {
    book.push({
      mint: asset.mint,
      symbol: asset.symbol,
      name: asset.displayName,
      decimals: asset.decimals,
    });
  }
  book.push({
    mint: cluster === 'devnet' ? USDC_MINT_DEVNET : USDC_MINT_MAINNET,
    symbol: USDC_SYMBOL,
    name: USDC_SYMBOL,
    decimals: 6,
  });
  for (const cash of CASH_STABLECOINS) {
    book.push({
      mint: cash.mint,
      symbol: cash.symbol,
      name: cash.displayName,
      decimals: null,
    });
  }
  return dedupe(book);
}

/** Fixed names first, then the served ones, one row per mint. */
export function composeCuratedBook(
  served: readonly SeriousName[],
  cluster: Cluster | null = null,
): CuratedBook {
  return dedupe([
    ...fixedCuratedBook(cluster),
    ...served.map((name) => ({
      mint: name.mint,
      symbol: name.symbol,
      name: name.name,
      decimals: null,
    })),
  ]);
}

export function isCuratedMint(book: CuratedBook, mint: string): boolean {
  return book.some((name) => name.mint === mint);
}

/**
 * Local search over the book: symbol or name, case-insensitive. Exact symbol
 * first, then symbol prefix, then any other match, each in book order.
 * ⛔ Never matches on mint, so pasting an address finds nothing.
 */
export function searchCuratedBook(
  book: CuratedBook,
  query: string,
): CuratedName[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const ranked: { name: CuratedName; rank: number; index: number }[] = [];
  book.forEach((name, index) => {
    const symbol = name.symbol.toLowerCase();
    const rank =
      symbol === needle
        ? 0
        : symbol.startsWith(needle)
          ? 1
          : symbol.includes(needle) || name.name.toLowerCase().includes(needle)
            ? 2
            : -1;
    if (rank >= 0) ranked.push({ name, rank, index });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.name);
}

/** A book row as a swap leg, once its decimals are known. */
export function curatedSwapToken(
  name: CuratedName,
  decimals: number | null = name.decimals,
): SwapToken | null {
  if (decimals == null) return null;
  return { mint: name.mint, symbol: name.symbol, decimals };
}

function dedupe(names: readonly CuratedName[]): CuratedName[] {
  const seen = new Set<string>();
  const out: CuratedName[] = [];
  for (const name of names) {
    if (seen.has(name.mint)) continue;
    seen.add(name.mint);
    out.push(name);
  }
  return out;
}
