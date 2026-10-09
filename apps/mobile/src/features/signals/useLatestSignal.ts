import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '@/constants/copy';
import {
  resolveTokenVitalsConfig,
  type TokenVitalsConfig,
} from '@/src/lib/apiConfig';
import { resolveFullChartRouteGuard } from './fullChartRouteGuard';
import {
  isSignalSliceFresh,
  signalSliceUnknownReason,
} from './signalSliceRead';
import {
  fetchSignals,
  type FetchSignalsResult,
  type SignalDirection,
  type SignalEvent,
  type SignalsPayload,
} from './fetchSignals';
import type { SignalKind, SignalTimeframe } from './types';

export type LatestSignalFetchGate =
  | { fetch: true }
  | { fetch: false; status: 'disabled' };

export function resolveLatestSignalFetchGate(
  config: TokenVitalsConfig | null | undefined,
): LatestSignalFetchGate {
  if (!resolveFullChartRouteGuard(config)) {
    return { fetch: false, status: 'disabled' };
  }
  return { fetch: true };
}

const DIRECTION_WORD: Readonly<Record<SignalDirection, string>> = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  neutral: 'Neutral',
};

const KIND_WORD: Readonly<Record<SignalKind, string>> =
  copy.askSheet.contributor;

const KIND_DETAIL: Readonly<Record<SignalKind, string>> =
  copy.askSheet.contributor;

export type LatestSignalCompositionRow = {
  kind: SignalKind;
  label: string;
  weight: number;
  contribution: number;
  contributionText: string;
};

export type LatestSignalPresentation = {
  /** `unknown` is a read we will not score. It is never a forecast. */
  kind: 'read' | 'unknown';
  headline: string;
  latestLine: string | null;
  composition: LatestSignalCompositionRow[];
  accessibilityLabel: string;
  reason: string | null;
  asOfMs: number | null;
  timeframe: SignalTimeframe | null;
};

function formatContribution(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded > 0) return `+${rounded}`;
  return `${rounded}`;
}

function latestEvent(signals: readonly SignalEvent[]): SignalEvent | null {
  let latest: SignalEvent | null = null;
  for (const event of signals) {
    if (latest == null || event.barCloseMs > latest.barCloseMs) latest = event;
  }
  return latest;
}

function latestLineFor(event: SignalEvent): string {
  return `Latest · ${DIRECTION_WORD[event.direction]} ${KIND_WORD[event.kind]} · ${event.timeframe}`;
}

export function unknownSignalPresentation(
  reason: string,
  clock?: { asOfMs: number | null; timeframe: SignalTimeframe | null },
): LatestSignalPresentation {
  return {
    kind: 'unknown',
    headline: copy.tokenFacts.unknown,
    latestLine: null,
    composition: [],
    accessibilityLabel: `${copy.tokenFacts.unknown}. ${reason}`,
    reason,
    asOfMs: clock?.asOfMs ?? null,
    timeframe: clock?.timeframe ?? null,
  };
}

export function resolveLatestSignalPresentation(
  payload: SignalsPayload | null | undefined,
  nowMs?: number,
): LatestSignalPresentation | null {
  if (!payload) return null;
  const { score, band, contributors } = payload.confluence;
  const bandWord = copy.fullChart.band[band];
  const clock = { asOfMs: payload.asOfMs, timeframe: payload.timeframe };
  const readable =
    bandWord != null && Number.isInteger(score) && score >= 0 && score <= 100;
  const fresh =
    nowMs === undefined
      ? true
      : readable &&
        isSignalSliceFresh({
          asOfMs: payload.asOfMs,
          timeframe: payload.timeframe,
          nowMs,
        });
  if (!readable || !fresh) {
    return unknownSignalPresentation(
      signalSliceUnknownReason({
        asOfMs: payload.asOfMs,
        timeframe: payload.timeframe,
        nowMs: nowMs ?? Number.NaN,
      }),
      clock,
    );
  }
  const headline = copy.askSheet.confluenceValue(bandWord, score);
  const latest = latestEvent(payload.signals);
  const composition = contributors.map((row) => ({
    kind: row.kind,
    label: KIND_DETAIL[row.kind],
    weight: row.weight,
    contribution: row.contribution,
    contributionText: formatContribution(row.contribution),
  }));
  return {
    kind: 'read',
    headline,
    latestLine: latest ? latestLineFor(latest) : null,
    composition,
    accessibilityLabel: copy.chartEdge.confluenceA11y(bandWord, score),
    reason: null,
    asOfMs: payload.asOfMs,
    timeframe: payload.timeframe,
  };
}

