import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaCoin, EthenaNav } from '@/src/ui/ethena/EthenaChrome';
import {
  EthenaDirection,
  EthenaGround,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import {
  SCROLL_FADE_BOTTOM,
  resolveDockedListEdge,
} from '@/src/ui/primitives/scrollEdgeFadePresentation';
import { MAJOR_ASSETS } from '@/src/features/balances/majors';
import {
  isMarketsMajor,
  type MarketsMovingModel,
  type MarketsMovingRow,
} from './marketsMovingPresentation';
import type { InvestmentPlansView, StocksShelfView } from './marketsShelves';

export const MARKETS_ROW_HEIGHT = 44;
const AVATAR_SIZE = 32;

export function MarketsScreen({
  model,
  initials,
  topInset,
  dockReserve,
  plans,
  stocks,
  onOpenProfile,
  onOpenRow,
  onOpenSearch,
  refreshing = false,
  onRefresh,
}: {
  model: MarketsMovingModel;
  plans: InvestmentPlansView;
  stocks: StocksShelfView;
  initials: string;
  topInset: number;
  /** `resolveTabBarPresentation(...).reserve` — the dock's full height. */
  dockReserve: number;
  onOpenProfile: () => void;
  onOpenRow: (mint: string) => void;
  onOpenSearch?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const scrollFade = useScrollLinkedFadeTop();
  const edge = resolveDockedListEdge({
    bottomReserve: dockReserve,
    fadeBottom: SCROLL_FADE_BOTTOM,
    clearance: 16,
  });
  return (
    <EthenaGround>
      <View style={{ flex: 1, paddingTop: topInset }}>
        {/* The box both fades pin to carries no padding, as the Book's: a
            fade starts at its box's own edge, not below the box's padding. */}
        <View style={{ flex: 1 }}>
        <ScrollView
          {...scrollFade.scroller}
          testID="markets"
          contentContainerStyle={{ paddingBottom: edge.paddingBottom }}
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={ethena.ink.primary}
                colors={[ethena.ink.primary]}
                progressBackgroundColor={ethena.crest}
              />
            ) : undefined
          }
        >
          <EthenaNav
            left={
              <Pressable
                testID="markets-avatar"
                onPress={onOpenProfile}
                accessibilityRole="button"
                accessibilityLabel={copy.profile.title}
                hitSlop={8}
              >
                <EthenaCoin glyph={initials} size={AVATAR_SIZE} />
              </Pressable>
            }
            middle={
              <CorsoText
                testID="markets-title"
                accessibilityRole="header"
                style={{ ...ETHENA_TYPE.navMid, color: ethena.ink.primary }}
              >
                {copy.launchDock.locked.markets}
              </CorsoText>
            }
            right={<View style={{ width: AVATAR_SIZE }} />}
          />
          {onOpenSearch ? <SearchEntry onPress={onOpenSearch} /> : null}
          <MovingSection model={model} onOpenRow={onOpenRow} />
          <InvestmentPlansSlot view={plans} />
          <StocksShelfSlot view={stocks} />
        </ScrollView>
        <ScrollEdgeFade
          top={scrollFade.top}
          bottom={0}
          color={ethena.groundStops[0][1]}
          testID="markets-fade-top"
        />
        <ScrollEdgeFade
          top={0}
          bottom={edge.fadeBottom}
          color={ethena.void}
          testID="markets-fade-bottom"
        />
        </View>
      </View>
    </EthenaGround>
  );
}

function SearchEntry({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      testID="markets-search"
      accessibilityRole="button"
      accessibilityLabel={copy.sleeve.findToken}
      onPress={onPress}
      style={{ paddingHorizontal: ethenaGeometry.gutter, paddingTop: 8 }}
    >
      <EthenaTray
        testID="markets-search-tray"
        style={{ minHeight: MARKETS_ROW_HEIGHT, justifyContent: 'center' }}
      >
        <CorsoText
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
        >
          {copy.sleeve.findToken}
        </CorsoText>
      </EthenaTray>
    </Pressable>
  );
}

function InvestmentPlansSlot({ view }: { view: InvestmentPlansView }) {
  switch (view.kind) {
    case 'absent':
      return null;
  }
}

function StocksShelfSlot({ view }: { view: StocksShelfView }) {
  switch (view.kind) {
    case 'absent':
      return null;
    case 'refused':
      return (
        <View
          testID="markets-stocks-refused"
          style={{ paddingHorizontal: ethenaGeometry.gutter, paddingTop: 18 }}
        >
          <CorsoText
            style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary }}
          >
            {view.note}
          </CorsoText>
        </View>
      );
  }
}

