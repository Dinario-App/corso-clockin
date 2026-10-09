import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { resolvePricesConfig } from '@/src/lib/apiConfig';
import {
  createSseParser,
  parsePriceStreamEvent,
  resolvePriceStreamPlan,
  resolvePriceStreamReconnectDelayMs,
  type PriceStreamTick,
  type PriceStreamTransport,
} from './priceStream';

export type PriceStreamState = {
  status: 'idle' | 'connecting' | 'live' | 'reconnecting' | 'unavailable';
  transport: PriceStreamTransport;
  tick: PriceStreamTick | null;
};

export type PriceStreamOpener = (
  url: string,
  signal: AbortSignal,
) => Promise<{ status: number; body: ReadableStream<Uint8Array> | null }>;

export const IDLE_PRICE_STREAM: PriceStreamState = { status: 'idle', transport: 'none', tick: null };

/** Max seconds of silence (no tick, no heartbeat) before the stream is judged dead. */
export const PRICE_STREAM_STALL_MS = 45_000;

export function usePriceStream(args: {
  mint: string | null | undefined;
  enabled: boolean;
  open?: PriceStreamOpener;
  apiBaseUrl?: string | null;
}): PriceStreamState {
  const [state, setState] = useState<PriceStreamState>(IDLE_PRICE_STREAM);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');
  const openRef = useRef(args.open);
  openRef.current = args.open;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setAppActive(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const stop = () => {
      cancelled = true;
      controller?.abort();
      if (retryTimer) clearTimeout(retryTimer);
      if (stallTimer) clearTimeout(stallTimer);
    };

    if (!args.enabled || !args.mint || !appActive) {
      setState(IDLE_PRICE_STREAM);
      return stop;
    }
    const mint = args.mint;

    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => controller?.abort(), PRICE_STREAM_STALL_MS);
    };

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      setState((previous) => ({ ...previous, status: 'reconnecting' }));
      retryTimer = setTimeout(() => void connect(), delayMs);
    };

    const connect = async () => {
      if (cancelled) return;
      const config = await resolvePricesConfig();
      if (cancelled) return;
      const base =
        args.apiBaseUrl !== undefined ? args.apiBaseUrl : (process.env.EXPO_PUBLIC_API_URL ?? null);
      const plan = resolvePriceStreamPlan({
        mint,
        enabled: args.enabled,
        pricesEnabled:
          config.pricesEnabled &&
          config.network.state === 'known' &&
          config.network.cluster === 'mainnet-beta',
        appActive,
        apiBaseUrl: base,
      });
      if (!plan.connect) {
        setState({ status: 'unavailable', transport: 'none', tick: null });
        return;
      }
      const opener = openRef.current;
      if (!opener) {
        setState({ status: 'unavailable', transport: 'none', tick: null });
        return;
      }
      controller = new AbortController();
      setState((previous) => ({ ...previous, status: attempt === 0 ? 'connecting' : 'reconnecting' }));
      let cleanEnd = false;
      try {
        const response = await opener(plan.url, controller.signal);
        if (cancelled) return;
        if (response.status !== 200 || !response.body) {
          // 503 = disarmed or busy; do not hammer. 429 likewise.
          attempt += 1;
          setState({ status: 'unavailable', transport: 'none', tick: null });
          if (response.status === 503 || response.status === 429 || response.status === 403) {
            schedule(Math.max(5_000, resolvePriceStreamReconnectDelayMs(attempt)));
          } else {
            schedule(resolvePriceStreamReconnectDelayMs(attempt));
          }
          return;
        }
        attempt = 0;
        armStall();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parser = createSseParser();
        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          armStall();
          const chunk = decoder.decode(value, { stream: true });
          for (const event of parser.feed(chunk)) {
            const frame = parsePriceStreamEvent(event, mint);
            if (!frame) continue;
            if (frame.kind === 'end') {
              cleanEnd = true;
              break;
            }
            if (frame.kind === 'status') {
              setState((previous) => ({ ...previous, status: 'live', transport: frame.transport }));
            } else {
              setState({ status: 'live', transport: frame.tick.transport, tick: frame.tick });
            }
          }
          if (cleanEnd) break;
        }
        await reader.cancel().catch(() => {});
      } catch {
        // Aborted (unmount/background/stall) or network failure — fall through.
      }
      if (cancelled) return;
      if (stallTimer) clearTimeout(stallTimer);
      if (cleanEnd) {
        schedule(0);
      } else {
        attempt += 1;
        schedule(resolvePriceStreamReconnectDelayMs(attempt));
      }
    };

    void connect();
    return stop;
  }, [args.mint, args.enabled, args.apiBaseUrl, appActive]);

  return state;
}
