import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { copy } from '@/constants/copy';
import {
  useChartRangePreference,
} from '@/src/features/prices/chartRangePreference';
import type { PriceHistoryState } from '@/src/features/prices/usePriceHistory';
import {
  projectPriceOnScale,
  type ChartLineMarks,
} from '@/src/features/signals/chartEdgePresentation';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { ONGLASS } from '@/src/ui/glass/materialTokens';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import {
  PRICE_CHART_SEED_GAP,
  PRICE_CHART_SEED_HEAD_HEIGHT,
  resolvePriceChartContextLabel,
  resolvePriceChartFace,
  resolvePriceChartHeldHistoryUpdate,
  resolvePriceChartHistoryDisplay,
  resolvePriceChartHistoryPresentation,
  resolvePriceChartSeriesKey,
  resolvePriceChartTransition,
  resolvePriceHistoryMarketDepth,
  type PriceChartHeldHistory,
  type PriceChartRange,
  type PriceChartReadyPresentation,
  type PriceChartSize,
} from '@/src/ui/charts/priceChartPresentation';
import {
  SEGMENTED_HEIGHT,
  SEGMENTED_LABEL,
  SEGMENTED_PAD,
  SEGMENTED_RADIUS,
  SEGMENTED_THUMB_HEIGHT,
  SEGMENTED_THUMB_RADIUS,
  resolveSegmentedGeometry,
} from '@/src/ui/controls/segmentedControlPresentation';
import { colors, kitType, radii, spacing, typography } from '@/src/ui/tokens';
import {
  applyChartRangeMenuToggle,
  PRICE_CHART_HEADER_GAP,
  PRICE_CHART_RANGE_ROW_SM_WIDTH,
  PRICE_CHART_RANGES,
  PRICE_CHART_VISIBLE_RANGE_COUNT,
  PRICE_CHART_WINDOW_LABELS,
  priceChartRangeIntervalMs,
  resolvePriceChartActiveRange,
  resolvePriceChartWindowLabelVisible,
  resolveShownPriceChartRanges,
  usePriceChartSeries,
} from '@/src/features/prices/usePriceChartSeries';
import {
  AnchoredMenu,
  type AnchorRect,
} from '@/src/ui/primitives/AnchoredMenu';
import { overlayLiveTick } from '@/src/features/prices/priceStream';
import { openPriceStream } from '@/src/features/prices/priceStreamTransport';
import { usePriceStream } from '@/src/features/prices/usePriceStream';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import {
  TOKEN_DETAIL_CHART_CARD,
  resolveTokenDetailChartFoot,
  resolveTokenDetailStatGrid,
  type TokenDetailStatGrid,
} from '@/src/features/tokenDetail/tokenDetailChartPresentation';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const DEFAULT_WIDTH = 320;
const RANGE_THUMB_HIT_SLOP = {
  top: (MIN_TAP_TARGET_PT - SEGMENTED_THUMB_HEIGHT) / 2,
  bottom: (MIN_TAP_TARGET_PT - SEGMENTED_THUMB_HEIGHT) / 2,
} as const;
const RANGE_SM = resolveSegmentedGeometry('sm');
const RANGE_SM_THUMB_HIT_SLOP = {
  top: (MIN_TAP_TARGET_PT - RANGE_SM.thumbHeight) / 2,
  bottom: (MIN_TAP_TARGET_PT - RANGE_SM.thumbHeight) / 2,
} as const;
const SEED_HEAD_ITEM_GAP = 8;

export type { PriceChartSize };

export type PriceChartProps = {
  mint: string | null;
  currentPriceUsd: string | null;
  size?: PriceChartSize;
  compact?: boolean;
  condensed?: boolean;
  ranges?: readonly PriceChartRange[];
  testID?: string;
  showMarketDepth?: boolean;
  marks?: ChartLineMarks | null;
  /** The pill the reader chose — a parent decides what to say about 15s. */
  onRangeChange?: (range: PriceChartRange) => void;
  initialRange?: PriceChartRange;
  preloadedHistory?: { range: PriceChartRange; state: PriceHistoryState } | null;
  onPresentedHistory?: (presented: { range: PriceChartRange; state: PriceHistoryState }) => void;
  /**
   * Major detail draws its own glyph delta and its own span. Turning this
   * off drops the chart's window percent and its window name, so a short
   * series cannot inherit "All time".
   */
  showWindowDelta?: boolean;
  onDetailStatGrid?: (grid: TokenDetailStatGrid | null) => void;
};

