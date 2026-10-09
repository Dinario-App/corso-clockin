import { copy } from '@/constants/copy';
import {
  isWatchlistMint,
  normalizeWatchName,
  normalizeWatchSymbol,
} from './watchlistEntry';

export type ListedTokenFacts = {
  symbol: string | null;
  name: string | null;
};

export function listedTokenFromFacts(args: {
  mint: string;
  facts: ListedTokenFacts | null;
  typedSymbol?: string;
}): { mint: string; symbol: string; name: string | null } | null {
  if (!isWatchlistMint(args.mint)) return null;
  const ticker = args.facts ? normalizeWatchSymbol(args.facts.symbol) : null;
  if (!ticker) {
    return {
      mint: args.mint,
      symbol: copy.diyLists.unknownToken,
      name: null,
    };
  }
  return {
    mint: args.mint,
    symbol: ticker,
    name: normalizeWatchName(args.facts?.name ?? null),
  };
}
