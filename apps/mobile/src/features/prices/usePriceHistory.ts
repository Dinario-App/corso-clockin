import { useEffect, useState } from 'react';
import {
  fetchPriceHistory,
  type FetchPriceHistoryResult,
  type PriceHistoryChartPoint,
  type PriceHistoryRange,
} from '@/src/features/prices/fetchPriceHistory';
import { resolvePricesConfig } from '@/src/lib/apiConfig';

export type PriceHistoryState = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  series: PriceHistoryChartPoint[] | null;
  source: string | null;
  coverageKind: 'top_indexed_pool' | 'token_aggregated' | null;
  poolAddress: string | null;
  liquidityUsd: string | null;
  volume24hUsd: string | null;
  marketDataAsOfMs: number | null;
};

type KeyedPriceHistoryState = PriceHistoryState & { key: string | null };

export function priceHistoryStateFromResult(
  result: FetchPriceHistoryResult,
): PriceHistoryState {
  return result.ok
    ? {
        status: 'ready',
        series: result.series,
        source: result.source,
        coverageKind: result.coverageKind,
        poolAddress: result.poolAddress,
        liquidityUsd: result.liquidityUsd,
        volume24hUsd: result.volume24hUsd,
        marketDataAsOfMs: result.marketDataAsOfMs,
      }
    : {
        status: 'unavailable',
        series: null,
        source: null,
        coverageKind: null,
        poolAddress: null,
        liquidityUsd: null,
        volume24hUsd: null,
        marketDataAsOfMs: null,
      };
}

/**
 * One abortable, process-memory-only read for a public mint. The existing
 * prices flag and confirmed mainnet identity are both required before egress.
 */
export function usePriceHistory(args: {
  mint: string | null | undefined;
  range: PriceHistoryRange;
}): PriceHistoryState {
  const key = args.mint ? `${args.mint}:${args.range}` : null;
  const [state, setState] = useState<KeyedPriceHistoryState>({
    key: null,
    status: 'idle',
    series: null,
    source: null,
    coverageKind: null,
    poolAddress: null,
    liquidityUsd: null,
    volume24hUsd: null,
    marketDataAsOfMs: null,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (!args.mint) {
      setState({
        key: null,
        status: 'idle',
        series: null,
        source: null,
        coverageKind: null,
        poolAddress: null,
        liquidityUsd: null,
        volume24hUsd: null,
        marketDataAsOfMs: null,
      });
      return () => controller.abort();
    }

    const requestKey = `${args.mint}:${args.range}`;
    setState({
      key: requestKey,
      status: 'loading',
      series: null,
      source: null,
      coverageKind: null,
      poolAddress: null,
      liquidityUsd: null,
      volume24hUsd: null,
      marketDataAsOfMs: null,
    });
    void (async () => {
      const config = await resolvePricesConfig();
      if (
        cancelled ||
        !config.pricesEnabled ||
        config.network.state !== 'known' ||
        config.network.cluster !== 'mainnet-beta'
      ) {
        if (!cancelled) {
          setState({
            key: requestKey,
            status: 'unavailable',
            series: null,
            source: null,
            coverageKind: null,
            poolAddress: null,
            liquidityUsd: null,
            volume24hUsd: null,
            marketDataAsOfMs: null,
          });
        }
        return;
      }
      const result = await fetchPriceHistory({
        mint: args.mint!,
        range: args.range,
        pricesEnabled: true,
        signal: controller.signal,
      });
      if (cancelled) return;
      setState({ key: requestKey, ...priceHistoryStateFromResult(result) });
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [args.mint, args.range]);

  if (state.key !== key) {
    return {
      status: key == null ? 'idle' : 'loading',
      series: null,
      source: null,
      coverageKind: null,
      poolAddress: null,
      liquidityUsd: null,
      volume24hUsd: null,
      marketDataAsOfMs: null,
    };
  }
  return {
    status: state.status,
    series: state.series,
    source: state.source,
    coverageKind: state.coverageKind,
    poolAddress: state.poolAddress,
    liquidityUsd: state.liquidityUsd,
    volume24hUsd: state.volume24hUsd,
    marketDataAsOfMs: state.marketDataAsOfMs,
  };
}
