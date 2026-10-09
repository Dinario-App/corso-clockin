import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicAppConfig } from '@/src/lib/apiConfig';
import type { SessionType } from '@/src/features/session/types';
import {
  fetchHoldingsViaApi,
  type FetchHoldingsResult,
} from './fetchHoldingsViaApi';
import {
  holdingsBookError,
  holdingsBookReady,
  IDLE_HOLDINGS_BOOK,
  LOADING_HOLDINGS_BOOK,
  type HoldingsBook,
} from './holdingsBook';

export type HoldingsSessionInput = Readonly<{
  type: SessionType;
  address: string;
}> | null | undefined;

export type HoldingsState = {
  book: HoldingsBook;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

export function holdingsBookFromResult(
  result: FetchHoldingsResult,
): HoldingsBook {
  if (!result.ok) return holdingsBookError(result.code);
  return holdingsBookReady({
    owner: result.owner,
    cluster: result.cluster,
    asOfMs: result.asOfMs,
    holdings: result.holdings,
  });
}

/**
 * Whether a completed fetch may still apply to UI state.
 *
 * Sessions switch. A book that arrived for the previous wallet must never land
 * on the current one — `fetchHoldingsViaApi` already refuses an owner that
 * disagrees with the session it was CALLED with, and this is the second guard,
 * for the case where the session changed while that call was in flight.
 */
export function shouldApplyHoldingsFetch(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}

export function useHoldings(args: {
  session: HoldingsSessionInput;
  cluster: PublicAppConfig['cluster'] | null;
  /** `usePrivy().getAccessToken`. */
  getAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}): HoldingsState {
  const [book, setBook] = useState<HoldingsBook>(IDLE_HOLDINGS_BOOK);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const sessionType = args.session?.type ?? null;
  const address = args.session?.address ?? null;
  const { cluster, getAccessToken, fetchImpl } = args;

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!sessionType || !address || !cluster) {
        requestId.current += 1;
        setBook(IDLE_HOLDINGS_BOOK);
        setRefreshing(false);
        return;
      }

      const id = ++requestId.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setBook(LOADING_HOLDINGS_BOOK);
      }

      let result: FetchHoldingsResult;
      try {
        result = await fetchHoldingsViaApi({
          session: { type: sessionType, address },
          cluster,
          getAccessToken,
          ...(fetchImpl ? { fetchImpl } : {}),
        });
      } catch {
        // The client returns rather than throws, so this is belt-and-braces —
        // and it still refuses rather than inventing an empty book.
        result = { ok: false, code: 'network' } as const;
      }

      if (!shouldApplyHoldingsFetch(id, requestId.current)) return;
      setBook(holdingsBookFromResult(result));
      setRefreshing(false);
    },
    [address, cluster, fetchImpl, getAccessToken, sessionType],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  return { book, refreshing, refresh };
}