const RANGE_MENU_WIDTH = 196;
const RANGE_MENU_ROW_HEIGHT = 38;
const RANGE_MENU_SELECTED_DISC = 18;

function TimeframeRow({
  ranges,
  range,
  small,
  hug,
  showMore,
  visibleRanges,
  onChoose,
  onCommitVisible,
}: {
  ranges: readonly PriceChartRange[];
  range: PriceChartRange;
  small: boolean;
  hug: boolean;
  showMore: boolean;
  visibleRanges: readonly PriceChartRange[];
  onChoose: (next: PriceChartRange) => void;
  onCommitVisible: (next: readonly PriceChartRange[]) => void;
}) {
  const moreRef = useRef<View>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [draft, setDraft] = useState<readonly PriceChartRange[]>(visibleRanges);

  function openMore() {
    const node = moreRef.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setDraft(visibleRanges);
      setMenuOpen(true);
    });
  }

  function closeMore() {
    setMenuOpen(false);
  }

  function toggleVisible(candidate: PriceChartRange) {
    const next = applyChartRangeMenuToggle(draft, candidate);
    setDraft(next);
    if (next.length === PRICE_CHART_VISIBLE_RANGE_COUNT) {
      onCommitVisible(next);
    }
  }

  return (
    <View style={styles.rangeCarrier}>
      <View
        style={[
          styles.rangeTrack,
          small ? styles.rangeTrackSm : null,
          hug ? styles.rangeTrackHug : null,
        ]}
      >
        {ranges.map((candidate) => {
          const selected = candidate === range;
          return (
            <Pressable
              key={candidate}
              onPress={() => onChoose(candidate)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              hitSlop={small ? RANGE_SM_THUMB_HIT_SLOP : RANGE_THUMB_HIT_SLOP}
              style={[
                styles.rangeThumb,
                small ? styles.rangeThumbSm : null,
                selected ? styles.rangeThumbSelected : null,
              ]}
            >
              <Text
                style={[
                  selected ? styles.rangeLabelSelected : styles.rangeLabel,
                  small ? styles.rangeLabelSm : null,
                ]}
              >
                {candidate}
              </Text>
            </Pressable>
          );
        })}
        {showMore ? (
          <Pressable
            ref={moreRef}
            onPress={openMore}
            accessibilityRole="button"
            accessibilityLabel="More"
            accessibilityState={{ expanded: menuOpen }}
            hitSlop={small ? RANGE_SM_THUMB_HIT_SLOP : RANGE_THUMB_HIT_SLOP}
            style={[
              styles.rangeThumb,
              small ? styles.rangeThumbSm : null,
              styles.rangeThumbMore,
            ]}
          >
            <CorsoIcon name="more" size={16} color={colors.inkSecondary} />
          </Pressable>
        ) : null}
      </View>
      {showMore ? (
        <AnchoredMenu
          visible={menuOpen}
          anchor={anchor}
          width={RANGE_MENU_WIDTH}
          estimatedHeight={PRICE_CHART_RANGES.length * RANGE_MENU_ROW_HEIGHT + 12}
          align="end"
          radius={radii.smallPane}
          onRequestClose={closeMore}
          dismissLabel="Close"
          contentStyle={styles.rangeMenuPane}
          testID="chart-range-menu"
        >
          {PRICE_CHART_RANGES.map((candidate) => {
            const checked = draft.includes(candidate);
            return (
              <Pressable
                key={candidate}
                onPress={() => toggleVisible(candidate)}
                accessibilityRole="menuitem"
                accessibilityState={{ checked }}
                accessibilityLabel={candidate}
                style={({ pressed }) => [
                  styles.rangeMenuRow,
                  pressed ? styles.rangeMenuRowPressed : null,
                ]}
                testID={`chart-range-menu-${candidate}`}
              >
                <Text style={styles.rangeMenuLabel} numberOfLines={1}>
                  {candidate}
                </Text>
                {checked ? (
                  <View style={styles.rangeMenuDisc}>
                    <CorsoIcon name="check" size={10} color={colors.canvas} />
                  </View>
                ) : (
                  <View style={styles.rangeMenuDiscSlot} />
                )}
              </Pressable>
            );
          })}
        </AnchoredMenu>
      ) : null}
    </View>
  );
}

