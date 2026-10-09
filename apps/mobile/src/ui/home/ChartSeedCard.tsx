import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Reanimated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { copy } from '@/constants/copy';
import type { HomeAssemblyChart } from '@/src/features/home/homeAssembly';
import { resolveMovingTapEffect } from '@/src/features/moving/movingTap';
import { useLaneGate } from '@/src/features/navigation/laneGates';
import { readGrokbotRoutesFlag } from '@/src/features/navigation/grokbotRoutes';
import { useChartRangePreference } from '@/src/features/prices/chartRangePreference';
import { usePriceChartSeries } from '@/src/features/prices/usePriceChartSeries';
import type { PriceHistoryState } from '@/src/features/prices/usePriceHistory';
import { usePublishChartRead } from '@/src/features/signals/chartReadCache';
import { buildFullChartHref } from '@/src/features/signals/chartEscalation';
import { resolveDisplayedSignalNowMs } from '@/src/features/signals/signalSliceRead';
import { useChartBundle } from '@/src/features/signals/useChartBundle';
import {
  useDisplayClock,
  useSignalRefreshOnBundle,
} from '@/src/features/signals/useDisplayClock';
import { useLatestSignal } from '@/src/features/signals/useLatestSignal';
import { useVitals } from '@/src/features/tokenVitals/useVitals';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { CorsoText } from '@/src/theme/CorsoText';
import { MarketRow } from '@/src/ui/charts/MarketRow';
import { ChartReadHeadline } from '@/src/ui/charts/ChartReadHeadline';
import { PriceChart } from '@/src/ui/charts/PriceChart';
import { ChartKitRow, StructureRow } from '@/src/ui/charts/StructureRow';
import {
  PRICE_CHART_SEED_HEAD_HEIGHT,
  type PriceChartRange,
  type PriceChartReadyPresentation,
} from '@/src/ui/charts/priceChartPresentation';
import { resolveMarketRowPresentation } from '@/src/ui/charts/marketRowPresentation';
import {
  STRUCTURE_ROW_TIMEFRAME,
  resolveStructureRowPresentation,
} from '@/src/ui/charts/structureRowPresentation';
import { Material } from '@/src/ui/glass/Material';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon.js';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import { colors, kitType, kitWeight, radii, typography } from '@/src/ui/tokens';
import {
  CHART_SEED_CARD as C,
  CHART_SEED_COPY,
  CHART_SEED_RANGE,
  resolveChartSeedAccessibilityLabel,
  resolveChartSeedActiveRange,
  resolveChartSeedDetailsParams,
  resolveChartSeedEntry,
  resolveChartSeedExtrasContentHeight,
  resolveChartSeedExtrasHeight,
  resolveChartSeedFoldHitHeight,
  resolveChartSeedFoldHitSlop,
  resolveChartSeedFoot,
  resolveChartSeedFootHeight,
  resolveChartSeedMotion,
  resolveChartSeedPriceChartProps,
  resolveChartSeedRegionHeight,
  resolveChartSeedSize,
  resolveChartSeedTap,
  type ChartSeedSize,
} from './chartSeedCardPresentation';
import { GEN_UI_EASING } from './genUiMotion';

export type ChartSeedCardProps = {
  chart: HomeAssemblyChart;
  /** The resolved 1D history the seed was judged eligible on. */
  history: PriceHistoryState;
  /** That history as the chart draws it (`resolveChartSeedEligibility`). */
  presentation: PriceChartReadyPresentation;
  /** When the verdict card above mounted: the seed's clock runs off its CTA. */
  verdictMountedAtMs: number;
  newest?: boolean;
  /** `Details ›` in the head — Home pushes the mint-keyed Asset route. */
  onDetails?: () => void;
  onUnfoldChange?: (unfolded: boolean) => void;
  unfoldedSlot?: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
  testID?: string;
};

export function useChartSeedHistory(
  chart: HomeAssemblyChart | null,
): PriceHistoryState {
  return usePriceChartSeries({
    mint: chart?.mint ?? null,
    range: CHART_SEED_RANGE,
  });
}

