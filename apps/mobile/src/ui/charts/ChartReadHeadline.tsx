import { useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { radii, typography } from '@/constants/theme';
import {
  chartReadKey,
  getChartReadCacheSnapshot,
  subscribeChartReadCache,
  usePublishChartRead,
  type ChartReadSnapshot,
} from '@/src/features/signals/chartReadCache';
import type { ChartReadFace } from '@/src/features/signals/chartEdgePresentation';
import { resolveDisplayedSignalNowMs } from '@/src/features/signals/signalSliceRead';
import { useChartBundle } from '@/src/features/signals/useChartBundle';
import {
  useDisplayClock,
  useSignalRefreshOnBundle,
} from '@/src/features/signals/useDisplayClock';
import { useLatestSignal } from '@/src/features/signals/useLatestSignal';
import { useLaneGate } from '@/src/features/navigation/laneGates';
import { GLASS_MUTE, GLASS_ONGLASS } from '@/src/ui/glass/glassTokens';
import { CorsoText } from '@/src/theme/CorsoText';
import { StructureRow, type StructureRowFace } from './StructureRow';
import {
  STRUCTURE_ROW_TIMEFRAME,
  resolveStructureRowPresentation,
} from './structureRowPresentation';

type RowProps = {
  mint: string | null;
  face?: StructureRowFace;
  testID?: string;
};

function useInHandChartRead(mint: string | null): ChartReadSnapshot | null {
  const cache = useSyncExternalStore(
    subscribeChartReadCache,
    getChartReadCacheSnapshot,
    getChartReadCacheSnapshot,
  );
  if (mint == null) return null;
  return cache.get(chartReadKey(mint, STRUCTURE_ROW_TIMEFRAME)) ?? null;
}

function InHandChartRead({ mint, testID }: RowProps) {
  const armed = useLaneGate('fullChart');
  const displayNowMs = useDisplayClock({ enabled: armed });
  const entry = useInHandChartRead(mint);
  const presentation = useMemo(() => {
    if (!armed || entry == null) return null;
    return resolveStructureRowPresentation({
      enabled: true,
      signal: entry.signal,
      chart: entry.chart,
      nowMs: resolveDisplayedSignalNowMs({
        wallNowMs: displayNowMs,
        lastFetchedAtMs: entry.chart.lastFetchedAtMs,
      }),
    });
  }, [armed, entry, displayNowMs]);
  return (
    <StructureRow enabled={armed} presentation={presentation} testID={testID} />
  );
}

function LiveChartRead({ mint, face, testID }: RowProps) {
  const armed = useLaneGate('fullChart');
  const displayNowMs = useDisplayClock({ enabled: armed });
  const live = armed && mint != null;
  const signal = useLatestSignal({
    mint: live ? mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
  });
  const bundle = useChartBundle({
    mint: live ? mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
    focused: live,
  });
  useSignalRefreshOnBundle(
    live ? bundle.lastFetchedAtMs : null,
    signal.refresh,
  );
  usePublishChartRead({
    mint: live ? mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
    signal: signal.presentation,
    status: bundle.status,
    bundle: bundle.bundle,
    errorCode: bundle.errorCode,
    lastFetchedAtMs: bundle.lastFetchedAtMs,
  });
  const presentation = useMemo(
    () =>
      resolveStructureRowPresentation({
        enabled: armed,
        signal: signal.presentation,
        chart: bundle,
        nowMs: resolveDisplayedSignalNowMs({
          wallNowMs: displayNowMs,
          lastFetchedAtMs: bundle.lastFetchedAtMs,
        }),
      }),
    [armed, signal.presentation, bundle, displayNowMs],
  );
  return (
    <StructureRow
      enabled={armed}
      presentation={presentation}
      face={face}
      testID={testID}
    />
  );
}

function GaugeChartRead({ face }: { face: ChartReadFace }) {
  const tone = face.kind === 'score' ? face.tone : GLASS_MUTE;
  const spoken =
    face.kind === 'score'
      ? `${copy.askSheet.confluenceValue(copy.fullChart.band[face.band], face.score)}. ${copy.fullChart.informationNotAdvice}`
      : `${copy.chartEdge.confluence}. ${face.label}`;
  return (
    <View style={gauge.confluence} accessibilityLabel={spoken}>
      <CorsoText style={gauge.label}>{copy.chartEdge.confluence}</CorsoText>
      {face.kind === 'score' ? (
        <>
          <CorsoText style={[gauge.band, { color: tone }]}>
            {copy.fullChart.band[face.band]}
          </CorsoText>
          <CorsoText style={[gauge.score, { color: tone }]}>
            {face.score}
          </CorsoText>
        </>
      ) : (
        <CorsoText style={[gauge.band, { color: tone }]}>
          {face.label}
        </CorsoText>
      )}
    </View>
  );
}

export function ChartReadHeadline(
  props:
    | ({ mode: 'live' } & RowProps)
    | ({ mode: 'in-hand' } & RowProps)
    | { mode: 'gauge'; face: ChartReadFace; testID?: string },
) {
  if (props.mode === 'gauge') return <GaugeChartRead face={props.face} />;
  if (props.mode === 'in-hand') {
    return <InHandChartRead mint={props.mint} testID={props.testID} />;
  }
  return (
    <LiveChartRead mint={props.mint} face={props.face} testID={props.testID} />
  );
}

const gauge = StyleSheet.create({
  confluence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: GLASS_ONGLASS,
  },
  label: { fontSize: 12.5, fontWeight: '500', color: GLASS_MUTE },
  band: { fontSize: 12.5, fontWeight: '600' },
  score: {
    fontSize: 12.5,
    fontWeight: '600',
    fontVariant: [...typography.fontVariantTabular],
  },
});