function useChartHistory(input: {
  mint: string | null;
  range: PriceChartRange;
  preloaded: PriceHistoryState | null;
}): PriceHistoryState {
  const { range, preloaded } = input;
  const mint = preloaded ? null : input.mint;
  const fetched = usePriceChartSeries({ mint, range });
  return preloaded ?? fetched;
}

function DetailFoot({
  presentation,
}: {
  presentation: PriceChartReadyPresentation;
}) {
  const foot = resolveTokenDetailChartFoot(presentation);
  return (
    <View style={styles.detailFoot}>
      <View style={styles.detailFootRow}>
        <Text style={styles.detailFootText}>{foot.bounds}</Text>
        {foot.source ? (
          <Text style={styles.detailFootText}>{foot.source}</Text>
        ) : null}
      </View>
      {foot.coverage.map((line) => (
        <Text key={line} style={styles.detailFootText}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function PriceChart({
  mint,
  currentPriceUsd,
  size,
  compact = false,
  condensed = false,
  ranges,
  testID,
  showMarketDepth = false,
  marks = null,
  onRangeChange,
  onPresentedHistory,
  onDetailStatGrid,
  showWindowDelta = true,
  preloadedHistory = null,
  initialRange,
}: PriceChartProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const face = resolvePriceChartFace({ size, compact, condensed });
  const detailFace = size === 'detail' && face.condensed;
  const preference = useChartRangePreference();
  const shownRanges = resolveShownPriceChartRanges(ranges, preference.visible);
  const showRangeControl = !face.seed && shownRanges.length >= 2;
  const showMore = ranges == null && showRangeControl;
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [chosenRange, setRange] = useState<(typeof PRICE_CHART_RANGES)[number]>(
    initialRange ?? '1D',
  );
  const range = resolvePriceChartActiveRange(chosenRange, shownRanges);
  const [heldHistory, setHeldHistory] = useState<PriceChartHeldHistory | null>(null);
  const [transitionFrom, setTransitionFrom] =
    useState<PriceChartReadyPresentation | null>(null);
  const fetched = useChartHistory({
    mint,
    range,
    preloaded:
      preloadedHistory !== null && preloadedHistory.range === range
        ? preloadedHistory.state
        : null,
  });
  const liveIntervalMs = priceChartRangeIntervalMs(range);
  const live = usePriceStream({
    mint,
    enabled: liveIntervalMs != null && fetched.status === 'ready',
    open: openPriceStream,
  });
  const history = useMemo(() => {
    if (liveIntervalMs == null || fetched.status !== 'ready' || !fetched.series || !live.tick) return fetched;
    const series = overlayLiveTick(fetched.series, live.tick, liveIntervalMs);
    return series === fetched.series ? fetched : { ...fetched, series: [...series] };
  }, [fetched, live.tick, liveIntervalMs]);
  const livePriceUsd = liveIntervalMs != null && live.status === 'live' ? live.tick?.priceUsd ?? null : null;
  const lastHapticIndex = useRef<number | null>(null);
  const draw = useRef(new Animated.Value(0)).current;
  const crossfade = useRef(new Animated.Value(1)).current;
  const previousReady = useRef<{
    key: string;
    mint: string;
    presentation: PriceChartReadyPresentation;
  } | null>(null);
  const height = face.plotHeight;
  // Keyed on the CLOSED bars, not the live overlay: a tick must repaint the
  // last bar in place, never re-run the range crossfade (up to 4 ticks/s).
  const seriesKey = useMemo(
    () => resolvePriceChartSeriesKey(fetched),
    [fetched.status, fetched.series],
  );
  const historyDisplay = resolvePriceChartHistoryDisplay({
    mint,
    range,
    history,
    held: heldHistory,
  });
  const resolvedPresentation = resolvePriceChartHistoryPresentation({
    history: historyDisplay.history,
    currentPriceUsd: livePriceUsd ?? currentPriceUsd,
    width,
    height,
    scrubIndex: historyDisplay.held ? null : scrubIndex,
    condensed: face.condensed,
  });
  const readyKey =
    history.status === 'ready' && resolvedPresentation.kind === 'chart' && mint
      ? `${mint}:${range}:${seriesKey}`
      : null;
  const presentation = resolvedPresentation.kind === 'stub'
    ? resolvedPresentation
    : transitionFrom ?? resolvedPresentation;
  const marketDepth = showMarketDepth
    ? resolvePriceHistoryMarketDepth(historyDisplay.history)
    : [];
  // The edge marks ride the *drawn* scale, so a range change moves them
  // with the line and a mark the window never showed is not painted.
  const markGeometry = useMemo(() => {
    if (!marks || presentation.kind !== 'chart') return null;
    const scale = presentation.priceScale;
    const levelY = marks.level
      ? projectPriceOnScale(marks.level.price, scale)
      : null;
    let band: { y: number; height: number } | null = null;
    if (marks.band) {
      const top = projectPriceOnScale(marks.band.top, scale);
      const bottom = projectPriceOnScale(marks.band.bottom, scale);
      if (top != null && bottom != null) {
        const y = Math.min(top, bottom);
        band = { y, height: Math.max(2, Math.abs(bottom - top)) };
      }
    }
    if (levelY == null && band == null) return null;
    return { levelY, band };
  }, [marks, presentation]);
  // Honest source tag: `live` only while the 15s stream is actually feeding
  // ticks; every other state is the closed-bar tape it really is.
  const sourceTag =
    liveIntervalMs != null && live.status === 'live'
      ? copy.chartEdge.live
      : copy.chartEdge.closedBars;

  useEffect(() => {
    setHeldHistory((held) => resolvePriceChartHeldHistoryUpdate({
      held,
      mint,
      range,
      history,
      seriesKey,
    }));
  }, [mint, range, history.status, seriesKey]);

  useLayoutEffect(() => {
    if (
      readyKey == null ||
      mint == null ||
      resolvedPresentation.kind !== 'chart'
    ) {
      if (
        mint == null ||
        history.status === 'idle' ||
        history.status === 'unavailable'
      ) {
        draw.stopAnimation();
        crossfade.stopAnimation();
        draw.setValue(0);
        crossfade.setValue(1);
        previousReady.current = null;
        setTransitionFrom(null);
      }
      return;
    }

    const previous = previousReady.current;
    if (previous?.key === readyKey) return;
    if (reduceMotion) {
      draw.stopAnimation();
      crossfade.stopAnimation();
      draw.setValue(0);
      crossfade.setValue(1);
      setTransitionFrom(null);
      previousReady.current = {
        key: readyKey,
        mint,
        presentation: resolvedPresentation,
      };
      return;
    }

    const motion = resolvePriceChartTransition({
      hasPreviousSeries: previous?.mint === mint,
      reduceMotion,
    });
    if (motion.kind === 'draw') {
      setTransitionFrom(null);
      crossfade.setValue(1);
      draw.setValue(resolvedPresentation.lineLength);
      previousReady.current = {
        key: readyKey,
        mint,
        presentation: resolvedPresentation,
      };
      Animated.timing(draw, {
        toValue: 0,
        duration: motion.durationMs,
        useNativeDriver: false,
      }).start();
      return;
    }

    draw.stopAnimation();
    draw.setValue(0);
    crossfade.stopAnimation();
    crossfade.setValue(0);
    setTransitionFrom(previous!.presentation);
    Animated.timing(crossfade, {
      toValue: 1,
      duration: motion.durationMs,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      previousReady.current = {
        key: readyKey,
        mint,
        presentation: resolvedPresentation,
      };
      setTransitionFrom(null);
    });
  }, [
    crossfade,
    draw,
    history.status,
    mint,
    readyKey,
    reduceMotion,
  ]);
  useLayoutEffect(() => {
    if (!detailFace || liveIntervalMs == null) return;
    onPresentedHistory?.({ range, state: history });
  }, [detailFace, liveIntervalMs, onPresentedHistory, range, history]);

  const gridMin = presentation.kind === 'chart' ? presentation.minLabel : null;
  const gridMax = presentation.kind === 'chart' ? presentation.maxLabel : null;
  const gridAttribution =
    presentation.kind === 'chart' ? presentation.attribution : null;
  useLayoutEffect(() => {
    if (!detailFace || onDetailStatGrid == null) return;
    onDetailStatGrid(
      gridMin == null || gridMax == null
        ? null
        : resolveTokenDetailStatGrid({
            minLabel: gridMin,
            maxLabel: gridMax,
            attribution: gridAttribution,
          }),
    );
  }, [detailFace, onDetailStatGrid, gridMin, gridMax, gridAttribution]);

  function measure(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.width;
    if (Number.isFinite(next) && next > 32) setWidth(next);
  }

  function updateScrub(locationX: number) {
    if (historyDisplay.held || presentation.kind !== 'chart') return;
    const ratio = Math.max(0, Math.min(1, (locationX - 8) / Math.max(1, width - 16)));
    const next = Math.round(ratio * (presentation.points.length - 1));
    setScrubIndex(next);
    if (lastHapticIndex.current !== next) {
      lastHapticIndex.current = next;
      void Haptics.selectionAsync();
    }
  }

  function beginScrub(event: GestureResponderEvent) {
    setScrubbing(true);
    updateScrub(event.nativeEvent.locationX);
  }

  function moveScrub(event: GestureResponderEvent) {
    if (scrubbing) updateScrub(event.nativeEvent.locationX);
  }

  function endScrub() {
    setScrubbing(false);
    setScrubIndex(null);
    lastHapticIndex.current = null;
  }

  function chooseRange(nextRange: (typeof PRICE_CHART_RANGES)[number]) {
    endScrub();
    setRange(nextRange);
    onRangeChange?.(nextRange);
  }

  function commitVisible(next: readonly PriceChartRange[]) {
    preference.setVisible(next);
    if (!next.includes(range)) {
      chooseRange(resolvePriceChartActiveRange(range, next));
    }
  }

  const timeframeRow = showRangeControl ? (
    <TimeframeRow
      ranges={shownRanges}
      range={range}
      small={face.condensed}
      hug={face.condensed}
      showMore={showMore}
      visibleRanges={preference.visible}
      onChoose={chooseRange}
      onCommitVisible={commitVisible}
    />
  ) : null;

  if (presentation.kind === 'stub') {
    return (
      <View testID={testID} onLayout={measure} style={styles.stub}>
        {presentation.currentPriceText && !detailFace ? (
          <Text style={styles.price}>{presentation.currentPriceText}</Text>
        ) : null}
        <Text style={styles.stubText}>{presentation.message}</Text>
        {presentation.attribution && !face.seed ? (
          <Text style={styles.attribution}>{presentation.attribution}</Text>
        ) : null}
        {timeframeRow}
      </View>
    );
  }
  const incomingPresentation = resolvedPresentation.kind === 'chart'
    ? resolvedPresentation
    : presentation;
  const deltaText = !showWindowDelta
    ? null
    : presentation.scrub
      ? presentation.scrub.deltaText
      : presentation.deltaText;
  const deltaTone = presentation.scrub
    ? presentation.scrub.deltaTone
    : presentation.deltaTone;
  const contextLabel = resolvePriceChartContextLabel(range, presentation.scrub);
  const windowLabel = PRICE_CHART_WINDOW_LABELS[range];
  const showWindowLabel =
    showWindowDelta &&
    face.condensed &&
    presentation.scrub == null &&
    resolvePriceChartWindowLabelVisible({
      contentWidth: width,
      windowLabel,
      percentText: deltaText ?? '',
    });
  // The detail face has no price row, so its scrub readout names the price.
  const headerCaption = presentation.scrub
    ? detailFace
      ? `${presentation.scrub.valueText} · ${contextLabel}`
      : contextLabel
    : showWindowLabel
      ? windowLabel
      : null;

  return (
    <View testID={testID} onLayout={measure} style={face.seed ? styles.seedWrap : styles.wrap}>
      {face.seed ? (
        <View style={styles.seedHead}>
          <Text style={styles.seedPrice}>
            {presentation.scrub?.valueText ?? presentation.currentPriceText}
          </Text>
          {deltaText ? (
            <Text style={[styles.seedDelta, { color: deltaTone ?? undefined }]}>
              {deltaText}
            </Text>
          ) : null}
          <Text style={styles.seedWindow}>{contextLabel}</Text>
        </View>
      ) : (
        <>
          {detailFace ? null : (
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {presentation.scrub?.valueText ?? presentation.currentPriceText}
              </Text>
              {face.condensed ? null : (
                <View style={styles.priceMeta}>
                  {deltaText ? (
                    <Text style={[styles.delta, { color: deltaTone ?? undefined }]}>
                      {deltaText}
                    </Text>
                  ) : null}
                  <Text style={styles.range}>{contextLabel}</Text>
                  <Text style={styles.sourceTag}>{sourceTag}</Text>
                </View>
              )}
            </View>
          )}
          {face.condensed && (headerCaption || deltaText || timeframeRow) ? (
            <View style={styles.condensedHead}>
              <View style={styles.condensedMeta}>
                {headerCaption ? (
                  <Text style={styles.condensedWindow} numberOfLines={1}>
                    {headerCaption}
                  </Text>
                ) : null}
                {deltaText ? (
                  <Text
                    style={[styles.condensedDelta, { color: deltaTone ?? undefined }]}
                    numberOfLines={1}
                  >
                    {deltaText}
                  </Text>
                ) : null}
              </View>
              {timeframeRow}
            </View>
          ) : null}
        </>
      )}
      <Pressable
        disabled={historyDisplay.held}
        delayLongPress={180}
        onLongPress={beginScrub}
        onTouchMove={moveScrub}
        onPressOut={endScrub}
        accessibilityRole="adjustable"
        accessibilityState={{ disabled: historyDisplay.held }}
        accessibilityLabel={presentation.currentPriceText}
        accessibilityHint={presentation.scrub ? presentation.scrub.valueText : undefined}
        style={{ height }}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <LinearGradient id="priceGlowNew" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={incomingPresentation.glowTopColor} />
              <Stop offset="1" stopColor={incomingPresentation.glowTopColor} stopOpacity={0} />
            </LinearGradient>
            {transitionFrom ? (
              <LinearGradient id="priceGlowOld" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={transitionFrom.glowTopColor} />
                <Stop offset="1" stopColor={transitionFrom.glowTopColor} stopOpacity={0} />
              </LinearGradient>
            ) : null}
          </Defs>
          <G opacity={historyDisplay.lineOpacity}>
            {transitionFrom ? (
              <AnimatedG
                opacity={crossfade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                })}
              >
                <Path d={transitionFrom.fillPath} fill="url(#priceGlowOld)" />
                <Path
                  d={transitionFrom.linePath}
                  fill="none"
                  stroke={transitionFrom.lineColor}
                  strokeWidth={transitionFrom.lineWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </AnimatedG>
            ) : null}
            <AnimatedG opacity={transitionFrom ? crossfade : 1}>
              <Path d={incomingPresentation.fillPath} fill="url(#priceGlowNew)" />
              <AnimatedPath
                d={incomingPresentation.linePath}
                fill="none"
                stroke={incomingPresentation.lineColor}
                strokeWidth={incomingPresentation.lineWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[
                  incomingPresentation.lineLength,
                  incomingPresentation.lineLength,
                ]}
                strokeDashoffset={draw}
              />
            </AnimatedG>
          </G>
          {presentation.showGrid ? (
            <Line
              x1={8}
              x2={width - 8}
              y1={presentation.baselineY}
              y2={presentation.baselineY}
              stroke={colors.inkTertiary}
              strokeWidth={1}
            />
          ) : null}
          {markGeometry?.band ? (
            <Rect
              x={8}
              width={Math.max(0, width - 16)}
              y={markGeometry.band.y}
              height={markGeometry.band.height}
              rx={1}
              fill={colors.line}
              stroke={colors.surfaceStroke}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          ) : null}
          {markGeometry?.levelY != null ? (
            <Line
              x1={8}
              x2={width - 8}
              y1={markGeometry.levelY}
              y2={markGeometry.levelY}
              stroke={colors.inkSecondary}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}
          <Circle
            cx={presentation.terminalDot.x}
            cy={presentation.terminalDot.y}
            r={3}
            fill={presentation.lineColor}
          />
          {presentation.scrub ? (
            <>
              <Line
                x1={presentation.scrub.x}
                x2={presentation.scrub.x}
                y1={8}
                y2={height - 8}
                stroke={colors.inkSecondary}
                strokeWidth={1}
                strokeDasharray="2 4"
              />
              <Circle
                cx={presentation.scrub.x}
                cy={presentation.scrub.y}
                r={4}
                fill={presentation.lineColor}
                stroke={colors.canvas}
                strokeWidth={2}
              />
            </>
          ) : null}
        </Svg>
      </Pressable>
      {detailFace && onDetailStatGrid ? null : face.seed ? null : (
        <>
          {detailFace ? (
            <DetailFoot presentation={presentation} />
          ) : (
            <>
              <View style={styles.extremes}>
                <Text style={styles.extreme}>{presentation.minLabel}</Text>
                <Text style={styles.extreme}>{presentation.maxLabel}</Text>
              </View>
              {presentation.attribution ? (
                <Text style={styles.attribution}>{presentation.attribution}</Text>
              ) : null}
            </>
          )}
          {marketDepth.map((row) => (
            <View key={row.label} style={styles.marketDepth}>
              <View style={styles.marketDepthLine}>
                <Text style={styles.marketDepthLabel}>{row.label}</Text>
                <Text style={styles.marketDepthValue}>{row.value}</Text>
              </View>
              <Text style={styles.attribution}>{row.attribution}</Text>
            </View>
          ))}
        </>
      )}
      {face.condensed ? null : timeframeRow}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  seedWrap: { gap: PRICE_CHART_SEED_GAP },
  stub: {
    paddingVertical: spacing.md,
    justifyContent: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  condensedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PRICE_CHART_HEADER_GAP,
    minHeight: RANGE_SM.height,
    flexWrap: 'nowrap',
  },
  condensedMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  condensedWindow: {
    color: colors.inkSecondary,
    fontSize: kitType.sub,
    fontVariant: [...typography.fontVariantTabular],
  },
  condensedDelta: {
    fontFamily: typography.face('500'),
    fontSize: kitType.headline,
    fontVariant: [...typography.fontVariantTabular],
  },
  priceMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  price: {
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontSize: typography.title,
    fontVariant: [...typography.fontVariantTabular],
  },
  seedHead: {
    height: PRICE_CHART_SEED_HEAD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SEED_HEAD_ITEM_GAP,
  },
  seedPrice: {
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontSize: kitType.headline,
    fontVariant: [...typography.fontVariantTabular],
  },
  seedDelta: {
    fontFamily: typography.face('500'),
    fontSize: kitType.sub,
    fontVariant: [...typography.fontVariantTabular],
  },
  seedWindow: {
    color: colors.inkTertiary,
    fontSize: kitType.caption,
    fontVariant: [...typography.fontVariantTabular],
  },
  stubText: {
    color: colors.inkTertiary,
    fontFamily: typography.face('400'),
    fontSize: typography.caption,
  },
  sourceTag: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
    fontVariant: [...typography.fontVariantTabular],
  },
  range: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
    fontVariant: [...typography.fontVariantTabular],
  },
  delta: {
    fontFamily: typography.face('500'),
    fontSize: typography.caption,
    fontVariant: [...typography.fontVariantTabular],
  },
  extremes: { flexDirection: 'row', justifyContent: 'space-between' },
  extreme: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
    fontVariant: [...typography.fontVariantTabular],
  },
  attribution: {
    color: colors.inkTertiary,
    fontFamily: typography.face('400'),
    fontSize: typography.caption,
  },
  marketDepth: { gap: 2 },
  marketDepthLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  marketDepthLabel: {
    color: colors.inkTertiary,
    fontSize: typography.caption,
  },
  marketDepthValue: {
    color: colors.ink,
    fontFamily: typography.face('500'),
    fontSize: typography.caption,
    fontVariant: [...typography.fontVariantTabular],
  },
  detailFoot: { gap: TOKEN_DETAIL_CHART_CARD.footLineGap },
  detailFootRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: TOKEN_DETAIL_CHART_CARD.footColumnGap,
    rowGap: TOKEN_DETAIL_CHART_CARD.footLineGap,
  },
  detailFootText: {
    color: colors.inkTertiary,
    fontFamily: typography.face('400'),
    fontSize: TOKEN_DETAIL_CHART_CARD.footFontSize,
    lineHeight: TOKEN_DETAIL_CHART_CARD.footLineHeight,
    fontVariant: [...typography.fontVariantTabular],
  },
  rangeCarrier: {
    height: MIN_TAP_TARGET_PT,
    justifyContent: 'center',
  },
  rangeTrack: {
    height: SEGMENTED_HEIGHT,
    padding: SEGMENTED_PAD,
    borderRadius: SEGMENTED_RADIUS,
    backgroundColor: colors.surfaceGroup,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeTrackSm: {
    height: RANGE_SM.height,
    padding: RANGE_SM.pad,
    borderRadius: RANGE_SM.radius,
  },
  rangeTrackHug: {
    width: PRICE_CHART_RANGE_ROW_SM_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
  },
  rangeThumb: {
    flex: 1,
    height: SEGMENTED_THUMB_HEIGHT,
    borderRadius: SEGMENTED_THUMB_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeThumbSm: {
    height: RANGE_SM.thumbHeight,
    borderRadius: RANGE_SM.thumbRadius,
  },
  rangeThumbSelected: {
    backgroundColor: colors.selected,
  },
  rangeLabel: {
    ...SEGMENTED_LABEL,
    color: colors.inkSecondary,
    fontFamily: typography.face('500'),
  },
  rangeLabelSelected: {
    ...SEGMENTED_LABEL,
    color: colors.onSelected,
    fontFamily: typography.face('500'),
  },
  rangeLabelSm: {
    fontSize: RANGE_SM.labelFontSize,
  },
  rangeThumbMore: {
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 30,
    paddingHorizontal: 6,
  },
  rangeMenuPane: { padding: 6 },
  rangeMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: RANGE_MENU_ROW_HEIGHT,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radii.menuRow,
  },
  rangeMenuRowPressed: { backgroundColor: ONGLASS },
  rangeMenuLabel: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.rowLabel,
    lineHeight: 18,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.rowLabel, -0.01),
  },
  rangeMenuDisc: {
    width: RANGE_MENU_SELECTED_DISC,
    height: RANGE_MENU_SELECTED_DISC,
    borderRadius: RANGE_MENU_SELECTED_DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  rangeMenuDiscSlot: {
    width: RANGE_MENU_SELECTED_DISC,
    height: RANGE_MENU_SELECTED_DISC,
  },
});