export type LatestSignalStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'disabled'
  | 'unavailable';

export type LatestSignalHookState = {
  status: LatestSignalStatus;
  presentation: LatestSignalPresentation | null;
  errorCode: Exclude<FetchSignalsResult, { ok: true }>['code'] | null;
  lastFetchedAtMs: number | null;
  refresh: () => void;
};

export type UseLatestSignalDeps = {
  fetchImpl?: typeof fetchSignals;
  resolveConfig?: typeof resolveTokenVitalsConfig;
  nowMs?: () => number;
};

export function useLatestSignal(
  args: { mint: string | null; timeframe: SignalTimeframe },
  deps: UseLatestSignalDeps = {},
): LatestSignalHookState {
  const fetchImpl = deps.fetchImpl ?? fetchSignals;
  const resolveConfig = deps.resolveConfig ?? resolveTokenVitalsConfig;
  const nowMs = deps.nowMs ?? Date.now;

  const requestKey = args.mint ? `${args.mint}:${args.timeframe}` : null;
  const appliedKeyRef = useRef<string | null>(null);

  const [status, setStatus] = useState<LatestSignalStatus>('idle');
  const [presentation, setPresentation] =
    useState<LatestSignalPresentation | null>(null);
  const [errorCode, setErrorCode] =
    useState<LatestSignalHookState['errorCode']>(null);
  const [lastFetchedAtMs, setLastFetchedAtMs] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick is the refresh trigger and is listed on purpose so refresh() re-runs the fetch.
  useEffect(() => {
    if (!args.mint) {
      appliedKeyRef.current = null;
      setStatus('idle');
      setPresentation(null);
      setErrorCode(null);
      setLastFetchedAtMs(null);
      return undefined;
    }
    const mint = args.mint;
    const timeframe = args.timeframe;
    const nextKey = `${mint}:${timeframe}`;
    const keyChanged = appliedKeyRef.current !== nextKey;
    appliedKeyRef.current = nextKey;
    const controller = new AbortController();
    let cancelled = false;
    if (keyChanged) {
      setPresentation(null);
      setErrorCode(null);
      setLastFetchedAtMs(null);
      setStatus('loading');
    } else {
      setStatus((previous) => (previous === 'ready' ? previous : 'loading'));
    }

    void (async () => {
      const config = await resolveConfig();
      if (cancelled || appliedKeyRef.current !== nextKey) return;
      const gate = resolveLatestSignalFetchGate(config);
      if (!gate.fetch) {
        setStatus(gate.status);
        setPresentation(null);
        setErrorCode('disabled');
        return;
      }
      const result = await fetchImpl({
        mint,
        timeframe,
        signalsEnabled: true,
        signal: controller.signal,
      });
      if (cancelled || appliedKeyRef.current !== nextKey) return;
      if (result.ok) {
        const next = resolveLatestSignalPresentation(result.payload, nowMs());
        setPresentation(next);
        setErrorCode(null);
        setStatus(next?.kind === 'read' ? 'ready' : 'unavailable');
        setLastFetchedAtMs(nowMs());
        return;
      }
      if (result.code === 'aborted') return;
      setErrorCode(result.code);
      setPresentation(
        result.code === 'disabled'
          ? null
          : unknownSignalPresentation(copy.chartEdge.unavailable),
      );
      setStatus(result.code === 'disabled' ? 'disabled' : 'unavailable');
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [args.mint, args.timeframe, tick, fetchImpl, resolveConfig, nowMs]);

  const stale = appliedKeyRef.current !== requestKey;
  return {
    status: stale ? (requestKey == null ? 'idle' : 'loading') : status,
    presentation: stale ? null : presentation,
    errorCode: stale ? null : errorCode,
    lastFetchedAtMs: stale ? null : lastFetchedAtMs,
    refresh,
  };
}
