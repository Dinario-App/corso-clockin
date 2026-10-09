import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { resolvePricesConfig } from '@/src/lib/apiConfig';
import { fetchPriceLine, PRICE_LINE_INTERVAL_MS, type PriceLineInterval } from './fetchPriceLine';
import type { PriceHistoryState } from './usePriceHistory';

const UNAVAILABLE: PriceHistoryState = {
  status: 'unavailable',
  series: null,
  source: null,
  coverageKind: null,
  poolAddress: null,
  liquidityUsd: null,
  volume24hUsd: null,
  marketDataAsOfMs: null,
};
const IDLE: PriceHistoryState = { ...UNAVAILABLE, status: 'idle' };
const LOADING: PriceHistoryState = { ...UNAVAILABLE, status: 'loading' };

/** Grace after a 15s bar closes before asking for it; the server's cache rolls per bar. */
export const PRICE_LINE_SETTLE_MS = 2_000;

/** Next refresh: just after the next bar closes, never sooner than one bar. */
export function resolvePriceLineRefreshDelayMs(input: { asOfMs: number; nowMs: number; intervalMs: number }): number {
  const nextClose = input.asOfMs + input.intervalMs;
  return Math.max(input.intervalMs, nextClose + PRICE_LINE_SETTLE_MS - input.nowMs);
}

export function usePriceLine(args: { mint: string | null | undefined; interval: PriceLineInterval }): PriceHistoryState {
  const [state, setState] = useState<PriceHistoryState & { key: string | null }>({ ...IDLE, key: null });
  const key = args.mint ? `${args.mint}:${args.interval}` : null;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const stop = () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
    if (!args.mint) {
      setState({ ...IDLE, key: null });
      return stop;
    }
    const mint = args.mint;
    const requestKey = `${mint}:${args.interval}`;
    setState({ ...LOADING, key: requestKey });

    const load = async () => {
      if (cancelled) return;
      if (AppState.currentState === 'background') {
        timer = setTimeout(() => void load(), PRICE_LINE_INTERVAL_MS[args.interval]);
        return;
      }
      const config = await resolvePricesConfig();
      if (cancelled) return;
      if (!config.pricesEnabled || config.network.state !== 'known' || config.network.cluster !== 'mainnet-beta') {
        setState({ ...UNAVAILABLE, key: requestKey });
        return;
      }
      const result = await fetchPriceLine({
        mint,
        interval: args.interval,
        pricesEnabled: true,
        signal: controller.signal,
      });
      if (cancelled) return;
      if (result.ok) {
        setState({
          key: requestKey,
          status: 'ready',
          series: result.series,
          source: result.source,
          coverageKind: 'token_aggregated',
          poolAddress: null,
          liquidityUsd: null,
          volume24hUsd: null,
          marketDataAsOfMs: result.asOfMs,
        });
        timer = setTimeout(
          () => void load(),
          resolvePriceLineRefreshDelayMs({ asOfMs: result.asOfMs, nowMs: Date.now(), intervalMs: result.intervalMs }),
        );
        return;
      }
      setState((previous) =>
        previous.key === requestKey && previous.status === 'ready'
          ? previous // keep the last good line through a transient failure
          : { ...UNAVAILABLE, key: requestKey },
      );
      if (result.code !== 'disabled' && result.code !== 'invalid_request' && result.code !== 'missing_api_url') {
        timer = setTimeout(() => void load(), PRICE_LINE_INTERVAL_MS[args.interval] * 2);
      }
    };
    void load();
    return stop;
  }, [args.mint, args.interval]);

  if (state.key !== key) return key == null ? IDLE : LOADING;
  const { key: _key, ...rest } = state;
  return rest;
}
