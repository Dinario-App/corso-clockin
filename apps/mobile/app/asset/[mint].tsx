import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { useLaneGate } from '@/src/features/navigation/laneGates';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import {
  colors,
  kitType,
  kitWeight,
  radii,
  spacing,
  typography,
} from '@/constants/theme';
import { CorsoText } from '@/src/theme/CorsoText';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { usePriceQuotes } from '@/src/features/balances/usePriceQuotes';
import { useHoldings } from '@/src/features/balances/useHoldings';
import { buildMajorDetailModel } from '@/src/features/balances/majorDetailPresentation';
import { getMajorAsset, isMajorMint } from '@/src/features/balances/majors';
import {
  bookSetChartState,
  bookSetFetchRange,
  isSpineDetailMint,
  presentSpineDetail,
  priceThenFromSeries,
  resolveSpineDetailDecimals,
  seriesBarMs,
  type BookSetPill,
} from '@/src/features/balances/majorDetailFace';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { BALANCE_MASK } from '@/src/features/balances/hideBalances';
import { useHideBalances } from '@/src/features/balances/hideBalancesPreference';
import { resolveSwapEnabled } from '@/src/lib/apiConfig';
import { useAcquireGateInputs } from '@/src/features/security/useAcquireGateInputs';
import { useChartRangePreference } from '@/src/features/prices/chartRangePreference';
import { usePriceChartSeries } from '@/src/features/prices/usePriceChartSeries';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { resolveHeldSellDoor } from '@/src/features/swap/heldSellDoor';
import {
  majorDetailSellPortionHref,
  majorSellPortionControls,
} from '@/src/features/swap/sellPortion';
import {
  resolveChartEdgeReadout,
  resolveChartLineMarks,
} from '@/src/features/signals/chartEdgePresentation';
import { buildFullChartHref } from '@/src/features/signals/chartEscalation';
import { readGrokbotRoutesFlag } from '@/src/features/navigation/grokbotRoutes';
import type { SignalTimeframe } from '@/src/features/signals/types';
import { usePublishChartRead } from '@/src/features/signals/chartReadCache';
import { resolveDisplayedSignalNowMs } from '@/src/features/signals/signalSliceRead';
import { useChartBundle } from '@/src/features/signals/useChartBundle';
import {
  useDisplayClock,
  useSignalRefreshOnBundle,
} from '@/src/features/signals/useDisplayClock';
import { useLatestSignal } from '@/src/features/signals/useLatestSignal';
import {
  TOKEN_DETAIL_CHART_CARD,
  TOKEN_DETAIL_GUTTER,
  resolveTokenDetailActiveRange,
  resolveTokenDetailInitialRange,
  resolveTokenDetailPresentedHistory,
  resolveTokenDetailWindowChange,
  type TokenDetailPresentedHistory,
} from '@/src/features/tokenDetail/tokenDetailChartPresentation';
import {
  resolveTokenDetailMover,
  resolveTokenDetailPriceText,
  resolveTokenDetailVerdict,
} from '@/src/features/tokenDetail/tokenDetailPresentation';
import {
  buildAssetDetailRouteModel,
  nextAssetDetailStalenessDelayMs,
  type AssetProvenanceRow,
} from '@/src/features/tokenFacts/assetDetailTokenFacts';
import { TokenFactsPanel } from '@/src/features/tokenFacts/TokenFactsPanel';
import type { TokenFactsPanelModel } from '@/src/features/tokenFacts/formatTokenFactsDisplay';
import { useTokenFacts } from '@/src/features/tokenFacts/useTokenFacts';
import {
  resolvePriceRow,
  resolveSafety,
} from '@/src/features/tokenVitals/tokenVitalsPresentation';
import { useVitals } from '@/src/features/tokenVitals/useVitals';
import { ReportTokenMenu } from '@/src/features/moderation/ReportTokenMenu';
import { useTokenReport } from '@/src/features/moderation/useTokenReport';
import { resolveReportA11yLabel } from '@/src/features/moderation/reportTokenPresentation';
import { MajorDetailListNote } from '@/src/features/watchlist/MajorDetailListNote';
import { WatchStarButton } from '@/src/features/watchlist/WatchStarButton';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { MarketRow } from '@/src/ui/charts/MarketRow';
import { resolveMarketRowPresentation } from '@/src/ui/charts/marketRowPresentation';
import { PriceChart } from '@/src/ui/charts/PriceChart';
import { StructureRow } from '@/src/ui/charts/StructureRow';
import {
  STRUCTURE_ROW_TIMEFRAME,
  resolveStructureRowPresentation,
} from '@/src/ui/charts/structureRowPresentation';
import { IconCircleButton } from '@/src/ui/controls/IconCircleButton';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA';
import type { PriceChartRange } from '@/src/ui/charts/priceChartPresentation';
import { GLASS_MUTE } from '@/src/ui/glass/glassTokens';
import { Material } from '@/src/ui/glass/Material';
import { CHART_SEED_DETAILS_RANGE_PARAM } from '@/src/ui/home/chartSeedCardPresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { TokenMark } from '@/src/ui/primitives/TokenMark';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { readRingCopy } from '@/constants/copy/readRing';
import { formatReadStamp } from '@/src/features/tokenVitals/readRingCatalog';
import { EvidenceRow } from '@/src/ui/verdict/EvidenceRow';
import { ReadRing } from '@/src/ui/verdict/ReadRing';
import { VerdictCard } from '@/src/ui/verdict/VerdictCard';
import { AssetInvalidLinkFace } from '@/src/ui/majorDetail/AssetInvalidLinkFace';
import { MajorDetailCircle } from '@/src/ui/majorDetail/MajorDetailCircle';
import { MajorDetailFace } from '@/src/ui/majorDetail/MajorDetailFace';

