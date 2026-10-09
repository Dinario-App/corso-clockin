import { normalizeSolanaAddressInput } from '@/src/ui/controls/addressChipPresentation.js';
import type { SwapToken } from '@/src/features/swap/tokens';

/** Which half of the sheet a row came from. Held rows are never re-sourced. */
export type PickerRowSource = 'held' | 'search';

export type PickerRow = {
  token: SwapToken;
  source: PickerRowSource;
};

export function filterHeldSwapTokens(args: {
  tokens: SwapToken[];
  solHeld: boolean;
  usdcHeld: boolean;
}): SwapToken[] {
  return args.tokens.filter((token) =>
    token.symbol === 'SOL' ? args.solHeld : args.usdcHeld,
  );
}

export function matchPickerQuery(
  tokens: SwapToken[],
  query: string,
): SwapToken[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return tokens;
  const mint = normalizeSolanaAddressInput(trimmed);
  if (mint) {
    return tokens.filter((token) => token.mint === mint);
  }
  const needle = trimmed.toLowerCase();
  return tokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(needle) ||
      token.mint.toLowerCase().includes(needle),
  );
}

/**
 * Holdings that match the query, then search results, de-duplicated by mint.
 *
 * A mint that is both held and returned by search appears once, as a holding.
 * Search results are taken as given — this function does not rank, filter by
 * risk, or drop anything for looking suspicious. Risk is shown on the row, and
 * the resolver's bar is the thing that refuses; hiding a row would just make
 * the refusal look like a bug.
 */
export function buildPickerRows(args: {
  held: SwapToken[];
  searchResults?: SwapToken[];
  query: string;
}): PickerRow[] {
  const heldRows = matchPickerQuery(args.held, args.query).map(
    (token): PickerRow => ({ token, source: 'held' }),
  );
  const seen = new Set(heldRows.map((row) => row.token.mint));

  const searchRows: PickerRow[] = [];
  for (const token of args.searchResults ?? []) {
    if (seen.has(token.mint)) continue;
    seen.add(token.mint);
    searchRows.push({ token, source: 'search' });
  }

  return [...heldRows, ...searchRows];
}
