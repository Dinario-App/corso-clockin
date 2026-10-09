import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resolvePricesConfig,
  type PricesConfig,
} from '@/src/lib/apiConfig';
import {
  configClusterDeclineMessage,
  configFetchCluster,
  resolveConfigClusterGate,
} from '@/src/lib/configClusterGate';
import {
  fetchPrices,
  type FetchPricesResult,
} from '@/src/features/balances/fetchPrices';
import {
  snapshotToQuoteMap,
  type PriceSnapshot,
} from '@/src/features/balances/priceSnapshot';
import type { PriceQuoteMap } from '@/src/features/balances/computeFiatTotal';

export type PriceQuotesStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'disabled'
  | 'error';

export type PriceQuotesState = {
  status: PriceQuotesStatus;
  /**
   * Last successfully fetched snapshot (process memory only).
   * Timestamps are preserved as delivered — conversion must still recheck age.
   */
  snapshot: PriceSnapshot | null;
  /**
   * Quote map derived from `snapshot` (disabled → {}).
   * Callers must still age-check via computeFiatTotal; this hook never
   * extends expired quote clocks on refresh failure.
   */
  quotes: PriceQuoteMap;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

export type PriceQuotesCoreState = {
  status: PriceQuotesStatus;
  snapshot: PriceSnapshot | null;
  quotes: PriceQuoteMap;
  error: string | null;
};

export type LoadPriceQuotesDeps = {
  resolveConfig?: () => Promise<PricesConfig>;
  fetchPricesImpl?: typeof fetchPrices;
  nowMs?: number;
  /** Optional public-mint selection for token/swap presentation. */
  mints?: string[];
};

const EMPTY_QUOTES: PriceQuoteMap = {};

/** Generation guard — same semantics as balance hooks. */
export function shouldApplyPriceFetch(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}

/**
 * Map a preserved snapshot to a quote map without inventing prices.
 * Disabled snapshots yield {} so consumers stay on peg/unavailable honesty.
 */
export function quotesFromPreservedSnapshot(
  snapshot: PriceSnapshot | null,
): PriceQuoteMap {
  if (!snapshot || snapshot.status === 'disabled') return { ...EMPTY_QUOTES };
  return snapshotToQuoteMap(snapshot);
}

export function statusFromSnapshot(
  snapshot: PriceSnapshot,
): Exclude<PriceQuotesStatus, 'idle' | 'loading' | 'error'> {
  return snapshot.status;
}

/**
 * Apply a successful / failed price fetch.
 * Refresh failures keep the prior snapshot timestamps intact (no clock bump).
 */
export function reducePriceQuotesFetch(args: {
  prev: PriceQuotesCoreState;
  mode: 'initial' | 'refresh';
  result: FetchPricesResult;
}): PriceQuotesCoreState {
  const { prev, mode, result } = args;
  if (result.ok) {
    return {
      status: statusFromSnapshot(result.snapshot),
      snapshot: result.snapshot,
      quotes: quotesFromPreservedSnapshot(result.snapshot),
      error: null,
    };
  }

  if (mode === 'refresh' && prev.snapshot) {
    return {
      status: statusFromSnapshot(prev.snapshot),
      snapshot: prev.snapshot,
      quotes: quotesFromPreservedSnapshot(prev.snapshot),
      error: result.message,
    };
  }

  return {
    status: 'error',
    snapshot: null,
    quotes: { ...EMPTY_QUOTES },
    error: result.message,
  };
}

export async function loadPriceQuotes(
  deps: LoadPriceQuotesDeps = {},
): Promise<FetchPricesResult> {
  const resolveConfig = deps.resolveConfig ?? resolvePricesConfig;
  const fetchImpl = deps.fetchPricesImpl ?? fetchPrices;
  const config = await resolveConfig();
  const gate = resolveConfigClusterGate({
    enabled: config.pricesEnabled,
    network: config.network,
  });
  if (gate.state === 'declined') {
    // No cluster was ever confirmed and prices are on. No request is sent.
    return {
      ok: false,
      code: 'invalid_request',
      message: configClusterDeclineMessage(gate.reason),
    };
  }
  return fetchImpl({
    cluster: configFetchCluster(gate),
    pricesEnabled: config.pricesEnabled,
    nowMs: deps.nowMs,
    mints: deps.mints,
  });
}

/**
 * Price quotes for a bounded set of valid public Solana mints.
 * Fetches on mount; exposes explicit refresh. Never takes a wallet address.
 */
export function usePriceQuotes(
  deps: LoadPriceQuotesDeps = {},
): PriceQuotesState {
  const [status, setStatus] = useState<PriceQuotesStatus>('idle');
  const [snapshot, setSnapshot] = useState<PriceSnapshot | null>(null);
  const [quotes, setQuotes] = useState<PriceQuoteMap>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const coreRef = useRef<PriceQuotesCoreState>({
    status: 'idle',
    snapshot: null,
    quotes: {},
    error: null,
  });

  const resolveConfig = deps.resolveConfig;
  const fetchPricesImpl = deps.fetchPricesImpl;
  const nowMs = deps.nowMs;
  const mintsKey = deps.mints?.join(',') ?? '';

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setStatus((prev) =>
          prev === 'ready' ||
          prev === 'partial' ||
          prev === 'disabled' ||
          prev === 'unavailable'
            ? prev
            : 'loading',
        );
        setError(null);
      }

      try {
        const result = await loadPriceQuotes({
          resolveConfig,
          fetchPricesImpl,
          nowMs,
          mints: mintsKey ? mintsKey.split(',') : undefined,
        });
        if (!shouldApplyPriceFetch(id, requestId.current)) return;

        const next = reducePriceQuotesFetch({
          prev: coreRef.current,
          mode,
          result,
        });
        coreRef.current = next;
        setStatus(next.status);
        setSnapshot(next.snapshot);
        setQuotes(next.quotes);
        setError(next.error);
      } finally {
        if (shouldApplyPriceFetch(id, requestId.current)) {
          setRefreshing(false);
        }
      }
    },
    [resolveConfig, fetchPricesImpl, nowMs, mintsKey],
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  return { status, snapshot, quotes, error, refreshing, refresh };
}