function MovingSection({
  model,
  onOpenRow,
}: {
  model: MarketsMovingModel;
  onOpenRow: (mint: string) => void;
}) {
  const header = (right: string | null) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        columnGap: 8,
        flexWrap: 'wrap',
        paddingHorizontal: ethenaGeometry.gutter,
        paddingTop: 18,
        paddingBottom: 8,
      }}
    >
      <CorsoText
        testID="markets-moving-label"
        accessibilityRole="header"
        style={{ ...ETHENA_TYPE.section, color: ethena.ink.secondary }}
      >
        {model.label}
      </CorsoText>
      {right ? (
        <CorsoText
          testID="markets-moving-as-of"
          style={{ ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary }}
        >
          {right}
        </CorsoText>
      ) : null}
    </View>
  );

  const tray = (children: ReactNode) => (
    <EthenaTray
      testID="markets-moving"
      style={{ marginHorizontal: ethenaGeometry.gutter }}
    >
      {children}
    </EthenaTray>
  );

  if (model.kind === 'unavailable') {
    return (
      <>
        {header(null)}
        {tray(
          <CorsoText
            testID="markets-moving-unavailable"
            style={{
              ...ETHENA_TYPE.rowSub,
              color: ethena.ink.secondary,
              paddingVertical: 12,
            }}
          >
            {model.line}
          </CorsoText>,
        )}
      </>
    );
  }

  if (model.kind === 'loading') {
    return (
      <>
        {header(null)}
        {tray(
          MAJOR_ASSETS.filter(isMarketsMajor)
            .slice(0, model.skeletonRows)
            .map(({ symbol }, index) => (
              <View
                key={symbol}
                testID={`markets-moving-skeleton-${index}`}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ height: MARKETS_ROW_HEIGHT, justifyContent: 'center' }}
              >
                <View
                  style={{
                    height: MARKETS_ROW_HEIGHT - 14,
                    borderRadius: 6,
                    backgroundColor: ethena.crest,
                  }}
                />
              </View>
            )),
        )}
      </>
    );
  }

  const stale = model.kind === 'stale';
  return (
    <>
      {header(model.asOf)}
      {tray(
        model.rows.map((row) => (
          <MovingRowView
            key={row.key}
            row={row}
            stale={stale}
            onOpenRow={onOpenRow}
          />
        )),
      )}
    </>
  );
}

function MovingRowView({
  row,
  stale,
  onOpenRow,
}: {
  row: MarketsMovingRow;
  stale: boolean;
  onOpenRow: (mint: string) => void;
}) {
  const figure = stale ? ethena.ink.tertiary : ethena.ink.primary;
  // The spoken change carries its sign: the glyph that shows direction is
  // not read aloud.
  const spokenChange = row.change
    ? `${row.change.direction === 'down' ? '-' : row.change.direction === 'up' ? '+' : ''}${row.change.text}`
    : null;
  const a11y = spokenChange
    ? copy.moving.rowLabel(row.symbol, row.price, spokenChange)
    : [row.symbol, row.price].join(', ');
  return (
    <View>
      <Pressable
        testID={`markets-moving-row-${row.key}`}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => onOpenRow(row.mint)}
        style={{
          minHeight: MARKETS_ROW_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 12,
        }}
      >
        <CorsoText
          numberOfLines={1}
          style={{ ...ETHENA_TYPE.rowName, color: figure, flexShrink: 1 }}
        >
          {row.symbol}
        </CorsoText>
        <View style={{ flex: 1 }} />
        <CorsoText style={{ ...ETHENA_TYPE.rowValue, color: figure }}>
          {row.price}
        </CorsoText>
        <View
          style={{
            minWidth: 58,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 4,
          }}
        >
          {row.change ? (
            <>
              {row.change.direction ? (
                <EthenaDirection
                  testID={`markets-moving-row-${row.key}-direction`}
                  direction={row.change.direction}
                />
              ) : null}
              <CorsoText
                testID={`markets-moving-row-${row.key}-change`}
                style={{
                  ...ETHENA_TYPE.rowDelta,
                  color: stale
                    ? ethena.ink.tertiary
                    : resolveDeltaInk(row.change.direction),
                }}
              >
                {row.change.text}
              </CorsoText>
            </>
          ) : null}
        </View>
      </Pressable>
      {row.why ? (
        <CorsoText
          testID={`markets-moving-row-${row.key}-why`}
          style={{
            ...ETHENA_TYPE.rowSub,
            color: stale ? ethena.ink.tertiary : ethena.ink.secondary,
            paddingBottom: 8,
          }}
        >
          {row.why.text}
        </CorsoText>
      ) : null}
    </View>
  );
}
