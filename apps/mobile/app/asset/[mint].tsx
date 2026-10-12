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
import { ethena, ethenaInk, HAIR } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import {
  PRICE_QUOTES_REFRESH_MS,
  usePriceQuotes,
} from '@/src/features/balances/usePriceQuotes';
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
import { readFailLine } from '@/src/features/connectivity/connectivity';
import { useReadFailState } from '@/src/features/connectivity/useConnectivity';
import { BALANCE_MASK } from '@/src/features/balances/hideBalances';
import { useHideBalances } from '@/src/features/balances/hideBalancesPreference';
import { resolveSwapEnabled } from '@/src/lib/apiConfig';
import { useAcquireGateInputs } from '@/src/features/security/useAcquireGateInputs';
import { useCuratedBook } from '@/src/features/universe/useCuratedBook';
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
  resolveAssetStructureRow,
  resolveStructureRowPresentation,
} from '@/src/ui/charts/structureRowPresentation';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA';
import type { PriceChartRange } from '@/src/ui/charts/priceChartPresentation';
import {
  EthenaGround,
  EthenaPill,
  EthenaTray,
} from '@/src/ui/ethena/EthenaPrimitives';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { CHART_SEED_DETAILS_RANGE_PARAM } from '@/src/ui/home/chartSeedCardPresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { SCROLL_FADE_TOP } from '@/src/ui/primitives/scrollEdgeFadePresentation';
import { TokenMark } from '@/src/ui/primitives/TokenMark';
import { readRingCopy } from '@/constants/copy/readRing';
import { formatReadStamp } from '@/src/features/tokenVitals/readRingCatalog';
import { EvidenceRow } from '@/src/ui/verdict/EvidenceRow';
import { VerdictCard } from '@/src/ui/verdict/VerdictCard';
import { AssetInvalidLinkFace } from '@/src/ui/majorDetail/AssetInvalidLinkFace';
import { MajorDetailCircle } from '@/src/ui/majorDetail/MajorDetailCircle';
import { readWealthV1BuildFlag } from '@/src/features/wealth/wealthEnv';
import { MajorDetailFace } from '@/src/ui/majorDetail/MajorDetailFace';
import { usePlainRisk } from '@/src/features/plainRisk/usePlainRisk';
import { RiskLevelSlot } from '@/src/ui/risk/RiskLevel';

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
  const failState = useReadFailState();
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
  const prices = usePriceQuotes({
    mints: priceMints,
    refreshIntervalMs: PRICE_QUOTES_REFRESH_MS,
  });
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
  const curated = useCuratedBook(true, holdingsCluster);
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
    // Absent until the read is over, so the Other holdings line never
    // flashes on a served name while the book loads.
    curatedBook: curated.settled ? curated.book : undefined,
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
  const plainRisk = usePlainRisk(mint);
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
  const structureRead = resolveStructureRowPresentation({
    enabled: fullChartEnabled,
    signal: signal.presentation,
    chart,
    nowMs: resolveDisplayedSignalNowMs({
      wallNowMs: displayNowMs,
      lastFetchedAtMs: chart.lastFetchedAtMs,
    }),
  });
  const structure = resolveAssetStructureRow(structureRead);
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
          failState,
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
        wait={readWealthV1BuildFlag()}
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
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/*
        Still 04 `.topbar` — the asset shell's 40 tray disc
        (`MajorDetailCircle`, a 44 dp press target) and no nav title: the
        identity row below names the token, once.
      */}
      <View style={styles.header}>
        <MajorDetailCircle
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
            <EthenaTray testID="token-detail-invalid" style={styles.card}>
              <View
                style={styles.cardContent}
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
            </EthenaTray>
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
                <TokenMark
                  ticker={symbol}
                  mint={mint}
                  size={IDENTITY_MARK_SIZE}
                  accessibilityLabel={`${symbol} token`}
                />
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
                      {readFailLine(
                        priceText ? null : failState,
                        priceText ?? copy.tokenDetail.priceUnknown,
                      )}
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

              <View style={styles.risk}>
                <RiskLevelSlot
                  read={plainRisk}
                  size="cell"
                  testID="token-detail-risk"
                />
              </View>

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
                  ringPlacement="none"
                  coverage="none"
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
                <EthenaTray
                  testID="token-detail-verdict-state"
                  style={{ ...styles.verdict, ...styles.verdictState }}
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
                    <View style={styles.retryRow}>
                      <EthenaPill
                        testID="token-detail-vitals-retry"
                        label={copy.vitals.retry}
                        accessibilityLabel={copy.vitals.retry}
                        plane="floatAction"
                        onPress={vitals.refresh}
                      />
                    </View>
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
                </EthenaTray>
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

              <EthenaTray
                testID="token-detail-chart-card"
                style={{ ...styles.chart, ...styles.chartContent }}
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
              </EthenaTray>
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
        <ScrollEdgeFade
          testID="token-detail-scroll-fade"
          color={ethena.groundStops[0][1]}
        />
      </View>
    </SafeAreaView>
    </EthenaGround>
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
    <EthenaTray testID="token-detail-evidence" style={styles.ledger}>
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
          <CorsoIcon
            name="chevron-down"
            size={16}
            color={ethenaInk.tertiary}
          />
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
            <View style={styles.retryRow}>
              <EthenaPill
                testID="token-detail-facts-retry"
                label={copy.assetDetail.retry}
                accessibilityLabel={copy.assetDetail.retry}
                accessibilityHint={factsError ?? copy.tokenFacts.unavailable}
                plane="floatAction"
                onPress={onRetryFacts}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </EthenaTray>
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
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: TOKEN_DETAIL_GUTTER,
    paddingTop: 8,
    paddingBottom: 8,
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
  /**
   * The first row starts below the top fade on the lit ground, so nothing is
   * dissolved at rest (`scrollEdgeFadeConsumers.test.ts`), as on the major face.
   */
  content: {
    paddingTop: SCROLL_FADE_TOP,
    paddingHorizontal: TOKEN_DETAIL_GUTTER,
    paddingBottom: 64,
  },
  identity: {
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identityName: { flex: 1, minWidth: 0 },
  risk: { marginTop: 12, paddingHorizontal: 2 },
  /** The rating's scope line — 13 in ink-3, under the card, never in it. */
  readRingFootnote: {
    ...ETHENA_TYPE.rowSub,
    marginTop: 10,
    paddingHorizontal: 2,
    color: ethenaInk.tertiary,
  },
  majorChrome: {
    gap: 4,
    marginBottom: 12,
  },
  majorEyebrow: {
    ...ETHENA_TYPE.rowSub,
    color: ethenaInk.tertiary,
    fontWeight: '500',
  },
  /** `.wh b` — the card-heading step, 17/22/600. */
  identityTitle: {
    ...ETHENA_TYPE.cardHeading,
    color: ethenaInk.primary,
  },
  /** `.sub` — 15/20 in ink-2. */
  identitySub: {
    ...ETHENA_TYPE.sub,
    marginTop: 2,
    color: ethenaInk.secondary,
  },
  identityPrice: { alignItems: 'flex-end', flexShrink: 0 },
  /** `.row .v b` — 17/22/500: the price, printed once on this screen. */
  price: {
    ...ETHENA_TYPE.rowValue,
    color: ethenaInk.primary,
  },
  /** `.row .v span` — 13/18 on its own hue: the chart window's change. */
  moverText: {
    ...ETHENA_TYPE.rowDelta,
    marginTop: 2,
    fontWeight: '500',
  },
  title: {
    ...ETHENA_TYPE.cardHeading,
    color: ethenaInk.primary,
  },
  muted: {
    ...ETHENA_TYPE.body,
    marginTop: 8,
    color: ethenaInk.secondary,
  },
  provenance: {
    ...ETHENA_TYPE.keyValueInfo,
    marginTop: 4,
    color: ethenaInk.tertiary,
  },
  verdict: { marginTop: 12 },
  /** Off / checking / unavailable / unread: the tray, told plainly. */
  verdictState: {
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  verdictStateWord: {
    ...ETHENA_TYPE.keyValue,
    color: ethenaInk.secondary,
    fontWeight: '500',
  },
  receipts: {
    flexDirection: 'column',
  },
  stateDoor: { marginBottom: 0 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  action: { flex: 1, marginBottom: 0 },
  noDoorNote: {
    ...ETHENA_TYPE.rowSub,
    marginTop: 12,
    paddingHorizontal: 4,
    color: ethenaInk.secondary,
  },
  chart: { marginTop: 12 },
  chartContent: {
    paddingTop: TOKEN_DETAIL_CHART_CARD.paddingTop,
    paddingHorizontal: TOKEN_DETAIL_CHART_CARD.paddingHorizontal,
    paddingBottom: TOKEN_DETAIL_CHART_CARD.paddingBottom,
  },
  fullChartDoor: { marginTop: 12, marginBottom: 0 },
  market: { marginTop: 12 },
  /** Outer box only — the tray owns the fill, the rim and the radius. */
  card: {
    marginTop: 12,
  },
  cardContent: {
    paddingVertical: ethenaGeometry.pad,
    gap: ethenaGeometry.pad,
  },
  /** `.evidence` — the tray's 16 side pad; the head and body own the rest. */
  ledger: { marginTop: 12, paddingHorizontal: 0 },
  /** `.ev-head` — `padding:14px 16px`. */
  ledgerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: ethenaGeometry.pad,
    paddingVertical: 14,
  },
  ledgerTitle: {
    ...ETHENA_TYPE.keyValueTotal,
    color: ethenaInk.primary,
  },
  /** `.cnt` — the row-sub step in ink-3. */
  ledgerCount: {
    ...ETHENA_TYPE.rowSub,
    color: ethenaInk.tertiary,
  },
  /** `.chev` — `margin-left:auto`. */
  ledgerChevron: { marginLeft: 'auto' },
  /** `.ev-body` — `padding:0 16px 8px`, groups split by the tray hairline. */
  ledgerBody: {
    paddingHorizontal: ethenaGeometry.pad,
    paddingBottom: 8,
    paddingTop: 12,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIR,
  },
  ledgerGroup: { gap: 8 },
  retryRow: { flexDirection: 'row' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  sectionTitle: {
    ...ETHENA_TYPE.keyValueTotal,
    color: ethenaInk.primary,
  },
  provenanceRow: { gap: 4 },
  rowLabel: {
    ...ETHENA_TYPE.rowSub,
    color: ethenaInk.tertiary,
    fontWeight: '500',
  },
  rowValue: {
    ...ETHENA_TYPE.rowSub,
    color: ethenaInk.primary,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
});
