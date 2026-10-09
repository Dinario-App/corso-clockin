import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { maskedFigureLabel } from '@/src/ui/format/balanceMask';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import {
  BOOK_SET_PILLS,
  resolveHeroFontSize,
  type BookSetPill,
  type SpineDetailModel,
} from '@/src/features/balances/majorDetailFace';
import type { PriceHistoryState } from '@/src/features/prices/usePriceHistory';
import type { TokenDetailStatGrid } from '@/src/features/tokenDetail/tokenDetailChartPresentation';
import { MajorWhyLineSlot } from '@/src/features/why/WhyViews';
import { CorsoText } from '@/src/theme/CorsoText';
import { ChartReadHeadline } from '@/src/ui/charts/ChartReadHeadline';
import { PriceChart } from '@/src/ui/charts/PriceChart';
import type { PriceChartRange } from '@/src/ui/charts/priceChartPresentation';
import {
  ReportTokenMenu,
  type ReportTokenMenuProps,
} from '@/src/features/moderation/ReportTokenMenu';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import {
  SCROLL_FADE_BOTTOM,
  SCROLL_FADE_TOP,
} from '@/src/ui/primitives/scrollEdgeFadePresentation';
import {
  EthenaGround,
  EthenaPill,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';
import type { StructureRowFace } from '@/src/ui/charts/StructureRow';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import { TokenMark } from '@/src/ui/primitives/TokenMark';
import { MajorDetailCircle } from './MajorDetailCircle';
import {
  FULL,
  HALF,
  MajorDetailStatGrid,
  StatCell,
} from './MajorDetailStatGrid';

export function MajorDetailFace({
  model,
  chart,
  onBack,
  onBuy,
  onSell,
  sellPortions = [],
  onSellPortion,
  onSelectPill,
  onFullChart,
  explainBody,
  headerRight,
  extraNote,
  listSlot,
  report,
}: {
  model: SpineDetailModel;
  chart: {
    mint: string;
    priceUsd: string | null;
    range: PriceChartRange;
    pill: BookSetPill;
    status: PriceHistoryState['status'];
    state: PriceHistoryState;
  };
  onBack: () => void;
  onBuy: () => void;
  onSell: () => void;
  sellPortions?: readonly {
    pct: 25 | 50 | 100;
    label: string;
    a11y: string;
    testID: string;
  }[];
  onSellPortion?: (pct: 25 | 50 | 100) => void;
  onSelectPill: (pill: BookSetPill) => void;
  onFullChart: (() => void) | null;
  explainBody: ReactNode;
  headerRight?: ReactNode;
  extraNote?: string | null;
  /** Selected token list. Omitted when the route has no mint to attach. */
  listSlot?: ReactNode;
  report: ReportTokenMenuProps;
}) {
  const { width, fontScale } = useWindowDimensions();
  const [explainOpen, setExplainOpen] = useState(false);
  const [statGrid, setStatGrid] = useState<TokenDetailStatGrid | null>(null);
  const heroSize = resolveHeroFontSize({
    text: model.heroText,
    fontScale,
    screenWidth: width,
  });
  const note = model.floorNote ?? extraNote ?? null;
  const showFloor = model.buy.shown || model.sell.shown;

  return (
    <EthenaGround>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: ethenaGeometry.gutter,
            paddingBottom: 8,
          }}
        >
          <MajorDetailCircle
            glyph="chevron-left"
            onPress={onBack}
            accessibilityLabel={copy.v1.back}
            testID="major-detail-back"
          />
          <CorsoText
            style={{
              ...ETHENA_TYPE.navMid,
              flex: 1,
              color: ethena.ink.primary,
            }}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {model.displayName}
          </CorsoText>
          {headerRight}
        </View>
        <View style={{ flex: 1, position: 'relative' }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: ethenaGeometry.gutter,
              paddingTop: SCROLL_FADE_TOP,
              paddingBottom: SCROLL_FADE_BOTTOM + 24,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}
          >
            <CorsoText
              style={{ ...ETHENA_TYPE.eyebrow, color: ethena.ink.tertiary }}
            >
              {model.eyebrowText}
            </CorsoText>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: HERO_ROW_GAP,
              }}
            >
              <CorsoText
                testID="major-detail-hero"
                accessibilityLabel={maskedFigureLabel(model.heroText)}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
                allowFontScaling={false}
                style={{
                  ...ETHENA_TYPE.amount,
                  flex: 1,
                  fontSize: heroSize,
                  color: ethena.ink.primary,
                }}
              >
                {model.heroText}
              </CorsoText>
              <TokenMark
                ticker={model.symbol}
                mint={chart.mint}
                size={48}
                accessibilityLabel={`${model.symbol} token`}
              />
            </View>
            {model.qtyText ? (
              <CorsoText
                style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
                accessibilityLabel={maskedFigureLabel(model.qtyText)}
              >
                {model.qtyText}
              </CorsoText>
            ) : null}
            {model.deltaLine ? (
              <CorsoText
                testID="major-detail-delta"
                style={{
                  ...ETHENA_TYPE.sub,
                  color: resolveDeltaInk(model.deltaDirection),
                }}
                accessibilityLabel={
                  model.deltaLine.startsWith('▼')
                    ? `Down ${model.deltaLine.slice(2)}`
                    : `Up ${model.deltaLine.slice(2)}`
                }
              >
                {model.deltaLine}
              </CorsoText>
            ) : null}
            {model.staleLine ? (
              <CorsoText
                testID="major-detail-stale"
                style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
              >
                {model.staleLine}
              </CorsoText>
            ) : null}
            <MajorWhyLineSlot mint={chart.mint} />
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {BOOK_SET_PILLS.map((pill) => {
                const selected = pill === model.selectedPill;
                return (
                  <Pressable
                    key={pill}
                    testID={`major-detail-pill-${pill}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={selected ? model.spanLabel : pill}
                    onPress={() => onSelectPill(pill)}
                    style={{
                      flexShrink: 0,
                      minHeight: ethenaGeometry.segHeight,
                      paddingHorizontal: 10,
                      borderRadius: ethenaGeometry.segHeight / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected
                        ? ethena.ink.primary
                        : 'transparent',
                    }}
                  >
                    <CorsoText
                      style={{
                        ...ETHENA_TYPE.section,
                        color: selected ? ethena.void : ethena.ink.secondary,
                      }}
                    >
                      {pill}
                    </CorsoText>
                  </Pressable>
                );
              })}
              {onFullChart ? (
                <MajorDetailCircle
                  glyph="trend"
                  onPress={onFullChart}
                  accessibilityLabel={copy.majorDetail.fullChart}
                  testID="major-detail-full-chart"
                />
              ) : null}
            </View>
            <CorsoText
              testID="major-detail-span"
              style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
            >
              {model.spanLabel}
            </CorsoText>
            {model.priceUnavailable ||
            (chart.status === 'ready' &&
              (chart.state.series?.length ?? 0) === 0) ? (
              <CorsoText
                testID="major-detail-chart-quiet"
                style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
              >
                {copy.majorDetail.chartQuiet}
              </CorsoText>
            ) : (
              <>
                <PriceChart
                  key={chart.pill}
                  mint={chart.mint}
                  currentPriceUsd={chart.priceUsd}
                  size="detail"
                  condensed
                  ranges={[chart.range]}
                  initialRange={chart.range}
                  preloadedHistory={{ range: chart.range, state: chart.state }}
                  showWindowDelta={false}
                  onDetailStatGrid={setStatGrid}
                  testID="major-detail-chart"
                />
                {statGrid ? (
                  <MajorDetailStatGrid
                    grid={statGrid}
                    structure={
                      <ChartReadHeadline
                        mode="live"
                        mint={chart.mint}
                        face={STRUCTURE_CELL}
                      />
                    }
                  />
                ) : null}
              </>
            )}
            {model.shareText ? (
              <EthenaTray testID="major-detail-share">
                <View style={{ paddingVertical: 14, gap: 4 }}>
                  <CorsoText
                    style={{
                      ...ETHENA_TYPE.eyebrow,
                      color: ethena.ink.tertiary,
                    }}
                  >
                    {copy.majorDetail.statShare}
                  </CorsoText>
                  <CorsoText
                    style={{
                      ...ETHENA_TYPE.rowValue,
                      color: ethena.ink.primary,
                    }}
                    accessibilityLabel={maskedFigureLabel(model.shareText)}
                  >
                    {model.shareText}
                  </CorsoText>
                </View>
              </EthenaTray>
            ) : null}
            {model.wrapperText ? (
              <CorsoText
                testID="major-detail-wrapper"
                style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
              >
                {model.wrapperText}
              </CorsoText>
            ) : null}
            {model.explainShown ? (
              <>
                <EthenaTray testID="major-detail-explain-row">
                  <Pressable
                    testID="major-detail-explain"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: explainOpen }}
                    onPress={() => setExplainOpen((open) => !open)}
                    style={EXPLAIN_ROW}
                  >
                    <CorsoText
                      style={{ ...ETHENA_TYPE.body, color: ethena.ink.primary }}
                    >
                      {copy.majorDetail.explain}
                    </CorsoText>
                    <CorsoIcon
                      name={explainOpen ? 'chevron-down' : 'chevron-right'}
                      size={EXPLAIN_CHEVRON}
                      color={ethena.ink.tertiary}
                    />
                  </Pressable>
                </EthenaTray>
                {explainOpen ? explainBody : null}
              </>
            ) : null}
          </ScrollView>
          <ScrollEdgeFade
            testID="major-detail-scroll-fade"
            color={ethena.groundStops[0][1]}
          />
        </View>
        {note ? (
          <CorsoText
            testID="major-detail-floor-note"
            style={{
              ...ETHENA_TYPE.sub,
              color: ethena.ink.secondary,
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 8,
            }}
          >
            {note}
          </CorsoText>
        ) : null}
        {model.sell.shown && !model.sell.disabled && sellPortions.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 8,
            }}
          >
            {sellPortions.map((portion) => (
              <View key={portion.pct} style={{ flexGrow: 1, flexBasis: 0 }}>
                <EthenaPill
                  testID={portion.testID}
                  label={portion.label}
                  accessibilityLabel={portion.a11y}
                  plane="floatAction"
                  disabled={false}
                  onPress={() => onSellPortion?.(portion.pct)}
                />
              </View>
            ))}
          </View>
        ) : null}
        {showFloor ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              paddingHorizontal: ethenaGeometry.gutter,
              paddingBottom: 8,
            }}
          >
            {model.buy.shown ? (
              <View style={{ flex: 1 }}>
                <EthenaPill
                  testID="major-detail-buy"
                  label={copy.assetDetail.buy}
                  plane="cta"
                  disabled={model.buy.disabled}
                  onPress={model.buy.disabled ? undefined : onBuy}
                />
              </View>
            ) : null}
            {model.sell.shown ? (
              <View style={{ flex: 1 }}>
                <EthenaPill
                  testID="major-detail-sell"
                  label={copy.assetDetail.sell}
                  plane="cta"
                  disabled={model.sell.disabled}
                  onPress={model.sell.disabled ? undefined : onSell}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        <ReportTokenMenu {...report} lead={listSlot} />
      </SafeAreaView>
    </EthenaGround>
  );
}

const HERO_ROW_GAP = 12;
const EXPLAIN_ROW = {
  minHeight: MIN_TAP_TARGET_PT,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
} as const;
const EXPLAIN_CHEVRON = 14;

/** *Structure* as the grid's right-hand cell; opened, it takes the row. */
const STRUCTURE_CELL: StructureRowFace = {
  render: (face) => (
    <StatCell
      label={face.label}
      value={face.value}
      open={face.open}
      onPress={face.onToggle}
      accessibilityLabel={face.accessibilityLabel}
      testID={face.testID}
    />
  ),
  style: HALF,
  openStyle: FULL,
};
