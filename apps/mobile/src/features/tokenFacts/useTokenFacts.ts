import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resolveTokenFactsConfig,
  type TokenFactsConfig,
} from '@/src/lib/apiConfig';
import {
  configClusterDeclineMessage,
  configFetchCluster,
  resolveConfigClusterGate,
} from '@/src/lib/configClusterGate';
import {
  fetchTokenFacts,
  normalizeTokenFactsMint,
  type FetchTokenFactsResult,
} from '@/src/features/tokenFacts/fetchTokenFacts';
import { hookStatusFromApiStatus } from '@/src/features/tokenFacts/parseTokenFacts';
import type {
  TokenFactsHookStatus,
  TokenFactsResponse,
} from '@/src/features/tokenFacts/types';

export type TokenFactsState = {
  status: TokenFactsHookStatus;
  /** Last successfully fetched facts (process memory only). */
  facts: TokenFactsResponse | null;
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

export type TokenFactsCoreState = {
  status: TokenFactsHookStatus;
  facts: TokenFactsResponse | null;
  error: string | null;
};

export type LoadTokenFactsDeps = {
  resolveConfig?: () => Promise<TokenFactsConfig>;
  fetchTokenFactsImpl?: typeof fetchTokenFacts;
  nowMs?: number;
};

/** Generation guard — stale responses must not overwrite newer mint/config fetches. */
export function shouldApplyTokenFactsFetch(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}

export function statusFromFacts(
  facts: TokenFactsResponse,
): Exclude<TokenFactsHookStatus, 'idle' | 'loading' | 'error'> {
  return hookStatusFromApiStatus(facts.status);
}

/** Clears prior mint identity before an initial fetch (mint change or first load). */
export function initialFetchCoreState(): TokenFactsCoreState {
  return { status: 'loading', facts: null, error: null };
}

export function reduceTokenFactsFetch(args: {
  prev: TokenFactsCoreState;
  mode: 'initial' | 'refresh';
  requestedMint: string;
  result: FetchTokenFactsResult;
}): TokenFactsCoreState {
  const { prev, mode, requestedMint, result } = args;
  if (result.ok) {
    return {
      status: statusFromFacts(result.facts),
      facts: result.facts,
      error: null,
    };
  }

  if (
    mode === 'refresh' &&
    prev.facts &&
    prev.facts.mint === requestedMint
  ) {
    return {
      status: statusFromFacts(prev.facts),
      facts: prev.facts,
      error: result.message,
    };
  }

  return {
    status: 'error',
    facts: null,
    error: result.message,
  };
}

export async function loadTokenFacts(
  args: {
    mint: string;
    signal?: AbortSignal;
  },
  deps: LoadTokenFactsDeps = {},
): Promise<FetchTokenFactsResult> {
  const resolveConfig = deps.resolveConfig ?? resolveTokenFactsConfig;
  const fetchImpl = deps.fetchTokenFactsImpl ?? fetchTokenFacts;
  const config = await resolveConfig();
  const gate = resolveConfigClusterGate({
    enabled: config.tokenFactsEnabled,
    network: config.network,
  });
  if (gate.state === 'declined') {
    // No cluster was ever confirmed and TokenFacts is on. No request is sent.
    return {
      ok: false,
      code: 'invalid_request',
      message: configClusterDeclineMessage(gate.reason),
    };
  }
  return fetchImpl({
    mint: args.mint,
    cluster: configFetchCluster(gate),
    tokenFactsEnabled: config.tokenFactsEnabled,
    signal: args.signal,
    nowMs: deps.nowMs,
  });
}

/**
 * Token facts for a single mint. Fetches on mount / mint change; supports abort
 * on unmount or superseded mint. Never gates user actions on `facts.flags`.
 */
export function useTokenFacts(
  mintInput: string | null | undefined,
  deps: LoadTokenFactsDeps = {},
): TokenFactsState {
  const [status, setStatus] = useState<TokenFactsHookStatus>('idle');
  const [facts, setFacts] = useState<TokenFactsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const coreRef = useRef<TokenFactsCoreState>({
    status: 'idle',
    facts: null,
    error: null,
  });

  const resolveConfig = deps.resolveConfig;
  const fetchTokenFactsImpl = deps.fetchTokenFactsImpl;
  const nowMs = deps.nowMs;
  const normalizedMint = normalizeTokenFactsMint(mintInput ?? '');

  const load = useCallback(
    async (mode: 'initial' | 'refresh', mint: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const id = ++requestId.current;
      if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        const cleared = initialFetchCoreState();
        coreRef.current = cleared;
        setStatus(cleared.status);
        setFacts(cleared.facts);
        setError(cleared.error);
      }

      try {
        const result = await loadTokenFacts(
          { mint, signal: controller.signal },
          { resolveConfig, fetchTokenFactsImpl, nowMs },
        );
        if (!shouldApplyTokenFactsFetch(id, requestId.current)) return;

        const next = reduceTokenFactsFetch({
          prev: coreRef.current,
          mode,
          requestedMint: mint,
          result,
        });
        coreRef.current = next;
        setStatus(next.status);
        setFacts(next.facts);
        setError(next.error);
      } finally {
        if (shouldApplyTokenFactsFetch(id, requestId.current)) {
          setRefreshing(false);
        }
      }
    },
    [resolveConfig, fetchTokenFactsImpl, nowMs],
  );

  useEffect(() => {
    if (normalizedMint == null) {
      abortRef.current?.abort();
      requestId.current += 1;
      coreRef.current = { status: 'idle', facts: null, error: null };
      setStatus('idle');
      setFacts(null);
      setError(null);
      setRefreshing(false);
      return;
    }

    void load('initial', normalizedMint);

    return () => {
      abortRef.current?.abort();
    };
  }, [normalizedMint, load]);

  const refresh = useCallback(async () => {
    if (normalizedMint == null) return;
    await load('refresh', normalizedMint);
  }, [load, normalizedMint]);

  return { status, facts, error, refreshing, refresh };
}
