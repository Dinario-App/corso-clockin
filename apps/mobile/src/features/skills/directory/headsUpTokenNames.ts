import { safeAlertSymbol } from '@/src/features/priceAlerts/alertCopy';
import { fetchTokenSearch } from '@/src/features/swap/fetchTokenSearch';

export type HeadsUpSymbols = Readonly<Record<string, string>>;

/** The row's token: a resolved symbol, else `So1111…1112`. */
export function headsUpTokenLabel(mint: string, symbols: HeadsUpSymbols): string {
  return safeAlertSymbol(symbols[mint]) ?? `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}

/** One search per distinct mint; a mint whose search fails is left out. */
export async function resolveHeadsUpSymbols(
  mints: readonly string[],
  signal: AbortSignal,
  search: typeof fetchTokenSearch = fetchTokenSearch,
): Promise<Record<string, string>> {
  const unique = [...new Set(mints)];
  const found = await Promise.all(
    unique.map(async (mint) => {
      try {
        const rows = await search({ query: mint, signal });
        const symbol = safeAlertSymbol(
          rows.find((row) => row.token.mint === mint)?.token.symbol,
        );
        return symbol ? ([mint, symbol] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  const symbols: Record<string, string> = {};
  for (const entry of found) if (entry) symbols[entry[0]] = entry[1];
  return symbols;
}
