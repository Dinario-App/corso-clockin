import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { CorsoText } from '@/src/theme/CorsoText';
import { formatClosedBarStamp } from '@/src/features/home/asOfPresentation';
import { useLaneGate } from '@/src/features/navigation/laneGates';
import { resolveChartCoverage } from '@/src/features/signals/chartCoverage';
import { resolveChartReadFace } from '@/src/features/signals/chartEdgePresentation';
import { resolveDisplayedSignalNowMs } from '@/src/features/signals/signalSliceRead';
import { useDisplayClock } from '@/src/features/signals/useDisplayClock';
import { parseFullChartParams } from '@/src/features/signals/chartEscalation';
import {
  SIGNAL_TIMEFRAMES,
  type SignalTimeframe,
} from '@/src/features/signals/types';
import { useChartBundle } from '@/src/features/signals/useChartBundle';
import { trackEvent } from '@/src/lib/analytics';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { ChartReadHeadline } from '@/src/ui/charts/ChartReadHeadline';
import { PriceChart } from '@/src/ui/charts/PriceChart';
import { VelaChartWebView } from '@/src/ui/charts/vela/VelaChartWebView';
import type { VelaChartMessage } from '@/src/ui/charts/vela/velaBridge';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import {
  GLASS_INK_72,
  GLASS_MUTE,
  GLASS_ONGLASS,
  GLASS_ONGLASS_HI,
} from '@/src/ui/glass/glassTokens';
import { Material } from '@/src/ui/glass/Material';
import { ONGLASS } from '@/src/ui/glass/materialTokens';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import {
  MIN_TAP_TARGET_PT,
  resolveTapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation';

const BACK_HIT_SIZE = 32;
const BACK_HIT_SLOP = resolveTapTargetInsets({
  visualWidth: BACK_HIT_SIZE,
  visualHeight: BACK_HIT_SIZE,
});

const SWITCH_DIP_OPACITY = 0.55;
const SWITCH_DIP_MS = 90;
const SWITCH_RETURN_MS = 160;
/** The mode change: candles cross-fade over the held line once painted. */
const OPEN_TERMINAL_FADE_MS = 260;

export default function FullChartScreen() {
  const raw = useLocalSearchParams<{ mint?: string; timeframe?: string }>();
  const params = parseFullChartParams(raw);
  const [timeframe, setTimeframe] = useState<SignalTimeframe>(
    params?.timeframe ?? '1H',
  );
  const [selectedPrice, setSelectedPrice] = useState<string | null>(null);
  const chart = useChartBundle({
    mint: params?.mint ?? null,
    timeframe,
    focused: true,
  });
  const chartArmed = useLaneGate('fullChart');
  const displayNowMs = useDisplayClock({ enabled: chartArmed });
  const { reduceMotion } = useAccessibilityPreference();

  // Painted-timeframe transition. Keyed on the bundle's own timeframe (not the
  // pill), so the dip lands when the new bars arrive, never on a stale tape.
  const surfaceOpacity = useRef(new Animated.Value(1)).current;
  const paintedTimeframe = chart.bundle?.timeframe ?? null;
  const previousPaintedRef = useRef<SignalTimeframe | null>(null);
  useEffect(() => {
    const previous = previousPaintedRef.current;
    previousPaintedRef.current = paintedTimeframe;
    if (
      paintedTimeframe == null ||
      previous == null ||
      previous === paintedTimeframe
    )
      return;
    if (reduceMotion) {
      surfaceOpacity.setValue(1);
      return;
    }
    surfaceOpacity.setValue(1);
    Animated.sequence([
      Animated.timing(surfaceOpacity, {
        toValue: SWITCH_DIP_OPACITY,
        duration: SWITCH_DIP_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(surfaceOpacity, {
        toValue: 1,
        duration: SWITCH_RETURN_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [paintedTimeframe, reduceMotion, surfaceOpacity]);

  // The mode change. The native line is held under the terminal until the
  // page reports `painted`; then the candles fade in and the line lets go.
  // `terminalPainted` is set once per mount — a timeframe switch re-seeds
  // inside the same open terminal and rides the dip above instead.
  const [terminalPainted, setTerminalPainted] = useState(false);
  const terminalOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!terminalPainted) return;
    if (reduceMotion) {
      terminalOpacity.setValue(1);
      return;
    }
    Animated.timing(terminalOpacity, {
      toValue: 1,
      duration: OPEN_TERMINAL_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [terminalPainted, reduceMotion, terminalOpacity]);

  const onChartMessage = useCallback(
    (message: VelaChartMessage) => {
      if (message.t === 'perf') {
        trackEvent('vela_webview_perf', {
          fps: message.fps,
          backend: message.backend ?? 'unknown',
          timeframe,
        });
      } else if (message.t === 'error') {
        trackEvent('vela_webview_error', { detail: message.detail, timeframe });
      } else if (message.t === 'painted') {
        setTerminalPainted(true);
        trackEvent('vela_webview_painted', {
          bars: message.bars,
          overlays: message.overlays,
          backend: message.backend ?? 'unknown',
          timeframe,
        });
      }
    },
    [timeframe],
  );

  const onSelect = useCallback((_barMs: number, price: string) => {
    setSelectedPrice(formatPriceUsd(price));
  }, []);

  const bundle = chart.bundle;
  const label = params ? truncateAddress(params.mint) : '';
  const timeframeName = copy.fullChart.timeframeName(timeframe);
  // Honest coverage: real bar count, real holes, real quiet — never padded.
  // Lines name the bar width actually shipped (`barMs`), not the pill.
  const coverage = useMemo(
    () =>
      bundle
        ? resolveChartCoverage({
            timeframe: bundle.timeframe,
            candles: bundle.candles,
            asOfMs: bundle.asOfMs,
            nowMs: chart.lastFetchedAtMs ?? Date.now(),
          })
        : null,
    [bundle, chart.lastFetchedAtMs],
  );
  const face = bundle
    ? resolveChartReadFace({
        bundle,
        nowMs: resolveDisplayedSignalNowMs({
          wallNowMs: displayNowMs,
          lastFetchedAtMs: chart.lastFetchedAtMs,
        }),
      })
    : null;
  const noData =
    chart.status === 'unavailable' && chart.errorCode === 'no_data';
  const holdingLine = chart.status === 'ready' && !terminalPainted;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            /*
              The escalation door swings both ways. This chart was opened FROM
              `/asset/<mint>` (`buildFullChartHref`), so with nothing beneath
              it that asset is the honest parent — but only once
              `parseFullChartParams` has vouched for the mint. An unparsed
              chart already renders its invalid state; it must not hand the
              router a mint nobody validated.
            */
            goBackOr(params ? `/asset/${params.mint}` : BACK_FALLBACK.shell)
          }
          accessibilityRole="button"
          accessibilityLabel={copy.v1.back}
          hitSlop={BACK_HIT_SLOP}
          style={styles.backHit}
        >
          <Material
            weight="card"
            nested
            hug
            radius={radii.pill}
            washColor={ONGLASS}
            contentStyle={styles.backCircle}
          >
            <CorsoText style={styles.backGlyph}>‹</CorsoText>
          </Material>
        </Pressable>
        <CorsoText
          style={styles.headerTitle}
          accessibilityRole="header"
          numberOfLines={1}
        >
          {copy.fullChart.title}
        </CorsoText>
        <View style={styles.headerSpacer} />
      </View>

      {params == null ? (
        <SettingsCard style={styles.card} contentStyle={styles.cardContent}>
          <View
            accessibilityRole="alert"
            accessibilityLabel={`${copy.fullChart.invalidTitle}. ${copy.fullChart.invalidBody}`}
          >
            <CorsoText style={styles.title}>
              {copy.fullChart.invalidTitle}
            </CorsoText>
            <CorsoText style={styles.muted}>
              {copy.fullChart.invalidBody}
            </CorsoText>
          </View>
        </SettingsCard>
      ) : (
        <>
          <View style={styles.pills} accessibilityRole="tablist">
            {SIGNAL_TIMEFRAMES.map((candidate) => {
              const selected = candidate === timeframe;
              return (
                <Pressable
                  key={candidate}
                  onPress={() => {
                    setSelectedPrice(null);
                    setTimeframe(candidate);
                  }}
                  accessibilityRole="tab"
                  accessibilityLabel={copy.fullChart.timeframeA11y(
                    copy.fullChart.timeframeName(candidate),
                  )}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.pillHit,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View
                    style={[styles.pill, selected ? styles.pillSelected : null]}
                  >
                    <CorsoText
                      style={
                        selected ? styles.pillTextSelected : styles.pillText
                      }
                    >
                      {candidate}
                    </CorsoText>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Animated.View
            style={[styles.surface, { opacity: surfaceOpacity }]}
            accessibilityLabel={copy.fullChart.chartA11y(label, timeframeName)}
          >
            {holdingLine ? (
              // The held native line: the reader's last picture of the price
              // stays put while the terminal paints behind it.
              <View
                style={styles.heldLine}
                pointerEvents="none"
                testID="full-chart-held-line"
              >
                <PriceChart mint={params.mint} currentPriceUsd={null} />
                <CorsoText style={styles.opening}>
                  {copy.chartEdge.openingTerminal}
                </CorsoText>
              </View>
            ) : null}
            <Animated.View
              style={[
                styles.terminal,
                {
                  opacity:
                    chart.status === 'ready'
                      ? terminalPainted
                        ? terminalOpacity
                        : 0
                      : 1,
                },
              ]}
            >
              {chart.status === 'ready' && bundle ? (
                <VelaChartWebView
                  candles={bundle.candles}
                  overlays={bundle.overlays}
                  timeframe={bundle.timeframe}
                  onChartMessage={onChartMessage}
                  onSelect={onSelect}
                  testID="full-chart-webview"
                />
              ) : (
                <View style={styles.state}>
                  <CorsoText style={styles.muted}>
                    {chart.status === 'disabled'
                      ? copy.fullChart.disabled
                      : chart.status === 'not_computed'
                        ? copy.fullChart.notComputed(timeframe)
                        : noData
                          ? copy.fullChart.noData(timeframeName)
                          : chart.status === 'unavailable'
                            ? copy.fullChart.unavailable
                            : copy.fullChart.loading}
                  </CorsoText>
                  {chart.status === 'unavailable' && !noData ? (
                    <Pressable
                      onPress={chart.refresh}
                      accessibilityRole="button"
                      accessibilityLabel={copy.fullChart.retry}
                      style={styles.retryButton}
                    >
                      <CorsoText style={styles.retryText}>
                        {copy.fullChart.retry}
                      </CorsoText>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </Animated.View>
          </Animated.View>

          {bundle && face ? (
            <View style={styles.readout}>
              <View style={styles.readoutRow}>
                <ChartReadHeadline mode="gauge" face={face} />
                <CorsoText style={styles.readoutLine}>
                  {face.kind === 'score'
                    ? copy.askSheet.confluenceValue(
                        copy.fullChart.band[face.band],
                        face.score,
                      )
                    : face.label}
                  {selectedPrice
                    ? ` · ${copy.fullChart.selected(selectedPrice)}`
                    : ''}
                </CorsoText>
              </View>
              {coverage && !coverage.complete ? (
                <CorsoText
                  style={styles.readoutMuted}
                  accessibilityLiveRegion="polite"
                >
                  {[
                    coverage.thin
                      ? copy.fullChart.coverage.thin(
                          coverage.bars,
                          copy.fullChart.barName(coverage.barMs),
                        )
                      : null,
                    coverage.gappy
                      ? copy.fullChart.coverage.gaps(coverage.missingBars)
                      : null,
                    coverage.quiet
                      ? copy.fullChart.coverage.quiet(
                          coverage.quietIntervals,
                          copy.fullChart.barName(coverage.barMs),
                        )
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </CorsoText>
              ) : null}
              {bundle.degraded.length > 0 ? (
                <CorsoText style={styles.readoutMuted}>
                  {copy.fullChart.degraded(bundle.degraded.length)}
                </CorsoText>
              ) : null}
              <CorsoText style={styles.readoutMuted}>
                {copy.fullChart.source}{' '}
                {copy.fullChart.asOf(
                  formatClosedBarStamp(bundle.asOfMs, displayNowMs) ?? '',
                )}.
              </CorsoText>
              <CorsoText style={styles.readoutMuted}>
                {copy.fullChart.informationNotAdvice}{' '}
                {copy.fullChart.attribution}.
              </CorsoText>
            </View>
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.sm,
  },
  backHit: { width: BACK_HIT_SIZE, height: BACK_HIT_SIZE },
  backCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    color: GLASS_MUTE,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
    color: colors.ink,
  },
  headerSpacer: { width: 32 },
  /** Outer box only — the material, radius and clipping are the pane's. */
  card: {
    marginHorizontal: spacing.gutter,
    marginTop: spacing.xl,
  },
  cardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  title: { fontSize: typography.title, fontWeight: '600', color: colors.ink },
  muted: { color: colors.muted, fontSize: typography.body },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.sm,
  },
  pillHit: { minHeight: MIN_TAP_TARGET_PT, justifyContent: 'center' },
  pressed: { opacity: 0.82 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: radii.pill,
    backgroundColor: GLASS_ONGLASS,
  },
  pillSelected: { backgroundColor: GLASS_ONGLASS_HI },
  pillText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: GLASS_INK_72,
    fontVariant: [...typography.fontVariantTabular],
  },
  pillTextSelected: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: [...typography.fontVariantTabular],
  },
  surface: { flex: 1, backgroundColor: colors.canvas },
  terminal: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heldLine: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: spacing.gutter,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  opening: {
    textAlign: 'center',
    color: GLASS_MUTE,
    fontSize: typography.caption,
  },
  state: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  retryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink,
    borderRadius: radii.cta,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '600',
  },
  readout: {
    paddingHorizontal: spacing.gutter,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  readoutLine: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '500',
  },
  readoutMuted: { color: colors.inkTertiary, fontSize: typography.caption },
});