const SEED_RANGES: readonly PriceChartRange[] = [CHART_SEED_RANGE];
const GEN_UI_CURVE = Easing.bezier(
  GEN_UI_EASING[0],
  GEN_UI_EASING[1],
  GEN_UI_EASING[2],
  GEN_UI_EASING[3],
);
const FOOT_GROWN = resolveChartSeedFootHeight('grown');
const DETAILS_SLOP_VERTICAL =
  (MIN_TAP_TARGET_PT - PRICE_CHART_SEED_HEAD_HEIGHT) / 2;

export function ChartSeedCard({
  chart,
  history,
  presentation,
  verdictMountedAtMs,
  newest = true,
  onDetails,
  onUnfoldChange,
  unfoldedSlot,
  onLayout,
  testID,
}: ChartSeedCardProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const motion = useMemo(
    () => resolveChartSeedMotion({ reduceMotion }),
    [reduceMotion],
  );
  const fullChart = useLaneGate('fullChart');
  const displayNowMs = useDisplayClock({ enabled: fullChart });

  /* Phase 4 — the entry: eligible (it is, or it would not be mounted) and at
     least 150 ms past the verdict's CTA arming. */
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const entry = resolveChartSeedEntry({
    eligible: true,
    verdictMountedAtMs,
    nowMs: Date.now(),
    reduceMotion,
  });
  useEffect(() => {
    if (entry.entered || entry.enterAtMs === null) return;
    const timer = setTimeout(
      rerender,
      Math.max(0, entry.enterAtMs - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [entry.entered, entry.enterAtMs]);

  /* Phase 4b — once the line has drawn, the newest chart grows. */
  const [grownMoment, setGrownMoment] = useState(false);
  useEffect(() => {
    if (!entry.entered || !motion.animated) return;
    const timer = setTimeout(
      () => setGrownMoment(true),
      motion.growAfterEntryMs,
    );
    return () => clearTimeout(timer);
  }, [entry.entered, motion]);

  /* Phase 6 — the tap; phase 9 — superseded, an unfolded chart folds back. */
  const [unfolded, setUnfolded] = useState(false);
  const [wasNewest, setWasNewest] = useState(newest);
  if (wasNewest !== newest) {
    setWasNewest(newest);
    if (!newest) setUnfolded(false);
  }
  const size: ChartSeedSize = resolveChartSeedSize({
    newest,
    grownMoment: grownMoment || !motion.animated,
    unfolded,
  });
  const live = unfolded && fullChart;
  const preference = useChartRangePreference();
  const signal = useLatestSignal({
    mint: live ? chart.mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
  });
  const bundleState = useChartBundle({
    mint: live ? chart.mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
    focused: live,
  });
  useSignalRefreshOnBundle(
    live ? bundleState.lastFetchedAtMs : null,
    signal.refresh,
  );
  usePublishChartRead({
    mint: live ? chart.mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
    signal: signal.presentation,
    status: bundleState.status,
    bundle: bundleState.bundle,
    errorCode: bundleState.errorCode,
    lastFetchedAtMs: bundleState.lastFetchedAtMs,
  });
  const vitals = useVitals({
    seed: null,
    mint: live ? chart.mint : null,
    focused: live,
    enabled: live,
  });
  const [range, setRange] = useState<PriceChartRange>(CHART_SEED_RANGE);
  const shownRange = resolveChartSeedActiveRange({
    unfolded,
    chosen: range,
    visible: preference.visible,
  });
  const [extrasHeld, setExtrasHeld] = useState(false);
  if (unfolded && !extrasHeld) setExtrasHeld(true);
  useEffect(() => {
    if (unfolded) return;
    if (!motion.animated) {
      setExtrasHeld(false);
      return;
    }
    const timer = setTimeout(() => setExtrasHeld(false), motion.foldBackMs);
    return () => clearTimeout(timer);
  }, [unfolded, motion]);
  const extrasOpen = unfolded || extrasHeld;
  const [extrasUnclipped, setExtrasUnclipped] = useState(false);
  const extrasEase = useRef(0);
  const onExtrasEased = (ease: number) => {
    if (ease === extrasEase.current) setExtrasUnclipped(true);
  };
  const [miniFaceHeight, setMiniFaceHeight] = useState<number | null>(null);
  const [extrasContentHeight, setExtrasContentHeight] = useState<number | null>(
    null,
  );
  const structure = useMemo(
    () =>
      resolveStructureRowPresentation({
        enabled: fullChart,
        signal: signal.presentation,
        chart: bundleState,
        nowMs: resolveDisplayedSignalNowMs({
          wallNowMs: displayNowMs,
          lastFetchedAtMs: bundleState.lastFetchedAtMs,
        }),
      }),
    [fullChart, signal.presentation, bundleState, displayNowMs],
  );
  const [structureHeld, setStructureHeld] = useState(false);
  const structureJustShown = structure != null && !structureHeld;
  if (structureJustShown) {
    setStructureHeld(true);
    setExtrasContentHeight(null);
    if (extrasUnclipped) setExtrasUnclipped(false);
  } else if (structure == null && structureHeld) {
    setStructureHeld(false);
  }
  if (size !== 'mini' && extrasUnclipped) {
    setExtrasUnclipped(false);
  }
  const extrasClosedHeight = resolveChartSeedExtrasHeight(size === 'mini', {
    measured: extrasContentHeight,
    structureShown: structure != null,
  });
  useEffect(() => {
    if (extrasOpen) return;
    setExtrasContentHeight(null);
  }, [extrasOpen]);

  /* The chart's face follows the size: straight to the grown face as the plot
     opens, back to the seed face only once the fold-back has closed it. */
  const [face, setFace] = useState<Exclude<ChartSeedSize, 'mini'>>(
    size === 'seed' ? 'seed' : 'grown',
  );
  useEffect(() => {
    if (size === 'mini' || size === 'grown' || !motion.animated) {
      setFace(size === 'seed' ? 'seed' : 'grown');
      return;
    }
    const timer = setTimeout(() => setFace('seed'), motion.foldBackMs);
    return () => clearTimeout(timer);
  }, [size, motion]);

  const chartProps = resolveChartSeedPriceChartProps({ unfolded, face });

  const rise = useSharedValue(motion.animated ? 0 : 1);
  const regionHeight = useSharedValue(
    resolveChartSeedRegionHeight(size, size === 'mini' ? miniFaceHeight : null),
  );
  const foot = useSharedValue(size === 'grown' ? 1 : 0);
  const extras = useSharedValue(size === 'mini' ? 1 : 0);
  const extrasHeight = useSharedValue(size === 'mini' ? extrasClosedHeight : 0);
  useEffect(() => {
    if (!entry.entered) return;
    cancelAnimation(rise);
    rise.value = motion.animated
      ? withTiming(1, { duration: motion.riseMs, easing: GEN_UI_CURVE })
      : 1;
  }, [entry.entered, motion, rise]);
  useEffect(() => {
    const targetRegion = resolveChartSeedRegionHeight(
      size,
      size === 'mini' ? miniFaceHeight : null,
    );
    const growing = size === 'grown' || size === 'mini';
    const targetFoot = size === 'grown' ? 1 : 0;
    const targetExtras = size === 'mini' ? 1 : 0;
    cancelAnimation(foot);
    cancelAnimation(extras);
    cancelAnimation(regionHeight);
    if (!motion.animated) {
      foot.value = targetFoot;
      extras.value = targetExtras;
      regionHeight.value = targetRegion;
      return;
    }
    const duration = growing ? motion.growMs : motion.foldBackMs;
    regionHeight.value = withTiming(targetRegion, {
      duration,
      easing: GEN_UI_CURVE,
    });
    foot.value = withTiming(targetFoot, {
      duration: targetFoot === 1 ? motion.footFadeMs : motion.foldBackMs,
      easing: GEN_UI_CURVE,
    });
    extras.value = withTiming(targetExtras, {
      duration: targetExtras === 1 ? motion.extrasFadeMs : motion.foldBackMs,
      easing: GEN_UI_CURVE,
    });
  }, [size, motion, foot, extras, miniFaceHeight, regionHeight]);
  useEffect(() => {
    const targetExtrasH = size === 'mini' ? extrasClosedHeight : 0;
    cancelAnimation(extrasHeight);
    if (!motion.animated) {
      extrasHeight.value = targetExtrasH;
      setExtrasUnclipped(size === 'mini');
      return;
    }
    if (size === 'mini' && extrasUnclipped && !structureJustShown) {
      extrasHeight.value = targetExtrasH;
      return;
    }
    const duration = size === 'mini' ? motion.growMs : motion.foldBackMs;
    const ease = ++extrasEase.current;
    extrasHeight.value = withTiming(targetExtrasH, {
      duration,
      easing: GEN_UI_CURVE,
    }, (finished) => {
      if (finished && targetExtrasH > 0) {
        runOnJS(onExtrasEased)(ease);
      }
    });
  }, [
    size,
    motion,
    extrasHeight,
    extrasClosedHeight,
    extrasUnclipped,
    structureJustShown,
  ]);

  const risePx = motion.risePx;
  const riseStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [{ translateY: (1 - rise.value) * risePx }],
  }));
  const regionStyle = useAnimatedStyle(() => ({
    height: regionHeight.value,
  }));
  const footStyle = useAnimatedStyle(() => ({
    height: interpolate(foot.value, [0, 1], [0, FOOT_GROWN]),
    opacity: foot.value,
  }));
  const extrasStyle = useAnimatedStyle(() => ({
    opacity: extras.value,
  }));
  const extrasBoxStyle = useAnimatedStyle(() => ({
    height: extrasHeight.value,
    overflow: 'hidden',
  }));

  if (!entry.entered) return null;

  const footLine = resolveChartSeedFoot(presentation);
  const label = resolveChartSeedAccessibilityLabel({
    symbol: chart.symbol,
    range: shownRange,
    presentation,
    unfolded,
  });
  const onPress = () => {
    const next = resolveChartSeedTap(unfolded);
    setUnfolded(next);
    onUnfoldChange?.(next);
  };
  const onChartFaceLayout = (event: LayoutChangeEvent) => {
    if (!unfolded) return;
    const next = event.nativeEvent.layout.height;
    if (!Number.isFinite(next) || next <= 0) return;
    setMiniFaceHeight((prev) => (prev === next ? prev : next));
  };
  const onExtrasLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    setExtrasContentHeight((prev) =>
      resolveChartSeedExtrasContentHeight(prev, next),
    );
  };
  const openDetails = () => {
    const effect = resolveMovingTapEffect({ mint: chart.mint });
    if (!effect) return;
    router.push({
      pathname: effect.href.pathname,
      params: resolveChartSeedDetailsParams({
        mint: effect.href.params.mint,
        range: shownRange,
      }),
    });
  };
  const terminalHref =
    fullChart && readGrokbotRoutesFlag()
      ? buildFullChartHref({ mint: chart.mint, timeframe: STRUCTURE_ROW_TIMEFRAME })
      : null;
  const openTerminal = () => {
    if (!terminalHref) return;
    router.push(terminalHref);
  };
  const market = fullChart
    ? resolveMarketRowPresentation(vitals.payload)
    : null;

  return (
    <Reanimated.View
      style={[styles.wrap, riseStyle]}
      onLayout={onLayout}
      testID={testID}
    >
      <Material weight="card" radius={radii.verdict} contentStyle={styles.body}>
        <View>
          <Reanimated.View style={[styles.region, regionStyle]}>
            {/* The card is one target until it unfolds; then the plot scrubs. */}
            <View
              pointerEvents={unfolded ? 'auto' : 'none'}
              onLayout={onChartFaceLayout}
            >
              <PriceChart
                mint={chart.mint}
                currentPriceUsd={null}
                size={chartProps.size}
                condensed={chartProps.condensed ? true : undefined}
                ranges={chartProps.pinSeedRange ? SEED_RANGES : undefined}
                preloadedHistory={{ range: CHART_SEED_RANGE, state: history }}
                onRangeChange={setRange}
                testID={testID ? `${testID}-chart` : undefined}
              />
            </View>
          </Reanimated.View>
          {extrasOpen ? null : (
            <ChartReadHeadline
              mode="in-hand"
              mint={chart.mint}
              testID={testID ? `${testID}-read` : undefined}
            />
          )}
          {unfolded ? null : (
            <Reanimated.View style={[styles.foot, footStyle]}>
              <View style={styles.footRow}>
                <CorsoText style={styles.footText} numberOfLines={1}>
                  {footLine.bounds}
                </CorsoText>
                {footLine.source === null ? null : (
                  <CorsoText style={styles.footText} numberOfLines={1}>
                    {footLine.source}
                  </CorsoText>
                )}
              </View>
            </Reanimated.View>
          )}
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ expanded: unfolded }}
            hitSlop={unfolded ? resolveChartSeedFoldHitSlop() : undefined}
            style={unfolded ? styles.foldHit : styles.unfoldHit}
            testID={testID ? `${testID}-unfold` : undefined}
          />
        </View>
        {extrasOpen ? (
          <Reanimated.View
            style={
              extrasUnclipped ? extrasStyle : [extrasBoxStyle, extrasStyle]
            }
          >
            <View onLayout={onExtrasLayout} collapsable={false}>
              <StructureRow
                enabled={fullChart}
                presentation={structure}
                onOpenTerminal={terminalHref ? openTerminal : undefined}
                testID={testID ? `${testID}-structure` : undefined}
              />
              <ChartKitRow
                label={CHART_SEED_COPY.openDetails}
                onPress={openDetails}
                accessibilityLabel={CHART_SEED_COPY.openDetails}
                testID={testID ? `${testID}-open-details` : undefined}
              />
              {unfoldedSlot}
            </View>
          </Reanimated.View>
        ) : null}
        {unfolded || onDetails === undefined ? null : (
          <Pressable
            onPress={onDetails}
            hitSlop={{
              top: DETAILS_SLOP_VERTICAL,
              bottom: DETAILS_SLOP_VERTICAL,
              left: C.paddingHorizontal / 2,
              right: C.paddingHorizontal / 2,
            }}
            accessibilityRole="button"
            accessibilityLabel={copy.vitals.details}
            style={styles.details}
            testID={testID ? `${testID}-details` : undefined}
          >
            <CorsoText style={styles.detailsLabel}>
              {copy.vitals.details}
            </CorsoText>
            <CorsoIcon
              name="chevron-right"
              size={C.detailsChevronSize}
              color={colors.inkTertiary}
            />
          </Pressable>
        )}
      </Material>
      {unfolded && market ? (
        <Reanimated.View style={[styles.market, extrasStyle]}>
          <MarketRow
            source={vitals.payload}
            nowMs={displayNowMs}
            testID={testID ? `${testID}-market` : undefined}
          />
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: C.gapAbove },
  body: {
    paddingVertical: C.paddingVertical,
    paddingHorizontal: C.paddingHorizontal,
  },
  region: { overflow: 'hidden' },
  unfoldHit: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  /** Price row only — scrub and the range pills stay free. */
  foldHit: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: resolveChartSeedFoldHitHeight(),
  },
  foot: { overflow: 'hidden' },
  footRow: {
    marginTop: C.footGap,
    height: C.footLineHeight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: C.footGap,
  },
  footText: {
    flexShrink: 1,
    color: colors.inkTertiary,
    fontSize: kitType.caption,
    lineHeight: C.footLineHeight,
    fontFamily: typography.face(kitWeight.regular),
    fontVariant: [...typography.fontVariantTabular],
  },
  details: {
    position: 'absolute',
    top: C.paddingVertical,
    right: C.paddingHorizontal,
    height: PRICE_CHART_SEED_HEAD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: C.detailsGap,
  },
  detailsLabel: {
    color: colors.inkSecondary,
    fontSize: kitType.sub,
    fontFamily: typography.face(kitWeight.regular),
  },
  market: { marginTop: C.gapAbove },
});
