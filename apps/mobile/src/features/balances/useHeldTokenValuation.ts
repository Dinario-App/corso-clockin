import { useCallback, useEffect, useState } from 'react';
import type { HoldingsBook } from './holdingsBook';
import type { HeldFactsMap } from './walletHoldings';
import type { PriceQuoteMap } from './computeFiatTotal';
import { loadTokenFacts } from '../tokenFacts/useTokenFacts';
import { loadPriceQuotes } from './usePriceQuotes';
import { snapshotToQuoteMap, MAX_PRICE_MINTS } from './priceSnapshot';
export const HELD_FACTS_REFRESH_MS = 30_000;
/** Public mints only, bounded concurrency; never logs a portfolio. */
export function useHeldTokenValuation(book: HoldingsBook) {
  const key =
    book.status === 'ready'
      ? `${book.owner}:${book.cluster}:${[...book.byMint.values()]
          .filter((r) => r.atomic > 0n)
          .map((r) => r.mint)
          .join(',')}`
      : '';
  const [state, setState] = useState<{
    key: string;
    facts: HeldFactsMap;
    quotes: PriceQuoteMap;
  }>({ key: '', facts: {}, quotes: {} });
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (book.status !== 'ready') return;
    const mints = [...book.byMint.values()]
      .filter((r) => r.atomic > 0n)
      .map((r) => r.mint);
    void (async () => {
      const facts: HeldFactsMap = {};
      const quotes: PriceQuoteMap = {};
      for (let start = 0; start < mints.length; start += 4) {
        if (cancelled) return;
        await Promise.all(
          mints.slice(start, start + 4).map(async (mint) => {
            try {
              const result = await loadTokenFacts({ mint });
              if (result.ok && result.facts.cluster === book.cluster)
                facts[mint] = result.facts;
            } catch {
              /* unknown retained */
            }
          }),
        );
      }
      for (let start = 0; start < mints.length; start += MAX_PRICE_MINTS) {
        if (cancelled) return;
        try {
          const result = await loadPriceQuotes({
            mints: mints.slice(start, start + MAX_PRICE_MINTS),
          });
          if (result.ok && result.snapshot.cluster === book.cluster)
            Object.assign(quotes, snapshotToQuoteMap(result.snapshot));
        } catch {
          /* unknown retained */
        }
      }
      if (!cancelled) setState({ key, facts, quotes });
    })();
    return () => {
      cancelled = true;
    };
    // book's identity/mint key prevents cross-wallet reuse; timestamps drive refresh.
  }, [key, book.status === 'ready' ? book.asOfMs : null, generation]);
  useEffect(() => {
    if (book.status !== 'ready') return;
    // `generation` is deliberately not a dependency: the timer must survive the
    // bumps it issues, or it would tear itself down on its first tick.
    const timer = setInterval(
      () => setGeneration((n) => n + 1),
      HELD_FACTS_REFRESH_MS,
    );
    return () => clearInterval(timer);
  }, [key, book.status]);
  const refresh = useCallback(async () => {
    setGeneration((n) => n + 1);
  }, []);
  return {
    facts: state.key === key ? state.facts : {},
    quotes: state.key === key ? state.quotes : {},
    refresh,
  };
}