const EDGE_TIMEFRAME: SignalTimeframe = STRUCTURE_ROW_TIMEFRAME;

const IDENTITY_MARK_SIZE = 48;

const LEDGER_CHEVRON_MS = 300;
const LEDGER_EASING = Easing.bezier(0.3, 0.8, 0.3, 1);

export default function AssetDetailScreen() {
  const params = useLocalSearchParams<{
    mint: string;
    [CHART_SEED_DETAILS_RANGE_PARAM]?: string;
  }>();
  const rawMint = params.mint;
  const routeSeed = buildAssetDetailRouteModel({
    rawMint,
    state: { status: 'idle', facts: null, error: null },
    nowMs: 0,
  });
  const tokenFacts = useTokenFacts(routeSeed.tokenFactsMint);
  const { session } = useCorsoSession();
  const { getAccessToken } = usePrivy();
  const holdingsCluster =
    tokenFacts.facts != null &&
    tokenFacts.facts.mint === routeSeed.tokenFactsMint
      ? tokenFacts.facts.cluster
      : null;
  const holdingsSession = useMemo(
    () => (session ? { type: session.type, address: session.address } : null),
    [session],
  );
  const holdings = useHoldings({
    session: holdingsSession,
    cluster: holdingsCluster,
    getAccessToken,
  });
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });
  const hideBalances = useHideBalances();
  const heldSell = resolveHeldSellDoor({
    mint: routeSeed.tokenFactsMint,
    cluster: holdingsCluster,
    walletType: session?.type ?? null,
    book: holdings.book,
    facts: tokenFacts.facts,
  });
  const priceMints = useMemo(
    () => (routeSeed.tokenFactsMint ? [routeSeed.tokenFactsMint] : []),
    [routeSeed.tokenFactsMint],
  );
  const prices = usePriceQuotes({ mints: priceMints });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const majorDetail = useMemo(() => {
    const mintKey = routeSeed.tokenFactsMint;
    if (!mintKey || !isMajorMint(mintKey)) return null;
    // quotes[mint].price is a decimal STRING — never coerce with typeof === 'number'.
    return buildMajorDetailModel({
      mint: mintKey,
      book: holdings.book,
      quote: prices.quotes[mintKey] ?? null,
      nowMs,
    });
  }, [routeSeed.tokenFactsMint, holdings.book, prices.quotes, nowMs]);
  const fullChartEnabled = useLaneGate('fullChart');
  const displayNowMs = useDisplayClock({ enabled: fullChartEnabled });
  // Only the focused, foregrounded screen polls; the terminal pushed over
  // it takes the poll with it.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const [initialRange] = useState(() =>
    resolveTokenDetailInitialRange(params[CHART_SEED_DETAILS_RANGE_PARAM]),
  );
  const [chosenRange, setChosenRange] = useState<PriceChartRange>(initialRange);
  const [bookPill, setBookPill] = useState<BookSetPill>('1D');
  const [swapEnabled, setSwapEnabled] = useState<boolean | null>(null);
  const rangePreference = useChartRangePreference();
  const chartRange = resolveTokenDetailActiveRange({
    chosen: chosenRange,
    visible: rangePreference.visible,
  });
  /** Apple 1.2 — the report menu and the control it anchors to. */
  const report = useTokenReport();
  const reportButtonRef = useRef<View>(null);

  const acquireGateInputs = useAcquireGateInputs();
  const route = buildAssetDetailRouteModel({
    rawMint,
    state: {
      status: tokenFacts.status,
      facts: tokenFacts.facts,
      error: tokenFacts.error,
    },
    nowMs,
    heldSell,
    acquireGateInputs,
  });
  const { mint, model } = route;
  const fullChartHref =
    mint && fullChartEnabled && readGrokbotRoutesFlag()
      ? buildFullChartHref({ mint })
      : null;

  const vitals = useVitals({
    seed: null,
    mint,
    focused,
    enabled: fullChartEnabled,
  });
  const chart = useChartBundle({
    mint: fullChartEnabled ? mint : null,
    timeframe: EDGE_TIMEFRAME,
    focused: focused && fullChartEnabled,
  });
  const signal = useLatestSignal({
    mint: fullChartEnabled ? mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
  });
  useSignalRefreshOnBundle(
    fullChartEnabled ? chart.lastFetchedAtMs : null,
    signal.refresh,
  );
  usePublishChartRead({
    mint: fullChartEnabled ? mint : null,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
    signal: signal.presentation,
    status: chart.status,
    bundle: chart.bundle,
    errorCode: chart.errorCode,
    lastFetchedAtMs: chart.lastFetchedAtMs,
  });
  const chartHistory = usePriceChartSeries({ mint, range: chartRange });
  const spine =
    mint != null && isSpineDetailMint({ mint, holdings: fiat.holdings });
  const bookFetchRange = bookSetFetchRange(bookPill);
  const bookSeries = usePriceChartSeries({
    mint: spine ? mint : null,
    range: bookFetchRange,
  });
  const daySeries = usePriceChartSeries({
    mint: spine ? mint : null,
    range: '1D',
  });
  useEffect(() => {
    let cancelled = false;
    void resolveSwapEnabled().then((enabled) => {
      if (!cancelled) setSwapEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [presented, setPresented] = useState<TokenDetailPresentedHistory | null>(null);
  const presentedHistory = resolveTokenDetailPresentedHistory({
    range: chartRange,
    fetched: chartHistory,
    presented,
  });
  const windowChange = useMemo(
    () =>
      resolveTokenDetailWindowChange({
        history: presentedHistory,
        range: chartRange,
      }),
    [presentedHistory, chartRange],
  );

  useEffect(() => {
    const delayMs = nextAssetDetailStalenessDelayMs(tokenFacts.facts, nowMs);
    if (routeSeed.tokenFactsMint == null || delayMs == null) return undefined;

    const timeout = setTimeout(() => {
      setNowMs(Date.now());
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [routeSeed.tokenFactsMint, tokenFacts.facts, nowMs]);

  const payload = vitals.payload;
  const priceRow = payload ? resolvePriceRow(payload) : null;
  const verdict = resolveTokenDetailVerdict({
    enabled: fullChartEnabled,
    safety: payload ? resolveSafety(payload) : null,
    flags: payload?.safety.flags ?? [],
    /** The raw server verdict — `resolveReadRing` folds it, nothing else. */
    verdict: payload?.safety ?? null,
    fetching: vitals.fetching,
    fetchFailed: vitals.fetchFailed,
  });
  const verdictRing =
    verdict.kind === 'ready' || verdict.kind === 'unread' ? verdict.ring : null;
  const stampText = formatReadStamp(verdictRing?.stamp ?? null, Date.now());
  const mover = windowChange
    ? resolveTokenDetailMover({
        changeText: windowChange.text,
        changeTone: windowChange.tone,
      })
    : null;
  const lineOnly = chartRange === '15s';
  const edge = resolveChartEdgeReadout({
    enabled: fullChartEnabled,
    chart,
    timeframe: EDGE_TIMEFRAME,
    nowMs: chart.lastFetchedAtMs ?? nowMs,
  });
  const lineMarks = lineOnly ? null : resolveChartLineMarks(edge);
  const structure = resolveStructureRowPresentation({
    enabled: fullChartEnabled,
    signal: signal.presentation,
    chart,
    nowMs: resolveDisplayedSignalNowMs({
      wallNowMs: displayNowMs,
      lastFetchedAtMs: chart.lastFetchedAtMs,
    }),
  });
  const marketSource = fullChartEnabled ? payload : null;
  const showMarket = resolveMarketRowPresentation(marketSource) != null;
  const labelWithheld = model?.header.labelWithheld ?? false;
  const symbol = labelWithheld
    ? copy.tokenDetail.withheldSymbol
    : (payload?.token.symbol ?? model?.header.title ?? '');
  const factsSymbol =
    mint != null &&
    tokenFacts.facts?.mint === mint &&
    tokenFacts.facts.sources.jupiter.status === 'ok'
      ? tokenFacts.facts.sources.jupiter.fields.symbol
      : null;
  const watchSymbol = payload?.token.symbol ?? factsSymbol;
  const watchName = payload?.token.name ?? null;
  const priceText = resolveTokenDetailPriceText({
    vitalsPriceText: priceRow?.priceText ?? null,
    quotePriceUsd: mint ? (prices.quotes[mint]?.price ?? null) : null,
  });

  const swapActions = model
    ? model.swapActions.map((action, index) => ({
        action,
        index,
        label: index === 0 ? copy.tokenDetail.reviewSwap : action.label,
      }))
    : [];
  const primaryDoor = swapActions[0] ?? null;
  const secondaryDoors = swapActions.slice(1);

  const chartState = bookSetChartState(bookSeries, bookPill, nowMs);
  const shownPoints = chartState.series ?? [];
  const majorAsset = mint ? getMajorAsset(mint) : null;
  const spineModel =
    spine && mint
      ? presentSpineDetail({
          mint,
          symbol: majorAsset?.symbol ?? watchSymbol ?? symbol,
          displayName:
            majorAsset?.displayName ?? watchName ?? watchSymbol ?? symbol,
          decimals: resolveSpineDetailDecimals({
            mint,
            holdings: fiat.holdings,
          }),
          book: holdings.book,
          quote: prices.quotes[mint] ?? null,
          nowMs,
          fiatStatus: fiat.status,
          fiatLines: fiat.result.lines,
          priceThen: priceThenFromSeries(daySeries.series ?? [], nowMs),
          pill: bookPill,
          chartFirstMs: shownPoints[0]?.timestampMs ?? null,
          chartLastMs: shownPoints.at(-1)?.timestampMs ?? null,
          chartBarMs: seriesBarMs(shownPoints),
          swapDirections: (model?.swapActions ?? []).map(
            (action) => action.direction,
          ),
          swapsOff: swapEnabled === false,
          sellWithheldNote: model?.sellWithheldNote ?? null,
          hideBalances,
        })
      : null;
  const buyHref =
    model?.swapActions.find((action) => action.direction === 'buy')?.href ??
    null;
  const sellHref =
    model?.swapActions.find((action) => action.direction === 'sell')?.href ??
    null;

  if (mint == null || model == null) {
    return (
      <AssetInvalidLinkFace onBack={() => goBackOr(BACK_FALLBACK.shell)} />
    );
  }

  if (spineModel && mint) {
    return (
      <MajorDetailFace
        model={spineModel}
        onBack={() => goBackOr(BACK_FALLBACK.shell)}
        onBuy={() => {
          if (buyHref) router.push(buyHref);
        }}
        onSell={() => {
          if (sellHref) router.push(sellHref);
        }}
        sellPortions={
          spineModel.sell.shown && !spineModel.sell.disabled
            ? majorSellPortionControls(spineModel.symbol)
            : []
        }
        onSellPortion={(pct) => {
          if (!sellHref) return;
          router.push(majorDetailSellPortionHref(sellHref, pct));
        }}
        onSelectPill={setBookPill}
        onFullChart={fullChartHref ? () => router.push(fullChartHref) : null}
        extraNote={
          model?.noSwapDoorNote ?? model?.acquireRefusedNote ?? null
        }
        headerRight={
          <View ref={reportButtonRef} collapsable={false}>
            <MajorDetailCircle
              glyph="more"
              onPress={() =>
                report.open(
                  {
                    mint,
                    symbol: labelWithheld ? null : watchSymbol,
                    name: labelWithheld ? null : watchName,
                  },
                  reportButtonRef.current,
                )
              }
              accessibilityLabel={resolveReportA11yLabel({
                symbol: watchSymbol,
                labelWithheld,
              })}
              testID="major-detail-report"
            />
          </View>
        }
        listSlot={<MajorDetailListNote mint={mint} />}
        explainBody={
          model?.panel ? <TokenFactsPanel model={model.panel} /> : null
        }
        chart={{
          mint,
          priceUsd: prices.quotes[mint]?.price ?? null,
          range: bookFetchRange,
          pill: bookPill,
          status: bookSeries.status,
          state: chartState,
        }}
        report={{
          visible: report.visible,
          anchor: report.anchor,
          status: report.status,
          onSelectReason: report.select,
          onRetry: report.retry,
          onRequestClose: report.close,
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconCircleButton
          glyph="chevron-left"
          onPress={() => goBackOr(BACK_FALLBACK.shell)}
          accessibilityLabel={copy.v1.back}
          testID="token-detail-back"
        />
        <View style={styles.headerFill} />
        <View style={styles.headerSpacer}>
          {mint != null && model != null && watchSymbol != null ? (
            <WatchStarButton
              mint={mint}
              symbol={watchSymbol}
              name={watchName}
              labelWithheld={labelWithheld}
              testID="token-detail-watch-star"
            />
          ) : null}
          {mint != null ? (
            <View ref={reportButtonRef} collapsable={false}>
              <IconCircleButton
                glyph="more"
                onPress={() =>
                  report.open(
                    {
                      mint,
                      symbol: labelWithheld ? null : watchSymbol,
                      name: labelWithheld ? null : watchName,
                    },
                    reportButtonRef.current,
                  )
                }
                accessibilityLabel={resolveReportA11yLabel({
                  symbol: watchSymbol,
                  labelWithheld,
                })}
                testID="token-detail-report"
              />
            </View>
          ) : null}
        </View>
      </View>

      <ReportTokenMenu
        visible={report.visible}
        anchor={report.anchor}
        status={report.status}
        onSelectReason={report.select}
        onRetry={report.retry}
        onRequestClose={report.close}
      />

      <View style={styles.scrollWrap}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {mint == null || model == null ? (
            <SettingsCard style={styles.card} contentStyle={styles.cardContent}>
              <View
                accessibilityRole="alert"
                accessibilityLabel={`${copy.assetDetail.invalidTitle}. ${copy.assetDetail.invalidBody}`}
              >
                <CorsoText style={styles.title}>
                  {copy.assetDetail.invalidTitle}
                </CorsoText>
                <CorsoText style={styles.muted}>
                  {copy.assetDetail.invalidBody}
                </CorsoText>
              </View>
            </SettingsCard>
          ) : (
            <>
              {majorDetail ? (
                <View style={styles.majorChrome} testID="major-detail-chrome">
                  <CorsoText style={styles.majorEyebrow}>
                    {majorDetail.eyebrow === 'position'
                      ? copy.majorDetail.eyebrowPosition
                      : copy.majorDetail.eyebrowPrice}
                  </CorsoText>
                  <CorsoText
                    style={styles.identityTitle}
                    accessibilityRole="header"
                  >
                    {majorDetail.asset.displayName}
                  </CorsoText>
                  {majorDetail.hero.kind === 'position' ? (
                    <>
                      <CorsoText
                        style={styles.price}
                        accessibilityLabel={
                          hideBalances
                            ? copy.profile.preferencesBalanceHidden
                            : undefined
                        }
                      >
                        {hideBalances ? BALANCE_MASK : majorDetail.hero.fiatText}
                      </CorsoText>
                      <CorsoText
                        style={styles.identitySub}
                        accessibilityLabel={
                          hideBalances
                            ? copy.profile.preferencesBalanceHidden
                            : undefined
                        }
                      >
                        {hideBalances ? BALANCE_MASK : majorDetail.hero.qtyText}
                      </CorsoText>
                    </>
                  ) : null}
                  {majorDetail.hero.kind === 'price' ? (
                    <CorsoText style={styles.price}>
                      {majorDetail.hero.priceText}
                    </CorsoText>
                  ) : null}
                  {majorDetail.hero.kind === 'unavailable' ? (
                    <CorsoText style={styles.identitySub}>
                      {majorDetail.hero.label === 'loading'
                        ? copy.majorDetail.loading
                        : majorDetail.hero.label === 'holdings_unavailable'
                          ? copy.majorDetail.holdingsUnavailable
                          : copy.majorDetail.priceUnavailable}
                    </CorsoText>
                  ) : null}
                  {majorDetail.priceStale ? (
                    <CorsoText
                      style={styles.identitySub}
                      testID="major-detail-price-stale"
                    >
                      {copy.majorDetail.priceStale}
                    </CorsoText>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.identity}>
                {verdictRing === null ? (
                  <TokenMark
                    ticker={symbol}
                    mint={mint}
                    size={IDENTITY_MARK_SIZE}
                    accessibilityLabel={`${symbol} token`}
                  />
                ) : (
                  <ReadRing
                    cells={verdictRing.cells}
                    verdict={verdictRing.verdict}
                    placement="face"
                    drawKey={mint}
                    accessibilityLabel={verdictRing.accessibilityLabel}
                    testID="token-detail-face-ring"
                  >
                    <TokenMark
                      ticker={symbol}
                      mint={mint}
                      size={IDENTITY_MARK_SIZE}
                      accessibilityLabel={`${symbol} token`}
                    />
                  </ReadRing>
                )}
                {!majorDetail && (
                  <View style={styles.identityName}>
                    <CorsoText
                      style={styles.identityTitle}
                      accessibilityRole="header"
                      numberOfLines={1}
                    >
                      {model.header.title}
                    </CorsoText>
                    <CorsoText style={styles.identitySub} numberOfLines={1}>
                      {symbol} · {copy.tokenDetail.chain}
                    </CorsoText>
                    {payload?.token.isVerified === true ? (
                      <CorsoText
                        style={styles.identitySub}
                        numberOfLines={1}
                        accessibilityLabel={readRingCopy.jupiterVerified}
                      >
                        {readRingCopy.jupiterVerified}
                      </CorsoText>
                    ) : null}
                  </View>
                )}
                {!majorDetail && (
                  <View style={styles.identityPrice}>
                    <CorsoText style={styles.price} numberOfLines={1}>
                      {priceText ?? copy.tokenDetail.priceUnknown}
                    </CorsoText>
                    {mover ? (
                      <CorsoText
                        style={[styles.moverText, { color: mover.tone }]}
                        accessibilityLabel={mover.accessibilityLabel}
                        numberOfLines={1}
                      >
                        {mover.text}
                      </CorsoText>
                    ) : null}
                  </View>
                )}
              </View>
              {model.header.stateLine ? (
                <CorsoText style={styles.muted}>
                  {model.header.stateLine}
                </CorsoText>
              ) : null}
              <CorsoText style={styles.provenance}>
                {model.header.identityLine}
              </CorsoText>

              {/*
                The verdict leads — the shared atom, or the state it is in.
                `unread` gets the atom too, but only when a ring came back:
                without one there is nothing to draw and the pane says so.
              */}
              {verdict.kind === 'ready' ||
              (verdict.kind === 'unread' && verdict.ring !== null) ? (
                <VerdictCard
                  style={styles.verdict}
                  tone={verdict.kind === 'ready' ? verdict.tone : 'unread'}
                  word={
                    verdict.kind === 'ready' ? verdict.word : verdict.message
                  }
                  ring={verdict.ring}
                  /** The face already wears the ring; the card doesn't repeat it. */
                  ringPlacement="none"
                  stampText={stampText}
                  subLine={
                    verdict.kind === 'ready'
                      ? verdict.subLine
                      : (verdict.ring?.reason ?? null)
                  }
                  evidence={verdict.ring === null ? verdict.receipts : []}
                  accessibilityLabel={
                    verdict.kind === 'ready'
                      ? verdict.accessibilityLabel
                      : verdict.message
                  }
                  assemblyKey={`${mint}:${verdict.kind === 'ready' ? verdict.word : verdict.message}`}
                  action={
                    primaryDoor
                      ? {
                          label: primaryDoor.label,
                          accessibilityLabel: `${primaryDoor.label} ${model.header.title}`,
                          onPress: () => router.push(primaryDoor.action.href),
                        }
                      : null
                  }
                  testID="token-detail-verdict"
                />
              ) : (
                <Material
                  weight="card"
                  radius={radii.verdict}
                  style={styles.verdict}
                  contentStyle={styles.verdictState}
                >
                  <CorsoText
                    style={styles.verdictStateWord}
                    accessibilityRole="summary"
                  >
                    {verdict.message}
                  </CorsoText>
                  {verdict.kind === 'unread' && verdict.receipts.length > 0 ? (
                    <View style={styles.receipts} accessibilityRole="list">
                      {verdict.receipts.map((receipt, index) => (
                        <EvidenceRow
                          key={receipt.key}
                          label={receipt.label}
                          value={receipt.value}
                          tone={receipt.tone}
                          isLast={index === verdict.receipts.length - 1}
                        />
                      ))}
                    </View>
                  ) : null}
                  {verdict.kind === 'unavailable' ? (
                    <Pressable
                      onPress={vitals.refresh}
                      accessibilityRole="button"
                      accessibilityLabel={copy.vitals.retry}
                      style={styles.retryInline}
                    >
                      <CorsoText style={styles.retryText}>
                        {copy.vitals.retry}
                      </CorsoText>
                    </Pressable>
                  ) : null}
                  {primaryDoor ? (
                    <PrimaryCTA
                      label={primaryDoor.label}
                      tone="transactional"
                      onPress={() => router.push(primaryDoor.action.href)}
                      accessibilityLabel={`${primaryDoor.label} ${model.header.title}`}
                      style={styles.stateDoor}
                    />
                  ) : null}
                </Material>
              )}

              {verdictRing === null ? null : (
                <CorsoText
                  style={styles.readRingFootnote}
                  testID="token-detail-ring-footnote"
                >
                  {readRingCopy.footnote}
                </CorsoText>
              )}

              {model.noSwapDoorNote != null ? (
                <CorsoText
                  style={styles.noDoorNote}
                  accessibilityRole="text"
                  accessibilityLabel={model.noSwapDoorNote}
                >
                  {model.noSwapDoorNote}
                </CorsoText>
              ) : null}

              {model.acquireRefusedNote != null ? (
                <CorsoText
                  style={styles.noDoorNote}
                  accessibilityRole="text"
                  accessibilityLabel={model.acquireRefusedNote}
                >
                  {model.acquireRefusedNote}
                </CorsoText>
              ) : null}

              {model.sellWithheldNote != null ? (
                <CorsoText
                  style={styles.noDoorNote}
                  accessibilityRole="text"
                  accessibilityLabel={model.sellWithheldNote}
                >
                  {model.sellWithheldNote}
                </CorsoText>
              ) : null}

              {secondaryDoors.length > 0 ? (
                <View style={styles.actions}>
                  {secondaryDoors.map(({ action, label }) => (
                    <SecondaryCTA
                      key={action.direction}
                      label={label}
                      onPress={() => router.push(action.href)}
                      accessibilityLabel={`${label} ${model.header.title}`}
                      style={styles.action}
                    />
                  ))}
                </View>
              ) : null}

              <Material
                weight="card"
                radius={radii.pane}
                style={styles.chart}
                contentStyle={styles.chartContent}
              >
                <PriceChart
                  mint={mint}
                  currentPriceUsd={prices.quotes[mint]?.price ?? null}
                  size="detail"
                  condensed
                  initialRange={initialRange}
                  preloadedHistory={{ range: chartRange, state: chartHistory }}
                  marks={lineMarks}
                  onRangeChange={setChosenRange}
                  onPresentedHistory={setPresented}
                  testID="token-detail-chart"
                />
                <StructureRow
                  enabled={fullChartEnabled}
                  presentation={structure}
                  testID="token-detail-structure"
                />
              </Material>
              {fullChartHref ? (
                <SecondaryCTA
                  label={copy.chartEdge.openTerminal}
                  onPress={() => router.push(fullChartHref)}
                  accessibilityLabel={copy.chartEdge.openTerminalA11y(
                    model.header.title,
                  )}
                  style={styles.fullChartDoor}
                />
              ) : null}
              {showMarket ? (
                <View style={styles.market}>
                  <MarketRow
                    source={marketSource}
                    nowMs={displayNowMs}
                    testID="token-detail-market"
                  />
                </View>
              ) : null}

              <EvidenceLedger
                mint={model.header.subtitle}
                provenanceRows={model.provenanceRows}
                panel={model.panel}
                factsFailed={tokenFacts.status === 'error'}
                factsError={tokenFacts.error}
                onRetryFacts={() => void tokenFacts.refresh()}
              />
            </>
          )}
        </ScrollView>
        <ScrollEdgeFade testID="token-detail-scroll-fade" />
      </View>
    </SafeAreaView>
  );
}

function EvidenceLedger({
  mint,
  provenanceRows,
  panel,
  factsFailed,
  factsError,
  onRetryFacts,
}: {
  mint: string;
  provenanceRows: readonly AssetProvenanceRow[];
  panel: TokenFactsPanelModel;
  factsFailed: boolean;
  factsError: string | null;
  onRetryFacts: () => void;
}) {
  const { reduceMotion } = useAccessibilityPreference();
  const [open, setOpen] = useState(false);
  const chevron = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      chevron.setValue(open ? 1 : 0);
      return;
    }
    Animated.timing(chevron, {
      toValue: open ? 1 : 0,
      duration: LEDGER_CHEVRON_MS,
      easing: LEDGER_EASING,
      useNativeDriver: true,
    }).start();
  }, [open, reduceMotion, chevron]);

  /** Every reading the body holds, counted once — never a rounded-up claim. */
  const checkCount = 1 + provenanceRows.length + panel.rows.length;

  return (
    <SettingsCard style={styles.card} contentStyle={styles.ledger}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${copy.tokenDetail.evidence} · ${copy.tokenDetail.checks(checkCount)}`}
        style={styles.ledgerHead}
      >
        <CorsoText style={styles.ledgerTitle}>
          {copy.tokenDetail.evidence}
        </CorsoText>
        <CorsoText style={styles.ledgerCount}>
          {copy.tokenDetail.checks(checkCount)}
        </CorsoText>
        <Animated.View
          style={[
            styles.ledgerChevron,
            {
              transform: [
                {
                  rotate: chevron.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <CorsoText style={styles.ledgerChevronGlyph}>⌄</CorsoText>
        </Animated.View>
      </Pressable>

      {open ? (
        <View style={styles.ledgerBody}>
          <Row
            label={copy.assetDetail.mint}
            value={mint}
            accessibilityLabel={`${copy.assetDetail.mint} ${truncateAddress(mint)}`}
          />
          {provenanceRows.length > 0 ? (
            <View style={styles.ledgerGroup}>
              <CorsoText style={styles.sectionTitle}>
                {copy.assetDetail.ownershipTitle}
              </CorsoText>
              {provenanceRows.map((row) => (
                <View key={row.label} style={styles.provenanceRow}>
                  <Row label={row.label} value={row.value} />
                  <CorsoText style={styles.provenance}>
                    {row.attribution}
                  </CorsoText>
                </View>
              ))}
              {provenanceRows.some(
                (row) => row.label === copy.assetDetail.top20Accounts,
              ) ? (
                <CorsoText style={styles.provenance}>
                  {copy.assetDetail.top20Methodology}
                </CorsoText>
              ) : null}
            </View>
          ) : null}
          <View style={styles.ledgerGroup}>
            <TokenFactsPanel model={panel} />
          </View>
          {factsFailed ? (
            <Pressable
              onPress={onRetryFacts}
              accessibilityRole="button"
              accessibilityLabel={copy.assetDetail.retry}
              accessibilityHint={factsError ?? copy.tokenFacts.unavailable}
              style={styles.retryButton}
            >
              <CorsoText style={styles.retryText}>
                {copy.assetDetail.retry}
              </CorsoText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </SettingsCard>
  );
}

function Row({
  label,
  value,
  accessibilityLabel,
}: {
  label: string;
  value: string;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <CorsoText style={styles.rowLabel}>{label}</CorsoText>
      <CorsoText
        style={styles.rowValue}
        accessibilityLabel={accessibilityLabel}
      >
        {value}
      </CorsoText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: TOKEN_DETAIL_GUTTER,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerFill: { flex: 1 },
  headerSpacer: {
    minWidth: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  /** The fades pin to this box, so the scroller needs a positioned parent. */
  scrollWrap: { flex: 1 },
  content: {
    paddingHorizontal: TOKEN_DETAIL_GUTTER,
    paddingBottom: spacing.xl * 2,
  },
  identity: {
    marginTop: spacing.sm,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityName: { flex: 1, minWidth: 0 },
  /** The rating's scope line — 13 `grey2`, under the card, never in it. */
  readRingFootnote: {
    marginTop: 10,
    paddingHorizontal: 2,
    fontSize: kitType.caption,
    lineHeight: 18,
    color: colors.inkTertiary,
  },
  majorChrome: {
    gap: 4,
    marginBottom: 12,
  },
  majorEyebrow: {
    color: colors.inkTertiary,
    fontSize: kitType.caption,
    lineHeight: 18,
    fontWeight: kitWeight.medium,
  },
  identityTitle: {
    fontSize: kitType.title,
    lineHeight: 26,
    fontWeight: kitWeight.semibold,
    letterSpacing: -0.48,
    color: colors.ink,
  },
  identitySub: {
    marginTop: 2,
    color: colors.inkSecondary,
    fontSize: kitType.sub,
    letterSpacing: -0.12,
  },
  identityPrice: { alignItems: 'flex-end', flexShrink: 0 },
  price: {
    color: colors.ink,
    fontSize: kitType.title,
    lineHeight: 26,
    fontWeight: kitWeight.semibold,
    letterSpacing: -0.48,
  },
  moverText: {
    marginTop: 2,
    fontSize: kitType.sub,
    fontWeight: kitWeight.medium,
  },
  title: {
    fontSize: typography.title,
    fontWeight: '600',
    color: colors.ink,
  },
  muted: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.body,
  },
  provenance: {
    marginTop: spacing.xs,
    color: colors.inkTertiary,
    fontSize: typography.caption,
  },
  verdict: { marginTop: spacing.smd },
  /** Off / checking / unavailable / unread: the pane, repainted, told plainly. */
  verdictState: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: spacing.smd,
  },
  verdictStateWord: {
    color: GLASS_MUTE,
    fontSize: typography.body,
    fontWeight: '500',
  },
  receipts: {
    flexDirection: 'column',
  },
  stateDoor: { marginBottom: 0 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.smd,
  },
  action: { flex: 1, marginBottom: 0 },
  noDoorNote: {
    marginTop: spacing.smd,
    paddingHorizontal: spacing.xs,
    color: colors.inkSecondary,
    fontSize: typography.caption,
    lineHeight: 18,
  },
  chart: { marginTop: spacing.smd },
  chartContent: {
    paddingTop: TOKEN_DETAIL_CHART_CARD.paddingTop,
    paddingHorizontal: TOKEN_DETAIL_CHART_CARD.paddingHorizontal,
    paddingBottom: TOKEN_DETAIL_CHART_CARD.paddingBottom,
  },
  fullChartDoor: { marginTop: spacing.smd, marginBottom: 0 },
  market: { marginTop: spacing.smd },
  /** Outer box only — the material, radius and clipping are the pane's. */
  card: {
    marginTop: spacing.smd,
  },
  cardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  ledger: {},
  ledgerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ledgerTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    letterSpacing: -0.15,
    color: colors.ink,
  },
  ledgerCount: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.inkTertiary,
  },
  ledgerChevron: { marginLeft: 'auto' },
  ledgerChevronGlyph: {
    color: colors.inkQuaternary,
    fontSize: 14,
    lineHeight: 14,
  },
  ledgerBody: {
    paddingHorizontal: 16,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  ledgerGroup: { gap: spacing.sm },
  retryButton: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.ink,
    borderRadius: radii.cta,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  retryInline: {
    alignSelf: 'flex-start',
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '600',
  },
  provenanceRow: { gap: spacing.xs },
  rowLabel: {
    color: colors.inkTertiary,
    fontSize: 12.5,
    fontWeight: '500',
  },
  rowValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
});
