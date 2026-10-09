import { assertMwaMoneyPathAvailable } from '@/src/features/connect/assertMwaMoneyPathAvailable';
import { captureReceiptReview, freezeSeenReview, saveConfirmedReceipt, warnReceiptSnapshotFailure, type ReceiptCapture } from '@/src/features/activity/receiptCapture';
import type { ReviewWhyBlock } from '@corso/why';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import { ReviewWhySlot } from '@/src/features/why/WhyViews';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { liftInkColor } from '@/src/ui/glass/inkContrast';
import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';
import {
  ETHENA_COMMIT_DISABLED_OPACITY,
  EthenaGround,
} from '@/src/ui/ethena/EthenaPrimitives';
import { useSolBalance } from '@/src/features/balances/useSolBalance';
import { usePriceQuotes } from '@/src/features/balances/usePriceQuotes';
import {
  useUsdcBalance,
} from '@/src/features/balances/useUsdcBalance';
import { usePrivy } from '@privy-io/expo';
import { useActiveSigner } from '@/src/features/security/getActiveSigner';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import { useStepUpConfirm } from '@/src/features/security/useStepUpConfirm';
import { runGatedSwapConfirm } from '@/src/features/swap/swapGateConfirm';
import { resolveDisclosures } from '@/src/features/disclosures/disclosureGate';
import {
  loadJurisdictionGateInputs,
  readJurisdictionGateInputs,
  type JurisdictionGateInputs,
} from '@/src/features/security/jurisdictionGateInputs';
import { formatStepUpThreshold } from '@/src/features/security/stepUpPolicy';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { noteTextInputActivity } from '@/src/features/session/sessionGate';
import {
  resolveFeeBpsStatus,
  type FeeBpsStatus,
  resolveNetworkStatus,
  resolveStepUpPolicy,
  resolveSwapEnabled,
  resolveRoutinesEnabled,
  type NetworkStatus,
} from '@/src/lib/apiConfig';
import {
  resolveSwapNetworkGate,
  swapMayQuoteOnNetwork,
} from '@/src/features/swap/swapNetworkGate';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { submitSwap } from '@/src/features/swap/submitSwap';
import {
  corsoManualOutputFeeAta,
  corsoFeeAuthority,
} from '@/src/features/security/corsoFeeAccount';
import {
  classifyHolding,
  isStablecoinToStablecoinSwap,
} from '@corso/swap-config';
import {
  decideSleeveBuy,
  mapSleeveCapServerCode,
  type SleeveCapRefusal,
} from '@/src/features/sleeve/sleeveCap';
import { readSleeveCap } from '@/src/features/sleeve/sleeveCapClient';
import { computeSwapQuoteDigest } from '@/src/features/swap/quoteDigest';
import { swapQuoteErrorMessage } from '@/src/features/swap/swapQuoteErrorMessage';
import {
  resolveSwapRouteAttribution,
  resolveSwapRouteDisplayName,
} from '@/src/features/swap/routeAttribution';
import {
  requestSwapOrder,
  SwapApiError,
  SwapLandUncertainError,
  type SwapOrderResponse,
} from '@/src/features/swap/swapApi';
import {
  formatSwapPriceImpactValue,
} from '@/src/features/swap/formatPriceImpact';
import {
  applyQuoteIfCurrentClearingConfirm,
  assertConfirmMatchesFrozenIntent,
  assertReadyQuoteMatchesReviewRequest,
  beginQuoteGeneration,
  createQuoteGenerationGate,
  freezeSwapReviewIntent,
  reassertFrozenConfirmAuthority,
  type FrozenSwapReviewIntent,
} from '@/src/features/swap/swapReviewIntent';
import {
  amountToAtomic,
  feeBpsToPercentLabel,
  formatAtomicAmount,
  SOL_MINT,
  tokenForSymbol,
  type SwapToken,
  type SwapTokenSymbol,
} from '@/src/features/swap/tokens';
import { SWAP_COMPOSER_DEFAULTS } from '@/src/features/swap/swapComposerDefaults';
import {
  formatSwapFeeDisplayValue,
  resolveSwapFeeDisplay,
  type SwapFeeDisplay,
} from '@/src/features/swap/swapFeeDisplay';

import { SwapFeeExplanation } from '@/src/features/swap/SwapFeeExplanation';
import {
  maxPayAtomic,
  validateSwapForm,
  type PayBalance,
  type SwapFormValidation,
} from '@/src/features/swap/validateSwap';
import {
  resolveSwapMaxUnavailableMessage,
  resolveSwapPayBalance,
  resolveSwapPayBalanceLabel,
} from '@/src/features/swap/swapPayBalance';
import { SwapReviewTokenFacts } from '@/src/features/tokenFacts/SwapReviewTokenFacts';
import { SwapTokenPickerSheet } from '@/src/features/tokenFacts/SwapTokenPickerSheet';
import { useTokenFacts } from '@/src/features/tokenFacts/useTokenFacts';
import type { TokenFactsResponse } from '@/src/features/tokenFacts/types';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TokenIconView } from '@/src/ui/primitives/TokenIconView';
import { ReviewSign } from '@/src/ui/ethena/screens/ReviewSign';
import {
  ReviewShellCanvas,
  ReviewShellDoors,
  SwapGate,
  reviewShellText,
} from '@/src/ui/ethena/screens/ReviewShell';
import { ReviewFilingsSlot } from '@/src/features/swap/filings/ReviewFilingsSlot';
import { selectFilingsMint } from '@/src/features/swap/filings/selectFilingsMint';
import { ReviewHeadlinesSlot } from '@/src/features/swap/reviewHeadlines/ReviewHeadlinesSlot';
import { usdcMintForCluster } from '@/src/features/balances/usdcConstants';
import { presentReviewSign } from '@/src/features/swap/reviewSignPresenter';
import { presentReviewBookEffect } from '@/src/features/swap/reviewBookEffect';
import { presentReviewFactsLine } from '@/src/features/swap/reviewFactsLine';
import { reviewAfterSale, reviewHeldAtomic } from '@/src/features/swap/afterSale';
import {
  applySellPortionPreset,
  sellPortionPending,
  sellPortionPresetInput,
  sellPortionSettlement,
} from '@/src/features/swap/sellPortion';
import { ReviewFearGreedSlot } from '@/src/features/swap/fearGreed/ReviewFearGreedSlot';
import { ReviewFredSlot } from '@/src/features/swap/fred/ReviewFredSlot';
import { ReviewFundingOiSlot } from '@/src/features/swap/fundingOi/ReviewFundingOiSlot';
import { ReviewWatchlistMount } from '@/src/features/watchlist/ReviewWatchlistMount';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { openBookAddCash } from '@/src/features/home/book/bookDoors';
import {
  TOKEN_CARD_AMOUNT_FONT_SIZE,
  TOKEN_CARD_AMOUNT_PLACEHOLDER_SIZE,
  resolveTokenCardAmountFontSize,
} from '@/src/ui/rows/tokenCardAmountType';
import { alertLine, alertMovedLine } from '@/src/features/priceAlerts/alertCopy';
import { refusal as alertPriceRefusal } from '@/src/features/priceAlerts/alertModel';
import { takeAlertTapEntry } from '@/src/features/priceAlerts/alertTapEntry';
import { resolveAskPrefill } from '@/src/features/swap/askPrefill';
import {
  clearAskSourceTextForSwap,
  readAskSourceTextForSwap,
} from '@/src/features/swap/askSourceTextStore';
import {
  assetPrefillParamsFromSwapRoute,
  resolveAssetPrefill,
  type AssetPrefillPay,
} from '@/src/features/swap/assetPrefill';
import { resolvePayDecimalsProof } from '@/src/features/swap/payDecimalsProof';
import { useHoldings } from '@/src/features/balances/useHoldings';
import { buildComposerDisclosureRows } from '@/src/features/swap/composerDisclosurePresentation';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { CorsoText } from '@/src/theme/CorsoText';
import { SCROLL_FADE_BOTTOM } from '@/src/ui/primitives/scrollEdgeFadePresentation';
import {
  canonNumerals,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { ScreenHeader } from '@/src/ui/navigation/ScreenHeader';
import { SwapKeypad } from '@/src/features/swap/SwapKeypad';
import {
  applySwapKeypadKey,
  type SwapKeypadKeyId,
} from '@/src/features/swap/swapKeypadPresentation';
import { markLiveCardSignedInStore } from '@/src/features/switcher/liveCards';
import { trackEvent } from '@/src/lib/analytics';
import {
  classifySwapFailure,
  reportHandledFailure,
} from '@/src/features/reliability/handledFailureReport';
import {
  composeShowsFailFrame,
  formatGroupedDisplayAmount,
  resolveSignedReceipt,
  resolveSwapFailPresentation,
  type SwapFailPresentation,
} from '@/src/features/swap/swapOutcomePresentation';
import {
  isReviewConfirmationLocked,
  resolveSwapAccountRentRow,
  resolveReviewSheetPresentation,
  reviewSheetPhaseFromStep,
} from '@/src/features/swap/reviewSheetPresentation';
import {
  filterHeldSwapTokens,
} from '@/src/features/swap/heldTokenPicker';
import {
  resolveSwapReceiveDisplay,
  resolveSwapReceiveTone,
} from '@/src/features/swap/swapReceiveDisplay';
import { solscanSignatureUrl } from '@/src/features/activity/solscanUrl';
import { quoteAgeAtSigningEvent } from '@/src/features/swap/quoteAgeAnalytics';
import {
  resolveRugcheckDangerLinePresentation,
  rugcheckAllowsConfirm,
  type RugcheckReviewPresentation,
} from '@/src/features/tokenFacts/rugcheckReviewPresentation';
import {
  resolveLegTokenProgram,
  resolveSwapReviewFactsPanels,
  resolveSwapRiskLeg,
  resolveSwapRiskPresentation,
  selectSwapRiskLeg,
} from '@/src/features/swap/swapRiskLeg';
import { SentimentChip } from '@/src/features/sentiment/SentimentChip';
import { ChartReadHeadline } from '@/src/ui/charts/ChartReadHeadline';
import { PriceChart } from '@/src/ui/charts/PriceChart';
import { CompactAmountText } from '@/src/ui/format/CompactAmountText';
import { ResultMark } from '@/src/ui/state/ResultMark';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import {
  clearRoutineFireForSwap,
  confirmedSwapMatchesRoutineFire,
  readRoutineFireForSwap,
} from '@/src/features/routines/routineFireStore';
import { recordRoutineFire } from '@/src/features/routines/routinesClient';
import { getActiveStepUpSessionKey } from '@/src/features/security/mfaGate';

/** The live token carrying this mint, or null. Never a symbol lookup. */
function tokenForMint(
  mint: string | undefined,
  candidates: readonly SwapToken[],
): SwapToken | null {
  if (mint == null) return null;
  return candidates.find((token) => token.mint === mint) ?? null;
}

type Step = 'compose' | 'review' | 'sending' | 'success' | 'failed';
type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error';
type PickerTarget = 'pay' | 'receive';

const RESULT_MARK_MOMENT_MS = 600;
const PANE_RADIUS = ethenaGeometry.radiusBox;

function feeRowValue(display: SwapFeeDisplay): string {
  switch (display.kind) {
    case 'fee':
      return formatSwapFeeDisplayValue(display);
    case 'resolving':
      return '…';
    case 'unavailable':
      return copy.home.balancePlaceholder;
  }
}

function Row({
  label,
  value,
  compact = false,
  divider = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
  /** Hairline above the row — every row but the first in a list. */
  divider?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        compact && styles.composeRow,
        divider && styles.rowDivider,
      ]}
    >
      <CorsoText style={[styles.rowLabel, compact && styles.composeRowLabel]}>
        {label}
      </CorsoText>
      <CorsoText style={[styles.rowValue, compact && styles.composeRowValue]}>
        {value}
      </CorsoText>
    </View>
  );
}

function openHoldingsFromCapRefusal() {
  router.push({ pathname: '/sleeve' });
}

function openCapSheetFromReview() {
  router.push({ pathname: '/sleeve', params: { sheet: 'cap' } });
}

/** One string per trade: pay mint, receive mint, pay amount in atomic units. */
function alertTradeKey(inputMint: string, outputMint: string, amountAtomic: string) {
  return JSON.stringify([inputMint, outputMint, amountAtomic]);
}

export default function SwapScreen() {
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 0,
        blurRadius: 0,
        spreadDistance: 1,
        inset: true,
        color: tray.borderColor ?? ethena.hair,
      },
    ],
  };
  const {
    session,
    connectedStatus,
    noteUserActivity,
    moneySignerGateStatus,
    retryMoneySignerGate,
  } = useCorsoSession();
  const { getActiveSigner, liveSessionCell, moneySignerGateCells } = useActiveSigner();
  const { getAccessToken } = usePrivy();
  const stepUp = useStepUpConfirm();
  const balance = useSolBalance(session?.address);
  const usdcBalance = useUsdcBalance(session?.address);
  const { reduceMotion } = useAccessibilityPreference();
  const successMarkOpacity = useRef(
    new Animated.Value(reduceMotion ? 1 : 0),
  ).current;

  const routeParams = useLocalSearchParams<{
    alertTap?: string;
    askFromSymbol?: string;
    askToSymbol?: string;
    askToMint?: string;
    askToDecimals?: string;
    askInAmountAtomic?: string;
    askAmountGuard?: string;
    /** `'1'` for an ambiguous-mint row: the pair, deliberately without an amount. */
    askAmountless?: string;
    /** The Home live card that opened Review. Presentation only. */
    askLiveCard?: string;
    assetDirection?: string;
    assetMint?: string;
    assetSymbol?: string;
    assetDecimals?: string;
    /** 25, 50, or 100. Presets the existing amount field. Not a quote field. */
    assetSellPortion?: string;
  }>();
  const [alertTapForLifetime] = useState(() => takeAlertTapEntry(routeParams.alertTap, session));
  const alertAutoReview = useRef(false);
  /** The quote the automatic Review waits for: when it was asked and for which trade. */
  const alertQuoteRequest = useRef<{ startedAtMs: number; trade: string } | null>(null);
  /** The trade the alert opened on Review. W-13/W-14 show only while Review still holds it. */
  const [alertArrivalTrade, setAlertArrivalTrade] = useState<string | null>(null);
  const askSourceTextForLifetime = useRef(readAskSourceTextForSwap()).current;
  const routineFireForLifetime = useRef(readRoutineFireForSwap()).current;
  useEffect(() => () => clearAskSourceTextForSwap(), []);
  useEffect(() => () => clearRoutineFireForSwap(), []);
  const [step, setStep] = useState<Step>('compose');

  useEffect(() => {
    successMarkOpacity.stopAnimation();
    if (step !== 'success') {
      successMarkOpacity.setValue(reduceMotion ? 1 : 0);
      return;
    }
    if (reduceMotion) {
      successMarkOpacity.setValue(1);
      return;
    }
    successMarkOpacity.setValue(0);
    Animated.timing(successMarkOpacity, {
      toValue: 1,
      duration: RESULT_MARK_MOMENT_MS,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, step, successMarkOpacity]);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  // Memoised on the status alone so the gate is referentially stable, as
  // `SendSheetContent` does: it feeds `payToken`/`receiveToken`, which are
  // dependencies of the debounced `refreshQuote`, and a fresh object every
  // render would restart the quote debounce on every keystroke's re-render.
  const networkGate = useMemo(
    () => resolveSwapNetworkGate(networkStatus),
    [networkStatus],
  );
  const cluster = networkGate.state === 'ready' ? networkGate.cluster : null;
  const [paySymbol, setPaySymbol] = useState<SwapTokenSymbol>(
    SWAP_COMPOSER_DEFAULTS.paySymbol,
  );
  /**
   * What they receive can be any mint the picker found, so it is a token and
   * not a symbol. Null means "the built-in USDC for this cluster" — keeping the
   * default derived rather than stored is what makes a cluster change safe.
   */
  const [receivePick, setReceivePick] = useState<SwapToken | null>(null);
  const [payPick, setPayPick] = useState<SwapToken | null>(null);
  const [amount, setAmount] = useState(SWAP_COMPOSER_DEFAULTS.amount);
  const [feeStatus, setFeeStatus] = useState<FeeBpsStatus | null>(null);
  const configLoadRef = useRef<Promise<JurisdictionGateInputs> | null>(null);
  const gateInputsRef = useRef<JurisdictionGateInputs | null>(null);
  const disclosuresReadyRef = useRef(false);
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });
  const fiatRef = useRef(fiat);
  fiatRef.current = fiat;
  const signPressPendingRef = useRef(false);
  const [signControlBusy, setSignControlBusy] = useState(false);
  const [reviewNowMs, setReviewNowMs] = useState(Date.now);
  const [reviewExplainOpen, setReviewExplainOpen] = useState(false);
  const [reviewQuoteRequested, setReviewQuoteRequested] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setReviewNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [swapEnabled, setSwapEnabled] = useState(true);
  const [stepUpThresholdLabel, setStepUpThresholdLabel] = useState('');
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('idle');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [capRefusal, setCapRefusal] = useState<SleeveCapRefusal | null>(null);
  const [order, setOrder] = useState<SwapOrderResponse | null>(null);
  const [quoteDigest, setQuoteDigest] = useState<string | null>(null);
  const [frozenIntent, setFrozenIntent] =
    useState<FrozenSwapReviewIntent | null>(null);
  /** Review fee row "What's this?" — closed again for every new frozen quote. */
  const [feeExplainOpen, setFeeExplainOpen] = useState(false);
  const frozenQuoteDigest = frozenIntent?.quoteDigest ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset-on-change effect — the digest is the trigger, not a read
  useEffect(() => {
    setFeeExplainOpen(false);
  }, [frozenQuoteDigest]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const receiptCaptureRef = useRef<ReceiptCapture | null>(null);
  const reviewWhyBlockRef = useRef<ReviewWhyBlock | null>(null);
  const onReviewWhyBlock = useCallback((block: ReviewWhyBlock | null) => {
    reviewWhyBlockRef.current = block;
  }, []);
  const [fail, setFail] = useState<SwapFailPresentation | null>(null);
  const [routineRecordError, setRoutineRecordError] = useState<string | null>(null);
  useEffect(() => {
    if (step === 'success' && signature && !routineRecordError) router.replace({ pathname: '/activity/[signature]', params: { signature } });
  }, [step, signature, routineRecordError]);
  const [sheetDismissed, setSheetDismissed] = useState(false);
  const waitReviewEpochRef = useRef({ open: false, epoch: 0 });
  if (waitReviewEpochRef.current.open !== (step === 'review' && !sheetDismissed)) waitReviewEpochRef.current = { open: step === 'review' && !sheetDismissed, epoch: waitReviewEpochRef.current.epoch + 1 };
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [chartOpen, setChartOpen] = useState(false);
  const [reviewedRugcheck, setReviewedRugcheck] =
    useState<RugcheckReviewPresentation | null>(null);
  const [dangerAcknowledged, setDangerAcknowledged] = useState(false);
  const initiatedRef = useRef(false);
  const swapStartedAt = useRef<number | null>(null);
  const quoteGateRef = useRef(createQuoteGenerationGate());
  const quoteAbortRef = useRef<AbortController | null>(null);
  const quoteAppliedAtRef = useRef<{
    requestId: string;
    atMs: number;
  } | null>(null);
  /** Generation id of the currently ready quote (0 = none). */
  const readyQuoteGenerationRef = useRef(0);
  /**
   * Synchronous confirm-valid flag — cleared on every amount/percent/max/flip/
   * token/cluster mutation BEFORE React state updates, so a racing Confirm
   * cannot step-up/sign against a superseded review epoch.
   */
  const confirmValidRef = useRef(false);
  /** Synchronous close guard; React state must not leave a one-frame dismiss race. */
  const confirmationPendingRef = useRef(false);
  const signingOutputTokenFactsRef = useRef<TokenFactsResponse | null>(null);
  const signingInputTokenFactsRef = useRef<TokenFactsResponse | null>(null);
  const clusterRef = useRef(cluster);
  const routinesEnabledRef = useRef(false);

  /** Synchronously invalidate in-flight quotes and clear ready state before debounce. */
  function clearQuoteStateSync() {
    // Clear confirm authority first — before any React state updates.
    confirmValidRef.current = false;
    quoteAbortRef.current?.abort();
    quoteGateRef.current.invalidate();
    readyQuoteGenerationRef.current = 0;
    quoteAppliedAtRef.current = null;
    setOrder(null);
    setQuoteDigest(null);
    setFrozenIntent(null);
    setQuoteStatus('idle');
    setQuoteError(null);
  }

  const payToken = useMemo(
    () =>
      payPick ?? (cluster ? tokenForSymbol(paySymbol, cluster) : null),
    [cluster, payPick, paySymbol],
  );
  const receiveToken = useMemo(
    () => receivePick ?? (
      cluster ? tokenForSymbol(SWAP_COMPOSER_DEFAULTS.receiveSymbol, cluster) : null
    ),
    [cluster, receivePick],
  );
  const chartMints = useMemo(() => {
    const mints: string[] = [];
    if (receiveToken) mints.push(receiveToken.mint);
    if (payToken && payToken.mint !== receiveToken?.mint) mints.push(payToken.mint);
    return mints;
  }, [payToken, receiveToken]);
  const chartPrices = usePriceQuotes({ mints: chartMints });
  const receiveSymbol = receiveToken?.symbol ?? '';
  /** Flipping is only honest when the receive side is something they can pay with. */
  const canFlip = receiveSymbol === 'SOL' || receiveSymbol === 'USDC';
  // `useTokenFacts` already takes `null` and stays idle on it, so an unresolved
  // network reads no facts rather than reading facts for a guessed mint.
  const receiveTokenFacts = useTokenFacts(receiveToken?.mint ?? null);
  const payTokenFacts = useTokenFacts(payToken?.mint ?? null);
  const signingOutputTokenFacts =
    receiveTokenFacts.facts?.sources.chain.status === 'ok'
      ? receiveTokenFacts.facts
      : null;
  /** The non-quote leg — what you receive on a buy, what you give up on a sell. */
  const riskLeg = resolveSwapRiskLeg({
    payMint: payToken?.mint ?? null,
    cluster,
  });
  const liveRugcheck = resolveSwapRiskPresentation({
    leg: riskLeg,
    payMint: payToken?.mint ?? null,
    receiveMint: receiveToken?.mint ?? null,
    payFacts: payTokenFacts.facts,
    receiveFacts: receiveTokenFacts.facts,
  });
  const reviewFactsPanels = resolveSwapReviewFactsPanels({
    payMint: payToken?.mint ?? null,
    receiveMint: receiveToken?.mint ?? null,
    cluster,
  });
  // Async confirm handlers read the latest facts/cluster after step-up awaits.
  signingOutputTokenFactsRef.current = signingOutputTokenFacts;
  signingInputTokenFactsRef.current = payTokenFacts.facts?.sources.chain.status === 'ok' ? payTokenFacts.facts : null;
  clusterRef.current = cluster;
  const pickerTokens = useMemo(() => {
    // No cluster, no mints to offer. The picker is unreachable in that state
    // anyway (the screen declines above it), and building it from a guess is
    // the thing this change removes.
    if (!cluster) return [];
    const all = [
      tokenForSymbol('SOL', cluster),
      tokenForSymbol('USDC', cluster),
    ];
    const solHeld =
      balance.status === 'ready' && (balance.lamports ?? 0) > 0;
    const usdcHeld =
      usdcBalance.status === 'ready' &&
      usdcBalance.atomic !== null &&
      usdcBalance.atomic > 0n;
    return filterHeldSwapTokens({
      tokens: all,
      solHeld,
      usdcHeld,
    });
  }, [cluster, balance.status, balance.lamports, usdcBalance.status, usdcBalance.atomic]);
  const holdingsSession = useMemo(
    () =>
      session ? { type: session.type, address: session.address } : null,
    [session],
  );
  const holdings = useHoldings({
    session: holdingsSession,
    cluster,
    getAccessToken,
  });
  const payDecimalsProof = useMemo(
    () =>
      resolvePayDecimalsProof({
        payToken,
        cluster,
        facts: payTokenFacts.facts,
      }),
    [cluster, payToken, payTokenFacts.facts],
  );
  const payBalance = useMemo<PayBalance>(
    () =>
      cluster && payToken
        ? resolveSwapPayBalance({
            payMint: payToken.mint,
            cluster,
            solLamports: balance.lamports,
            usdcStatus: usdcBalance.status,
            usdcAtomic: usdcBalance.atomic,
            payTokenProgram: resolveLegTokenProgram({
              mint: payToken.mint,
              facts: payTokenFacts.facts,
            }),
            payTokenFacts: payTokenFacts.facts,
            walletType: session?.type ?? null,
            holdings: holdings.book,
            payDecimalsProof,
          })
        : { known: false, reason: 'holdings_unavailable' },
    [
      balance.lamports,
      cluster,
      holdings.book,
      payDecimalsProof,
      payToken,
      payTokenFacts.facts,
      session?.type,
      usdcBalance.atomic,
      usdcBalance.status,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const policy = await resolveStepUpPolicy();
      if (!cancelled) {
        setStepUpThresholdLabel(
          formatStepUpThreshold(policy.stepUpThresholdSol),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const askPrefillApplied = useRef(false);
  useEffect(() => {
    if (askPrefillApplied.current || !cluster) return;
    if (routeParams.alertTap) {
      askPrefillApplied.current = true;
      if (!alertTapForLifetime || alertTapForLifetime.owner !== session || cluster !== 'mainnet-beta') return;
      const prefill = alertTapForLifetime.prefill;
      clearQuoteStateSync();
      if (prefill.pay.kind === 'held') setPayPick(prefill.pay.token);
      else { setPayPick(null); setPaySymbol(prefill.pay.symbol); }
      setReceivePick(prefill.receive); setAmount(prefill.amount);
      alertAutoReview.current = prefill.amount !== '';
      return;
    }
    const askPrefill = resolveAskPrefill({
      params: {
        fromSymbol: routeParams.askFromSymbol,
        toSymbol: routeParams.askToSymbol,
        toMint: routeParams.askToMint,
        toDecimals: routeParams.askToDecimals,
        inAmountAtomic: routeParams.askInAmountAtomic,
        amountGuard: routeParams.askAmountGuard,
        amountless: routeParams.askAmountless,
      },
      cluster,
      sourceText: askSourceTextForLifetime,
    });
    const hasAskRouteParams = [
      routeParams.askFromSymbol,
      routeParams.askToSymbol,
      routeParams.askToMint,
      routeParams.askToDecimals,
      routeParams.askInAmountAtomic,
      routeParams.askAmountGuard,
      routeParams.askAmountless,
    ].some((value) => value !== undefined);
    const assetPrefill = hasAskRouteParams
      ? null
      : resolveAssetPrefill({
          params: assetPrefillParamsFromSwapRoute(routeParams),
          cluster,
        });
    const prefill = askPrefill ?? assetPrefill;
    if (!prefill) return;
    askPrefillApplied.current = true;
    const prefillPay: AssetPrefillPay | null = askPrefill
      ? { kind: 'symbol', symbol: askPrefill.paySymbol }
      : (assetPrefill?.pay ?? null);
    if (prefillPay == null) return;
    if (prefillPay.kind === 'held') {
      setPayPick(prefillPay.token);
    } else {
      setPayPick(null);
      setPaySymbol(prefillPay.symbol);
    }
    setReceivePick(prefill.receive);
    if (askPrefill) setAmount(askPrefill.amount);
  }, [
    cluster,
    routeParams.alertTap,
    session,
    routeParams.askFromSymbol,
    routeParams.askToSymbol,
    routeParams.askToMint,
    routeParams.askToDecimals,
    routeParams.askInAmountAtomic,
    routeParams.askAmountGuard,
    routeParams.askAmountless,
    routeParams.assetDirection,
    routeParams.assetMint,
    routeParams.assetSymbol,
    routeParams.assetDecimals,
    askSourceTextForLifetime,
  ]);

  /**
   * A major-detail portion presets the amount the quote already sends.
   * It waits until that pay channel has settled, then writes once.
   */
  const sellPortionApplied = useRef<string | null>(null);
  useEffect(() => {
    const portionKey = `${routeParams.assetDirection ?? ''}:${routeParams.assetSellPortion ?? ''}`;
    if (sellPortionApplied.current === portionKey) return;
    const pending = sellPortionPending({
      payMint: payToken?.mint ?? null,
      cluster,
      solStatus: balance.status,
      usdcStatus: usdcBalance.status,
      holdingsStatus: holdings.book.status,
      factsStatus: payTokenFacts.status,
    });
    const preset = applySellPortionPreset(
      sellPortionPresetInput(
        {
          assetSellPortion: routeParams.assetSellPortion,
          assetDirection: routeParams.assetDirection,
          assetMint: routeParams.assetMint,
        },
        {
          payToken,
          payBalance,
          usdc: { status: usdcBalance.status, error: usdcBalance.error },
          pending,
        },
      ),
    );
    const settlement = sellPortionSettlement(preset);
    if (!settlement.applied) return;
    sellPortionApplied.current = portionKey;
    if (settlement.display != null) setAmount(settlement.display);
    if (settlement.message != null) setFormError(settlement.message);
  }, [
    balance.status,
    cluster,
    holdings.book.status,
    payBalance,
    payToken,
    payTokenFacts.status,
    routeParams.assetDirection,
    routeParams.assetMint,
    routeParams.assetSellPortion,
    usdcBalance.error,
    usdcBalance.status,
  ]);

  useEffect(() => {
    let cancelled = false;
    const load = (async () => {
      // Loaded here on mount, alongside the other config, so confirm normally
      // pays no round trip. Confirm awaits this promise if it is still in
      // flight and reads *its* result, never the render's copy of it.
      const [enabled, nextFeeStatus, nextNetwork, gateInputs, disclosures, routinesEnabled] =
        await Promise.all([
          resolveSwapEnabled(),
          resolveFeeBpsStatus(),
          resolveNetworkStatus(),
          loadJurisdictionGateInputs(),
          resolveDisclosures(),
          resolveRoutinesEnabled(),
        ]);
      // Both refs are set even when the effect was cancelled: an unmount must
      // not leave a later confirm reading nothing. Neither is rendered, so
      // there is no state-after-unmount hazard.
      //
      // For the disclosure ref specifically, this ordering is the point. The
      // other values feed rendering, which a cancelled effect must not touch;
      // this one feeds a refusal, and a stale `false` only ever refuses.
      // Skipping the write because the effect was cancelled would be the one
      // way this ref could hold a value that opens a door it should not.
      gateInputsRef.current = gateInputs;
      disclosuresReadyRef.current = disclosures.disclosuresReady;
      routinesEnabledRef.current = routinesEnabled;
      if (!cancelled) {
        setSwapEnabled(enabled);
        // The status itself, so `null` keeps meaning "not resolved yet" and a
        // resolved `unknown` stays distinguishable from it.
        setFeeStatus(nextFeeStatus);
        setNetworkStatus(nextNetwork);
      }
      return gateInputs;
    })();
    configLoadRef.current = load;
    return () => {
      cancelled = true;
    };
  }, []);

  const form: SwapFormValidation =
    payToken && receiveToken
      ? validateSwapForm({ payToken, receiveToken, amount, payBalance })
      : { ok: false, message: '', cta: copy.swap.enterAmount };

  const refreshQuote = useCallback(async () => {
    if (!session?.address) return;
    if (!payToken || !receiveToken || !swapMayQuoteOnNetwork(networkGate)) {
      clearQuoteStateSync();
      return;
    }
    try {
        assertMwaMoneyPathAvailable({
          sessionType: session.type,
          capabilities: session.capabilities,
          connectedStatus,
          readOnly: true,
        });
      }
    catch { clearQuoteStateSync(); setQuoteError(copy.buy.authDoorUnsupported); return; }
    const next = validateSwapForm({
      payToken,
      receiveToken,
      amount,
      payBalance,
    });
    if (!next.ok) {
      clearQuoteStateSync();
      return;
    }

    quoteAbortRef.current?.abort();
    const abort = new AbortController();
    quoteAbortRef.current = abort;
    // Clear confirm-valid synchronously before every quote generation begin.
    const generation = beginQuoteGeneration({
      gate: quoteGateRef.current,
      confirmValid: confirmValidRef,
    });
    readyQuoteGenerationRef.current = 0;
    quoteAppliedAtRef.current = null;

    setQuoteStatus('loading');
    setQuoteError(null);
    setFrozenIntent(null);
    setReviewedRugcheck(null);
    setDangerAcknowledged(false);
    const quoteStarted = Date.now();
    if (!initiatedRef.current) {
      initiatedRef.current = true;
      trackEvent('swap_initiated', {
        from_mint: payToken.mint,
        to_mint: receiveToken.mint,
      });
    }
    const quoteCluster =
      networkGate.state === 'ready' ? networkGate.cluster : null;
    if (quoteCluster) {
      const section = classifyHolding(
        { mint: receiveToken.mint, includeInHomeTotal: true },
        quoteCluster,
      );
      if (section === 'sleeve') {
        const cap = await readSleeveCap({
          getAccessToken:
            session.type === 'privy_embedded' ? getAccessToken : undefined,
          signal: abort.signal,
        });
        if (
          abort.signal.aborted ||
          !quoteGateRef.current.isCurrent(generation)
        ) {
          return;
        }
        const decision = decideSleeveBuy({
          section,
          walletType: session.type,
          cap,
          read: fiatRef.current,
        });
        if (!decision.allow) {
          readyQuoteGenerationRef.current = 0;
          setOrder(null);
          setQuoteDigest(null);
          setFrozenIntent(null);
          setQuoteStatus('error');
          setQuoteError(decision.refusal.body || decision.refusal.heading);
          setCapRefusal(decision.refusal);
          return;
        }
      }
    }
    setCapRefusal(null);
    try {
      const feeAuthority = corsoFeeAuthority();
      const feeWaived = isStablecoinToStablecoinSwap({
        inputMint: payToken.mint,
        outputMint: receiveToken.mint,
      });
      if (alertTapForLifetime && alertAutoReview.current) alertQuoteRequest.current = { startedAtMs: Date.now(), trade: alertTradeKey(payToken.mint, receiveToken.mint, next.atomicIn) };
      const quoted = await requestSwapOrder({
        getAccessToken: session.type === 'privy_embedded' ? getAccessToken : undefined,
        inputMint: payToken.mint,
        outputMint: receiveToken.mint,
        amount: next.atomicIn,
        taker: session.address,
        feeAccount: !feeWaived && feeAuthority && !(payToken.mint === SOL_MINT && receiveTokenFacts.facts?.sources.chain.fields.tokenProgram === 'token-2022')
          ? corsoManualOutputFeeAta({ mint: receiveToken.mint, authority: feeAuthority, tokenProgram: receiveTokenFacts.facts?.sources.chain.fields.tokenProgram === 'token-2022' ? 'token-2022' : 'spl-token' })
          : null,
        signal: abort.signal,
      });
      // Prefer API-issued digest; recompute locally must match.
      const localDigest = computeSwapQuoteDigest(quoted);
      if (quoted.quoteDigest !== localDigest) {
        throw new SwapApiError(
          'swap_quote_invalid',
          'Quote binding mismatch. Try again.',
        );
      }
      // Clear confirm-valid synchronously before every quote apply.
      const applied = applyQuoteIfCurrentClearingConfirm({
        generation,
        gate: quoteGateRef.current,
        confirmValid: confirmValidRef,
        apply: () => {
          setOrder(quoted);
          setQuoteDigest(quoted.quoteDigest);
          setQuoteStatus('ready');
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          readyQuoteGenerationRef.current = generation;
          quoteAppliedAtRef.current = {
            requestId: quoted.requestId,
            atMs: Date.now(),
          };
          return quoted;
        },
      });
      if (!applied) {
        // Superseded by a newer quote (e.g. SOL↔USDC flip race).
        return;
      }
      trackEvent('swap_quoted', {
        in_amount: quoted.inAmount,
        out_amount_est: quoted.outAmount,
        fee_bps: quoted.corsoFeeBps,
        latency_ms: Date.now() - quoteStarted,
        request_id: quoted.requestId,
      });
    } catch (error) {
      if (abort.signal.aborted || !quoteGateRef.current.isCurrent(generation)) {
        return;
      }
      readyQuoteGenerationRef.current = 0;
      quoteAppliedAtRef.current = null;
      setOrder(null);
      setQuoteDigest(null);
      setFrozenIntent(null);
      setQuoteStatus('error');
      const mapped =
        error instanceof SwapApiError
          ? mapSleeveCapServerCode(error.code)
          : null;
      if (mapped) {
        setCapRefusal(mapped);
        setQuoteError(mapped.body || mapped.heading);
      } else {
        setCapRefusal(null);
        setQuoteError(swapQuoteErrorMessage(error));
      }
      trackEvent('swap_failed', {
        stage: 'quote',
        error_code:
          error instanceof SwapApiError ? error.code : 'quote_failed',
      });
    }
  }, [
    amount,
    getAccessToken,
    networkGate,
    payBalance,
    payToken,
    receiveToken,
    receiveTokenFacts.facts,
    session?.address,
    session?.type,
    connectedStatus,
  ]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void refreshQuote();
    }, 450);
    return () => clearTimeout(handle);
  }, [refreshQuote]);

  const lastKnownCluster = useRef<'devnet' | 'mainnet-beta' | null>(null);
  useEffect(() => {
    if (!cluster) return;
    const previous = lastKnownCluster.current;
    lastKnownCluster.current = cluster;
    if (previous !== null && previous !== cluster) {
      setReceivePick(null);
      setPayPick(null);
    }
  }, [cluster]);

  useEffect(() => {
    clearQuoteStateSync();
    // Intentionally omit clearQuoteStateSync from deps — it closes over setters/refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cluster, payToken?.mint, receiveToken?.mint]);

  function onFlip() {
    if (!canFlip || !cluster || !payToken) return;
    clearQuoteStateSync();
    const nextPay = receiveSymbol as SwapTokenSymbol;
    setReceivePick(payToken);
    setPayPick(null);
    setPaySymbol(nextPay);
    setAmount('');
    setFormError(null);
  }

  function onPickToken(token: SwapToken) {
    alertAutoReview.current = false;
    if (!payToken || !receiveToken || !cluster) return;
    clearQuoteStateSync();
    const builtIn = (['SOL', 'USDC'] as const)
      .map((symbol) => tokenForSymbol(symbol, cluster))
      .find((candidate) => candidate.mint === token.mint);
    if (pickerTarget === 'pay') {
      // Bind the exact row, including its full mint. A symbol is not identity.
      // Balance, chain-decimals and same-mint validation still gate the trade.
      if (builtIn) {
        // Quote-mint decimals are exempt from chain re-proof because these
        // constants, rather than search metadata, supply their identity.
        setPayPick(null);
        setPaySymbol(builtIn.symbol as SwapTokenSymbol);
      } else {
        setPayPick(token);
      }
    } else if (pickerTarget === 'receive') {
      // Picking one leg never silently changes the other leg.
      setReceivePick(builtIn ?? token);
    }
    setFormError(null);
  }

  function onMax() {
    alertAutoReview.current = false;
    if (!payToken) return;
    clearQuoteStateSync();
    if (!payBalance.known) {
      setFormError(
        resolveSwapMaxUnavailableMessage(payBalance.reason, usdcBalance),
      );
      return;
    }
    const max = maxPayAtomic({
      payToken,
      balanceAtomic: payBalance.atomic,
    });
    if (max <= 0n) {
      setFormError(copy.swap.notEnoughForSwap(payToken.symbol));
      return;
    }
    setAmount(formatAtomicAmount(max.toString(), payToken.decimals));
    setFormError(null);
  }

  function onAmountChange(text: string) {
    alertAutoReview.current = false;
    // Abort/invalidate before debounce so a stale ready quote cannot enter Review.
    clearQuoteStateSync();
    noteTextInputActivity(text, noteUserActivity, setAmount);
  }

  function onKeypadKey(key: SwapKeypadKeyId) {
    const next = applySwapKeypadKey(amount, key);
    if (next === amount) return;
    onAmountChange(next);
  }

  function showFail(message: string) {
    setFail(resolveSwapFailPresentation(message));
    setSheetDismissed(false);
    setStep('failed');
  }

  function openCapRefusal(refusal: SleeveCapRefusal) {
    setCapRefusal(refusal);
    setFail({
      kind: 'blocked',
      title: refusal.heading,
      body: refusal.body || refusal.heading,
    });
    setFormError(null);
    setSheetDismissed(false);
    setStep('failed');
  }

  function onReview() {
    setFormError(null);
    if (
      !cluster ||
      !payToken ||
      !receiveToken ||
      !swapMayQuoteOnNetwork(networkGate)
    ) {
      setFormError(
        networkGate.state === 'declined'
          ? networkGate.body
          : copy.swap.errorQuote,
      );
      return;
    }
    if (!form.ok) {
      if (form.message && composeShowsFailFrame(form.message)) {
        showFail(form.message);
      } else {
        setFormError(form.message || copy.swap.enterAmount);
      }
      return;
    }
    if (quoteStatus !== 'ready' || !order || !quoteDigest) {
      if (capRefusal) {
        openCapRefusal(capRefusal);
        return;
      }
      setFormError(quoteError ?? copy.swap.errorQuote);
      return;
    }
    try {
      const request = {
        inputMint: payToken.mint,
        outputMint: receiveToken.mint,
        amount: form.atomicIn,
      };
      assertReadyQuoteMatchesReviewRequest({
        order,
        quoteDigest,
        generation: readyQuoteGenerationRef.current,
        gate: quoteGateRef.current,
        request,
      });
      const frozen = freezeSwapReviewIntent({
        order,
        quoteDigest,
        paySymbol: payToken.symbol,
        receiveSymbol: receiveToken.symbol,
        generation: readyQuoteGenerationRef.current,
        request,
        outputTokenFacts: signingOutputTokenFacts,
        inputTokenFacts: signingInputTokenFactsRef.current,
        cluster,
      });
      // Mark confirm-valid synchronously with freeze — mutations clear this first.
      confirmValidRef.current = true;
      setFrozenIntent(frozen);
      setReviewedRugcheck(liveRugcheck);
      setDangerAcknowledged(false);
      setSheetDismissed(false);
      setStep('review');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      trackEvent('swap_review_viewed', { quote_id: order.requestId });
    } catch (error) {
      clearQuoteStateSync();
      setFrozenIntent(null);
      showFail(error instanceof Error ? error.message : copy.swap.errorQuote);
    }
  }

  // A new quote re-enters the existing Review freeze, never the Sign path.
  const reviewActionsRef = useRef({ onReview, showFail });
  reviewActionsRef.current = { onReview, showFail };
  useEffect(() => {
    if (!alertAutoReview.current || !alertTapForLifetime) return;
    if (liveSessionCell.current !== alertTapForLifetime.owner || moneySignerGateCells.liveLockCell.current) { alertAutoReview.current = false; return; }
    if (quoteStatus === 'error') { alertAutoReview.current = false; reviewActionsRef.current.showFail(quoteError ?? copy.swap.errorQuote); return; }
    if (quoteStatus !== 'ready' || !alertQuoteRequest.current || alertQuoteRequest.current.startedAtMs < alertTapForLifetime.tappedAtMs) return;
    alertAutoReview.current = false;
    setAlertArrivalTrade(alertQuoteRequest.current.trade);
    reviewActionsRef.current.onReview();
  }, [quoteStatus, quoteError]);
  useEffect(() => {
    if (reviewQuoteRequested && quoteStatus === 'ready') {
      setReviewQuoteRequested(false);
      reviewActionsRef.current.onReview();
    } else if (reviewQuoteRequested && quoteStatus === 'error') {
      setReviewQuoteRequested(false);
      if (capRefusal) openCapRefusal(capRefusal);
      else reviewActionsRef.current.showFail(quoteError ?? copy.swap.errorQuote);
    }
  }, [reviewQuoteRequested, quoteStatus, quoteError, capRefusal]);

  async function onConfirmSwap() {
    if (!order || !session?.address || !quoteDigest || !frozenIntent) return;
    if (confirmationPendingRef.current) return;
    if (!payToken || !receiveToken || !swapMayQuoteOnNetwork(networkGate)) {
      showFail(copy.swap.networkUnknown);
      return;
    }
    // Re-bound under non-null names for the same reason `confirmedOrder` and
    // friends are below: TypeScript does not carry a guard's narrowing across
    // the `proceedWithConfirmedSwap` function boundary.
    const confirmPayToken: SwapToken = payToken;
    const confirmReceiveToken: SwapToken = receiveToken;
    // Synchronous epoch check before any step-up / sign work.
    if (!confirmValidRef.current) {
      showFail('Quote changed since review. Go back and quote again.');
      return;
    }
    const appliedQuote = quoteAppliedAtRef.current;
    const quoteAgeEventAtConfirm =
      appliedQuote?.requestId === order.requestId
        ? quoteAgeAtSigningEvent({
            quoteAppliedAtMs: appliedQuote.atMs,
            nowMs: Date.now(),
          })
        : null;
    // Wait for the mount load if it is still in flight, so a fast confirm is
    // not refused on the pre-load `false` below.
    //
    // ⚠️ This await is safe *only* because what follows reads a ref, not state.
    // `readJurisdictionGateInputs` exists precisely because awaiting here and
    // then reading React state was the fail-open — the closure never refreshes.
    // `disclosuresReadyRef.current` is a fresh read, so it sees the load's
    // value. Neither branch of the load rejects (`loadJurisdictionGateInputs`
    // and `resolveDisclosures` both swallow their own failures), so this await
    // cannot throw past the guards below.
    if (configLoadRef.current) {
      await configLoadRef.current;
    }

    const confirmedOrder = order;
    const confirmedSession = session;
    const confirmedQuoteDigest = quoteDigest;
    const confirmedFrozenIntent = frozenIntent;
    async function proceedWithConfirmedSwap() {
      const order = confirmedOrder;
      const session = confirmedSession;
      const quoteDigest = confirmedQuoteDigest;
      const frozenIntent = confirmedFrozenIntent;
      confirmationPendingRef.current = true;
      setBusy(true);
      setFormError(null);
      swapStartedAt.current = Date.now();
      trackEvent('swap_confirmed', { quote_id: frozenIntent.requestId });
      let signerClear: (() => void) | undefined;
      try {
        const currentRequest = {
          inputMint: confirmPayToken.mint,
          outputMint: confirmReceiveToken.mint,
          amount: form.ok ? form.atomicIn : '',
        };
        // Confirm executes only from a frozen validated clone (recomputed digest),
        // bound to the current quote generation + exact current request.
        const confirmArgs = {
          frozen: frozenIntent,
          order,
          quoteDigest,
          paySymbol: confirmPayToken.symbol,
          receiveSymbol: confirmReceiveToken.symbol,
          generation: readyQuoteGenerationRef.current,
          gate: quoteGateRef.current,
          request: currentRequest,
          confirmValid: confirmValidRef,
        };
        const liveConfirmArgs = () => {
          const liveCluster = clusterRef.current;
          if (!liveCluster) {
            throw new SwapApiError(
              'swap_quote_mismatch',
              copy.swap.networkUnknown,
            );
          }
          return {
            ...confirmArgs,
            outputTokenFacts: signingOutputTokenFactsRef.current,
            inputTokenFacts: signingInputTokenFactsRef.current,
            cluster: liveCluster,
          };
        };
        let executeOrder = assertConfirmMatchesFrozenIntent(liveConfirmArgs());
        if (!confirmValidRef.current) {
          throw new SwapApiError(
            'swap_quote_mismatch',
            'Quote changed since review. Go back and quote again.',
          );
        }
        const notionalSol = (() => {
          try {
            if (executeOrder.inputMint === SOL_MINT) {
              return Number(BigInt(executeOrder.inAmount)) / 1e9;
            }
            if (executeOrder.outputMint === SOL_MINT) {
              return Number(BigInt(executeOrder.outAmount)) / 1e9;
            }
            return null;
          } catch {
            return null;
          }
        })();
        const prepared = await stepUp.prepareStepUp({
          session,
          notionalSol,
          surface: 'swap',
        });
        // Reassert full frozen generation/request after async prepare.
        executeOrder = reassertFrozenConfirmAuthority({
          ...liveConfirmArgs(),
          generation: readyQuoteGenerationRef.current,
        });
        const assertConfirmAuthorityLive = () => {
          executeOrder = reassertFrozenConfirmAuthority({
            ...liveConfirmArgs(),
            generation: readyQuoteGenerationRef.current,
          });
        };
        // Step-up context is mandatory at signer creation (never an ungated money signer).
        // Frozen confirm authority is checked before materialization and after awaits.
        const signer = await getActiveSigner({
          session,
          notionalSol,
          surface: 'swap',
          verifyPrivyMfa:
            prepared.needed && 'verifyPrivyMfa' in prepared
              ? prepared.verifyPrivyMfa
              : undefined,
          policy: prepared.policy ?? stepUp.policy ?? undefined,
          assertConfirmAuthorityLive,
        });
        signerClear = signer.clear;
        // Acceptance is complete. Morph Review into Sending while the network lands.
        setStep('sending');
        confirmationPendingRef.current = false;
        setSheetDismissed(false);
        // Reassert full frozen authority immediately before submit.
        assertConfirmAuthorityLive();
        const result = await submitSwap({
          signer,
          order: executeOrder,
          session,
          quoteDigest: frozenIntent.quoteDigest,
          reviewedOutputTokenFacts: frozenIntent.reviewedOutputTokenFacts,
          reviewedInputTokenFacts: frozenIntent.reviewedInputTokenFacts,
          // Same live read, and the same refusal on `null`: `liveConfirmArgs`
          // has already thrown by here if the ref went empty.
          cluster: liveConfirmArgs().cluster,
          verifyPrivyMfa:
            prepared.needed && 'verifyPrivyMfa' in prepared
              ? prepared.verifyPrivyMfa
              : undefined,
          cells: moneySignerGateCells,
          // Propagate through submitSwap await boundaries (RPC/lookup/sign).
          assertConfirmAuthorityLive,
          onBeforeSafetyAssertion: quoteAgeEventAtConfirm
            ? () => {
                trackEvent(
                  quoteAgeEventAtConfirm.name,
                  quoteAgeEventAtConfirm.properties,
                );
              }
            : undefined,
        });
        // #7: submitSwap only resolves after independent RPC confirmation.
        // Refuse success UI / swap_succeeded without on-chain confirmationStatus.
        if (
          result.confirmationStatus !== 'confirmed' &&
          result.confirmationStatus !== 'finalized'
        ) {
          throw new Error(
            'Swap was submitted but not confirmed on-chain yet. Check Activity before retrying.',
          );
        }
        if (routineFireForLifetime) {
          try {
            const approvingStepUpSessionId = getActiveStepUpSessionKey();
            if (
              routinesEnabledRef.current &&
              approvingStepUpSessionId &&
              confirmedSwapMatchesRoutineFire(routineFireForLifetime, {
                walletAddress: session.address,
                inputMint: executeOrder.inputMint,
              })
            ) {
              await recordRoutineFire({
                enabled: true,
                routineId: routineFireForLifetime.routineId,
                walletAddress: session.address,
                approvingStepUpSessionId,
                executedSwapSignature: result.signature,
                currentWalletAddress: () =>
                  liveSessionCell.current?.address ?? null,
                // Reuse the already-acquired signer from the signed swap. No
                // key, transaction or signature is persisted between calls.
                signMessage: (message) => signer.signMessage(message),
              });
            }
          } catch {
            // The swap is already confirmed. Never relabel it failed or invite
            // a duplicate; report only the routine bookkeeping gap.
            setRoutineRecordError(
              "Swap confirmed. Routine status couldn't be updated.",
            );
          } finally {
            clearRoutineFireForSwap();
          }
        }
        trackEvent('swap_signed', { quote_id: executeOrder.requestId });
        trackEvent('swap_submitted', { signature: result.signature });
        setSignature(result.signature);
        setSheetDismissed(false);
        setStep('success');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // The Home card that opened this Review now reads `Signed`.
        // After the person's acceptance and the confirmed submit, never before.
        if (routeParams.askLiveCard) {
          markLiveCardSignedInStore(routeParams.askLiveCard, {
            payText: formatGroupedDisplayAmount(
              formatAtomicAmount(frozenIntent.inAmount, confirmPayToken.decimals),
            ),
            receiveText: formatGroupedDisplayAmount(
              formatAtomicAmount(frozenIntent.outAmount, confirmReceiveToken.decimals),
            ),
            receiveSymbol: frozenIntent.receiveSymbol,
          });
        }
        trackEvent('swap_succeeded', {
          signature: result.signature,
          confirmation_status: result.confirmationStatus,
          in_amount: executeOrder.inAmount,
          out_amount: executeOrder.outAmount,
          fee_bps: executeOrder.corsoFeeBps,
          duration_ms: swapStartedAt.current
            ? Date.now() - swapStartedAt.current
            : undefined,
        });
        try {
          void saveConfirmedReceipt(result, receiptCaptureRef.current).catch(() => {
            warnReceiptSnapshotFailure();
          });
        } catch {
          warnReceiptSnapshotFailure();
        }
      } catch (error) {
        // Landing was submitted but unproven. Corso must NOT call this a failure:
        // a user told "failed" who re-swaps has paid twice. Show the signature so
        // they can check, and record it as unconfirmed, not failed.
        if (error instanceof SwapLandUncertainError) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setFormError(
            error.signature
              ? copy.swap.unconfirmedSignature(error.message, error.signature)
              : error.message,
          );
          trackEvent('swap_submit_unconfirmed', {
            stage: 'confirm',
            error_code: error.code,
          });
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showFail(
          error instanceof Error ? error.message : copy.swap.errorGeneric,
        );
        trackEvent('swap_failed', {
          stage: 'confirm',
          error_code:
            error instanceof SwapApiError
              ? error.code
              : error instanceof Error
                ? 'execute_or_confirm_failed'
                : 'unknown',
        });
        reportHandledFailure(error, {
          feature: 'swap',
          stage: 'confirm',
          code: classifySwapFailure(error),
        });
      } finally {
        signerClear?.();
        confirmationPendingRef.current = false;
        setBusy(false);
      }
    }

    const gated = await runGatedSwapConfirm({
      disclosuresReady: disclosuresReadyRef.current,
      readGateInputs: () =>
        readJurisdictionGateInputs({
          settled: gateInputsRef.current,
          inFlight: configLoadRef.current,
          load: loadJurisdictionGateInputs,
        }),
      asset: {
        mint: frozenIntent.outputMint,
        symbol: frozenIntent.receiveSymbol,
        // `name` lives on the Jupiter slice and only when that slice resolved.
        // Reading it unguarded is what typecheck caught.
        name:
          receiveTokenFacts.facts?.sources.jupiter.status === 'ok'
            ? receiveTokenFacts.facts.sources.jupiter.fields.name
            : null,
      },
      dispose: {
        mint: frozenIntent.inputMint,
        symbol: frozenIntent.paySymbol,
        name:
          payTokenFacts.facts?.sources.jupiter.status === 'ok'
            ? payTokenFacts.facts.sources.jupiter.fields.name
            : null,
      },
      copy: {
        accessDisclosures: copy.swap.accessDisclosures,
        accessUnavailable: copy.swap.accessUnavailable,
        accessJurisdiction: copy.swap.accessJurisdiction,
        accessAsset: copy.swap.accessAsset,
      },
      proceed: proceedWithConfirmedSwap,
    });
    if (gated.status === 'refused') {
      showFail(gated.errorMessage);
      return;
    }
  }

  if (moneySignerGateStatus === 'step_up_required') {
    return (
      <SwapGate
        testID="swap-gate-step-up"
        title={copy.stepup.reauthenticationTitle}
        body={copy.stepup.unavailable}
        doors={[
          { label: copy.stepup.retry, onPress: retryMoneySignerGate },
          GATE_BACK,
        ]}
      />
    );
  }

  if (!swapEnabled) {
    return (
      <ReviewShellCanvas>
        <ReviewSign model={presentReviewSign({ intent:null, pay:payToken ?? {mint:'',symbol:'',decimals:0}, receive:receiveToken ?? {mint:'',symbol:'',decimals:0}, nowMs:reviewNowMs, appliedAtMs:null, phase:'review', enabled:false, busy:false, confirmValid:false, canConfirm:false, riskLeg:'receive' })} onBack={() => goBackOr(BACK_FALLBACK.shell)} onWait={() => goBackOr(BACK_FALLBACK.shell)} />
      </ReviewShellCanvas>
    );
  }

  if (!session?.address) {
    return (
      <SwapGate
        testID="swap-gate-missing-address"
        body={copy.swap.missingAddress}
        doors={[GATE_BACK]}
      />
    );
  }

  if (networkGate.state === 'declined') {
    return (
      <SwapGate
        testID="swap-gate-network-declined"
        title={networkGate.title}
        body={networkGate.body}
        doors={[GATE_BACK]}
      />
    );
  }

  if (networkGate.state !== 'ready' || !payToken || !receiveToken) {
    return (
      <SwapGate
        testID="swap-gate-network-resolving"
        busy
        doors={[GATE_BACK]}
      />
    );
  }

  const activePickerMint =
    pickerTarget === 'receive' ? receiveToken.mint : payToken.mint;

  const balanceLabel = resolveSwapPayBalanceLabel({
    paySymbol: payToken.symbol,
    payDecimals: payToken.decimals,
    payBalance,
    usdcStatus: usdcBalance.status,
    usdcError: usdcBalance.error,
  });
  const activeAskPrefill = cluster
    ? resolveAskPrefill({
        params: {
          fromSymbol: routeParams.askFromSymbol,
          toSymbol: routeParams.askToSymbol,
          toMint: routeParams.askToMint,
          toDecimals: routeParams.askToDecimals,
          inAmountAtomic: routeParams.askInAmountAtomic,
          amountGuard: routeParams.askAmountGuard,
          amountless: routeParams.askAmountless,
        },
        cluster,
        sourceText: askSourceTextForLifetime,
      })
    : null;
  const askPrefillNotice =
    activeAskPrefill?.paySymbol === paySymbol && activeAskPrefill.amount === amount
      ? activeAskPrefill.notice
      : undefined;
  const askSourceText = activeAskPrefill?.sourceText ?? null;

  const receiveDisplay = resolveSwapReceiveDisplay({
    quoteStatus,
    outAmount: order?.outAmount,
    receiveDecimals: receiveToken.decimals,
  });
  const receiveTone = resolveSwapReceiveTone({
    quoteStatus,
    outAmount: order?.outAmount,
  });

  const priceLabel =
    quoteStatus === 'ready' && order
      ? priceLine(order, payToken, receiveToken)
      : copy.home.balancePlaceholder;

  const composeDisclosureRows = buildComposerDisclosureRows({
    route:
      quoteStatus === 'loading' && !order?.router
        ? '…'
        : resolveSwapRouteDisplayName(order?.router ?? null),
    price: priceLabel,
    corsoFee: feeRowValue(
      resolveSwapFeeDisplay(order, feeStatus, cluster),
    ),
    priceImpact: formatSwapPriceImpactValue(order?.priceImpactPct),
    slippage:
      order?.slippageBps != null
        ? feeBpsToPercentLabel(order.slippageBps)
        : copy.swap.slippageAuto,
  });

  const ctaLabel = !form.ok
    ? form.cta
    : quoteStatus === 'loading'
      ? copy.swap.quoting
      : quoteStatus === 'error'
        ? copy.swap.review
        : copy.swap.review;

  const requestedPayAtomic = amountToAtomic(amount, payToken.decimals);
  const reviewCashShortfall = payBalance.known && requestedPayAtomic && cluster && payToken.mint === usdcMintForCluster(cluster) && BigInt(requestedPayAtomic) > payBalance.atomic
    ? `${formatAtomicAmount((BigInt(requestedPayAtomic) - payBalance.atomic).toString(), payToken.decimals)} ${payToken.symbol}` : null;
  const ctaDisabled = !form.ok || quoteStatus !== 'ready' || !order;

  const ctaVisibleLabel = ctaDisabled && !form.ok ? ctaLabel : copy.v1.review;

  const tradeHeadline = amount.trim()
    ? copy.swap.headline(amount, payToken.symbol, receiveToken.symbol)
    : copy.swap.headlinePair(payToken.symbol, receiveToken.symbol);

  const reviewPhase = reviewSheetPhaseFromStep(step);
  const reviewChrome = reviewPhase
    ? resolveReviewSheetPresentation(reviewPhase, fail?.title)
    : null;
  const reviewedDangerLine = resolveRugcheckDangerLinePresentation(
    reviewedRugcheck,
  );
  const reviewConfirmationLocked = isReviewConfirmationLocked(
    reviewPhase,
    busy,
  );
  const reviewAccountRentRow = frozenIntent
    ? resolveSwapAccountRentRow(frozenIntent.accountRentLamports) : null;

  // Resolve by mint, never by symbol: `tokenForSymbol` only knows SOL and USDC,
  // and a searched mint run through it would silently format with USDC's
  // decimals. Matching the frozen mint is the only correct source.
  const reviewPayToken = tokenForMint(frozenIntent?.inputMint, [
    payToken,
    receiveToken,
  ]) ?? payToken;
  const reviewReceiveToken = tokenForMint(frozenIntent?.outputMint, [
    payToken,
    receiveToken,
  ]) ?? receiveToken;
  const reviewSubject =
    reviewPayToken && reviewReceiveToken
      ? selectSwapRiskLeg({
          leg: riskLeg,
          pay: reviewPayToken,
          receive: reviewReceiveToken,
        })
      : null;
  const reviewModel = presentReviewSign({
    intent: frozenIntent, pay: reviewPayToken, receive: reviewReceiveToken,
    nowMs: reviewNowMs,
    appliedAtMs: quoteAppliedAtRef.current?.requestId === frozenIntent?.requestId ? quoteAppliedAtRef.current?.atMs ?? null : null,
    phase: step === 'sending' ? 'sending' : step === 'failed' ? 'failed' : 'review',
    enabled: swapEnabled, busy: busy || signControlBusy, confirmValid: confirmValidRef.current,
    canConfirm: rugcheckAllowsConfirm(reviewedRugcheck, dangerAcknowledged),
    riskLeg, failure: step === 'sending' ? formError : fail?.body, cashShortfall: reviewCashShortfall,
    failReason: step === 'failed' ? fail : null,
    cautionOverride:
      step === 'failed' && capRefusal
        ? { heading: capRefusal.heading, body: capRefusal.body }
        : null,
    bookEffect: frozenIntent ? presentReviewBookEffect({intent:frozenIntent,payToken:reviewPayToken,receiveToken:reviewReceiveToken,fiat,nowMs:reviewNowMs,address:session.address,cluster}) : null,
    factsLine: presentReviewFactsLine({
      status: selectSwapRiskLeg({ leg: riskLeg, pay: payTokenFacts, receive: receiveTokenFacts }).status,
      facts: selectSwapRiskLeg({ leg: riskLeg, pay: payTokenFacts, receive: receiveTokenFacts }).facts,
      error: selectSwapRiskLeg({ leg: riskLeg, pay: payTokenFacts, receive: receiveTokenFacts }).error,
      nowMs: reviewNowMs,
    }),
    chartMint: selectSwapRiskLeg({ leg: riskLeg, pay: reviewPayToken.mint, receive: reviewReceiveToken.mint }),
    chartPriceUsd: chartPrices.quotes[selectSwapRiskLeg({ leg: riskLeg, pay: reviewPayToken.mint, receive: reviewReceiveToken.mint })]?.price ?? null,
    afterSale: reviewAfterSale({
      riskLeg,
      heldAtomic: reviewHeldAtomic(payBalance),
      payMint: reviewPayToken.mint,
      paySymbol: reviewPayToken.symbol,
      payDecimals: reviewPayToken.decimals,
      receiveSymbol: reviewReceiveToken.symbol,
      receiveDecimals: reviewReceiveToken.decimals,
      inAmount: frozenIntent?.inAmount ?? null,
      outAmount: frozenIntent?.outAmount ?? null,
      networkFeeLamports: frozenIntent?.networkFeeLamports,
      accountRentLamports: frozenIntent?.accountRentLamports,
    }),
  });
  function requoteReview() {
    if (confirmationPendingRef.current || busy || step === 'sending') return;
    setFail(null);
    setReviewQuoteRequested(true);
    setStep('review');
    void refreshQuote();
  }
  const receiveFullDisplay = quoteStatus === 'ready' && order
    ? formatAtomicAmount(order.outAmount, receiveToken.decimals)
    : receiveDisplay;
  const signedReceipt =
    frozenIntent && signature
      ? resolveSignedReceipt({
          outAmount: formatGroupedDisplayAmount(
            formatAtomicAmount(
              frozenIntent.outAmount,
              reviewReceiveToken.decimals,
            ),
          ),
          receiveSymbol: frozenIntent.receiveSymbol,
          payOut: `${formatGroupedDisplayAmount(
            formatAtomicAmount(frozenIntent.inAmount, reviewPayToken.decimals),
          )} ${frozenIntent.paySymbol}`,
          feeLabel: feeRowValue(
            resolveSwapFeeDisplay(frozenIntent.corsoFeeBps, feeStatus),
          ),
        })
      : null;

  function closeReviewSheet() {
    if (signPressPendingRef.current || confirmationPendingRef.current) return;
    if (step === 'sending') {
      setSheetDismissed(true);
      return;
    }
    if (step === 'success') {
      router.replace('/(app)');
      return;
    }
    confirmValidRef.current = false;
    setReviewQuoteRequested(false);
    setFail(null);
    setSheetDismissed(false);
    setStep('compose');
    setFormError(null);
  }

  const quoteLive = quoteStatus === 'ready' && order != null;
  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.headerRow}>
        <ScreenHeader
          family="desk"
          title={copy.swap.headlinePair(payToken.symbol, receiveToken.symbol)}
          titleAccessibilityLabel={tradeHeadline}
          onBack={() => goBackOr(BACK_FALLBACK.shell)}
          backAccessibilityLabel={copy.v1.back}
          // Status: `Quote live` only while a real order is on screen.
          right={quoteLive ? (
            <View style={styles.live} accessible accessibilityLabel={copy.live.quoteLive}>
              <View style={styles.liveDot} />
              <CorsoText style={styles.liveLabel}>{copy.live.quoteLive}</CorsoText>
            </View>
          ) : undefined}
        />
      </View>
      <View style={styles.body}>
      {/*
        The scroller and its edge fades are one box; the pinned keypad band is
        the sibling below. The fade is `position: absolute` over its wrapper, so
        a wrapper that also held the pad would draw a gradient across the keys.
      */}
      <View style={styles.scrollWrap}>
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[styles.pad, styles.composePad]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {askSourceText ? (
          <View style={styles.sourceSentenceSlot}>
            <CorsoText
              style={styles.sourceSentence}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {askSourceText}
            </CorsoText>
          </View>
        ) : null}
        <View style={[styles.pane, styles.legPane, trayPaint]}>
          <TokenCard
            label={copy.swap.youPay}
            amount={amount}
            editable
            onChangeAmount={onAmountChange}
            symbol={payToken.symbol}
            mint={payToken.mint}
            balanceLabel={balanceLabel}
            notice={askPrefillNotice}
            onMax={onMax}
            onPressToken={() => setPickerTarget('pay')}
          />
        </View>

        <View style={styles.flipRow}>
          <Pressable
            style={[styles.flip, trayPaint, !canFlip && styles.controlDisabled]}
            onPress={onFlip}
            disabled={!canFlip}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canFlip }}
            accessibilityLabel={copy.swap.flipTokens}
          >
            <CorsoText style={styles.flipLabel}>⇅</CorsoText>
          </Pressable>
        </View>

        <View style={[styles.pane, styles.legPane, trayPaint]}>
          <TokenCard
            label={copy.swap.youReceive}
            amount={receiveDisplay}
            amountTone={receiveTone}
            editable={false}
            fullAmount={receiveFullDisplay}
            symbol={receiveToken.symbol}
            mint={receiveToken.mint}
            onPressToken={() => setPickerTarget('receive')}
          />
        </View>

        <View style={[styles.meta, trayPaint]}>
          {composeDisclosureRows.map((row, index) => (
            <Row
              key={row.key}
              label={row.label}
              value={row.value}
              compact
              divider={index > 0}
            />
          ))}
          <Pressable
            onPress={() => setChartOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: chartOpen }}
            accessibilityLabel={copy.swap.chart}
            style={styles.chartToggle}
          >
            <CorsoText style={styles.chartToggleLabel}>{copy.swap.chart}</CorsoText>
          </Pressable>
        </View>
        {/*
          Not the page: the chart opens on request, and when it does it gets its
          own card-weight pane — the same "little terminal" the token-detail
          screen draws (`writeup-trading.md` screen 1), never a bare plot
          floating on the canvas.
        */}
        {chartOpen ? (
          <View style={[styles.pane, styles.chartPane, trayPaint]}>
            <PriceChart
              mint={receiveToken?.mint ?? null}
              compact
              currentPriceUsd={
                receiveToken
                  ? chartPrices.quotes[receiveToken.mint]?.price ?? null
                  : null
              }
            />
            <ChartReadHeadline
              mode="live"
              mint={receiveToken?.mint ?? null}
            />
          </View>
        ) : null}

        {liveRugcheck.ambientDescription ? (
          <CorsoText style={styles.riskLine}>
            {liveRugcheck.ambientDescription}
          </CorsoText>
        ) : null}

        {quoteError ? <CorsoText style={styles.error}>{quoteError}</CorsoText> : null}
        {formError ? <CorsoText style={styles.error}>{formError}</CorsoText> : null}
      </ScrollView>
      <ScrollEdgeFade top={0} bottom={SCROLL_FADE_BOTTOM} color={ethena.groundStops[0][1]} testID="swap-compose-edge-fade" />
      </View>

      <View style={styles.footer}>
        <SwapKeypad onKey={onKeypadKey} testID="swap-keypad" />
        <PrimaryCTA
          tone="transactional"
          label={ctaVisibleLabel}
          onPress={() => { if (reviewCashShortfall) { setFrozenIntent(null); setStep('review'); setSheetDismissed(false); } else onReview(); }}
          disabled={ctaDisabled && !reviewCashShortfall}
          busy={quoteStatus === 'loading'}
          accessibility={{ accessibilityLabel: ctaVisibleLabel }}
          style={styles.reviewCta}
        />
      </View>
      </View>
      <SwapTokenPickerSheet
        visible={pickerTarget != null}
        tokens={pickerTokens}
        selectedMint={activePickerMint}
        allowSearch={pickerTarget != null}
        acquireRows={pickerTarget === 'receive'}
        onSelect={onPickToken}
        onClose={() => setPickerTarget(null)}
      />
      <BottomSheet
        kind="signing"
        title={reviewChrome?.title ?? copy.v1.review}
        visible={reviewChrome?.showReceipt === true && !sheetDismissed}
        dismissible={reviewChrome?.dismissible ?? true}
        signing={reviewConfirmationLocked}
        onRequestClose={closeReviewSheet}

      >
        {reviewChrome?.showFail && fail ? (
          <>
            <CorsoText style={styles.subtitle}>{fail.body}</CorsoText>
            <GlassPill label={copy.v1.done} onPress={closeReviewSheet} />
          </>
        ) : null}

        {reviewChrome?.showReceipt ? (
          <>
            <Animated.View
              style={[styles.resultMarkMoment, { opacity: successMarkOpacity }]}
            >
              <ResultMark kind="success" testID="swap-success-result-mark" />
            </Animated.View>
            {signedReceipt ? (
              <>
                <CorsoText style={styles.tradeHeadline}>{signedReceipt.headline}</CorsoText>
                {askSourceText ? (
                  <CorsoText
                    style={styles.receiptSentence}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {askSourceText}
                  </CorsoText>
                ) : null}
                <Row label={copy.v1.whatMoved} value={signedReceipt.moved} />
                <Row label={copy.v1.fee} value={signedReceipt.fee} />
              </>
            ) : (
              <CorsoText style={styles.subtitle}>{copy.swap.successBody}</CorsoText>
            )}
            {signature ? (
              <>
                <CorsoText style={styles.mono}>{truncateAddress(signature)}</CorsoText>
                <GlassPill
                  label={copy.v1.seeOnSolscan}
                  onPress={() => {
                    void WebBrowser.openBrowserAsync(
                      // The explorer link is the *label* use of the cluster,
                      // and it is reached only from a confirmed swap, so the
                      // gate is `ready` here by construction.
                      solscanSignatureUrl(signature, networkGate.cluster),
                    );
                  }}
                />
              </>
            ) : null}
            {routineRecordError ? (
              <CorsoText style={styles.error}>{routineRecordError}</CorsoText>
            ) : null}
            <GlassPill label={copy.v1.done} onPress={closeReviewSheet} />
          </>
        ) : null}

        {/* Keep the final warning/qualifier scrollable clear of the body fade. */}
        <View
          style={{ height: SCROLL_FADE_BOTTOM }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </BottomSheet>
      <Modal statusBarTranslucent navigationBarTranslucent visible={(step === 'review' || step === 'sending' || step === 'failed') && !sheetDismissed} onRequestClose={closeReviewSheet} animationType="slide">
        <ReviewShellCanvas>
          <ReviewSign
            model={reviewModel}
            floorQualifier={copy.live.reviewFloor}
            onBack={closeReviewSheet}
            onWait={() => {
              if (signPressPendingRef.current || confirmationPendingRef.current || step === 'sending') return;
              const waitEpoch = waitReviewEpochRef.current.epoch + 1;
              waitReviewEpochRef.current = { open: false, epoch: waitEpoch };
              const token = riskLeg === 'pay' ? reviewPayToken : reviewReceiveToken;
              closeReviewSheet();
              void import('@/src/features/priceAlerts/waitEntry').then(({ openWaitAlert }) => openWaitAlert({
                owner: session, mint: token.mint, symbol: token.symbol, cluster: cluster ?? 'devnet',
                preset: { payMint: reviewPayToken.mint, paySymbol: reviewPayToken.symbol, payDecimals: reviewPayToken.decimals, receiveMint: reviewReceiveToken.mint, receiveSymbol: reviewReceiveToken.symbol, receiveDecimals: reviewReceiveToken.decimals, inAmountAtomic: frozenIntent?.inAmount ?? null, side: riskLeg === 'pay' ? 'sell' : 'buy' },
              }, () => !waitReviewEpochRef.current.open && waitReviewEpochRef.current.epoch === waitEpoch && liveSessionCell.current === session && !moneySignerGateCells.liveLockCell.current && !signPressPendingRef.current && !confirmationPendingRef.current)).catch(() => {});
            }}
            onRequote={requoteReview}
            onRetry={requoteReview}
            onAddCash={() => openBookAddCash(router)}
            onExplain={() => setReviewExplainOpen(true)}
            capLinks={
              step === 'failed' && capRefusal
                ? {
                    seeHoldings: capRefusal.seeHoldings,
                    raiseCap: capRefusal.raiseCap,
                  }
                : null
            }
            onSeeHoldings={openHoldingsFromCapRefusal}
            onRaiseCap={openCapSheetFromReview}
            chartSurface={
              reviewModel.chart ? (
                <>
                  <PriceChart
                    mint={reviewModel.chart.mint}
                    compact
                    currentPriceUsd={reviewModel.chart.priceUsd}
                    testID="ethena-review-chart-surface"
                  />
                </>
              ) : null
            }
            contextExtra={<>
              {alertTapForLifetime?.prefill.rule && frozenIntent && alertArrivalTrade === alertTradeKey(frozenIntent.inputMint, frozenIntent.outputMint, frozenIntent.inAmount) ? <>
              <CorsoText testID="alert-arrival-line" style={styles.muted}>{alertLine('arrival', alertTapForLifetime.prefill.rule.symbol, alertTapForLifetime.prefill.rule.direction, alertTapForLifetime.prefill.rule.thresholdPrice)}</CorsoText>
              {alertTapForLifetime.spot && alertPriceRefusal(alertTapForLifetime.prefill.rule.direction, alertTapForLifetime.prefill.rule.thresholdPrice, alertTapForLifetime.spot, reviewNowMs) === null ? <CorsoText testID="alert-moved-line" style={styles.muted}>{alertMovedLine(alertTapForLifetime.prefill.rule.symbol, alertTapForLifetime.spot.price)}</CorsoText> : null}
              </> : null}
              <ReviewWatchlistMount />
            </>}
            onSign={() => {
              if (!frozenIntent || frozenIntent.feeDropped || !confirmValidRef.current || signPressPendingRef.current) return;
              signPressPendingRef.current = true;
              setSignControlBusy(true);
              try {
                receiptCaptureRef.current = captureReceiptReview({
                  intent: frozenIntent, pay: reviewPayToken, receive: reviewReceiveToken,
                  owner: session.address, cluster, side: riskLeg === 'pay' ? 'sell' : 'buy',
                  bookEffect: freezeSeenReview(reviewModel.bag, reviewModel.afterSale),
                  appliedAtMs: quoteAppliedAtRef.current?.requestId === frozenIntent.requestId ? quoteAppliedAtRef.current.atMs : null,
                  nowMs: Date.now(),
                  details: readLaunchDockBuildFlag()
                    ? { whyBlock: reviewWhyBlockRef.current, minReceivedAtomic: frozenIntent.otherAmountThreshold, maxSlippageBps: frozenIntent.slippageBps }
                    : null,
                });
              } catch {
                receiptCaptureRef.current = null;
                warnReceiptSnapshotFailure();
              }
              void onConfirmSwap().finally(() => {
                signPressPendingRef.current = false;
                setSignControlBusy(false);
              });
            }}
          >
            {readLaunchDockBuildFlag() && reviewPayToken && reviewReceiveToken ? (
              <ReviewWhySlot
                mint={riskLeg === 'pay' ? reviewPayToken.mint : reviewReceiveToken.mint}
                onBlock={onReviewWhyBlock}
              />
            ) : null}
            <ReviewFearGreedSlot />
            <ReviewFredSlot />
            <ReviewFundingOiSlot
              payMint={reviewPayToken.mint}
              receiveMint={reviewReceiveToken.mint}
            />
            <ReviewFilingsSlot
              mint={
                reviewPayToken && reviewReceiveToken
                  ? selectFilingsMint({
                      payMint: reviewPayToken.mint,
                      receiveMint: reviewReceiveToken.mint,
                      riskLeg,
                    })
                  : null
              }
            />
            <ReviewHeadlinesSlot />
            {askSourceText ? <CorsoText style={[reviewShellText.statement, reviewShellText.inset]}>{askSourceText}</CorsoText> : null}
            {frozenIntent ? <View style={reviewShellText.block}>
              {reviewAccountRentRow ? <CorsoText>{copy.swap.rentRecovery}</CorsoText> : null}
              <Pressable onPress={() => setFeeExplainOpen(open => !open)} accessibilityRole="button"><CorsoText>{feeExplainOpen ? copy.swap.feeWhatsThisHide : copy.swap.feeWhatsThis}</CorsoText></Pressable>
              {feeExplainOpen ? <SwapFeeExplanation intent={frozenIntent} style={reviewShellText.feeLines} lineStyle={reviewShellText.footnote} /> : null}
            {frozenIntent.feeDropped ? (
              <CorsoText style={reviewShellText.alert}>{copy.swap.feeDropped}</CorsoText>
            ) : null}
            {(() => {
              const attribution = resolveSwapRouteAttribution({
                instructionVersion: frozenIntent.instructionVersion,
              });
              return (
                <>
                  <CorsoText style={reviewShellText.footnoteSpaced}>
                    {attribution.routeLine}
                  </CorsoText>
                  <CorsoText style={reviewShellText.footnoteSpaced}>
                    {attribution.poweredByLine}
                  </CorsoText>
                </>
              );
            })()}
            {reviewFactsPanels.showPay ? (
              <SwapReviewTokenFacts
                state={payTokenFacts}
                title={copy.tokenFacts.panelTitlePayLeg}
              />
            ) : null}
            {reviewFactsPanels.showReceive ? (
              <SwapReviewTokenFacts
                state={receiveTokenFacts}
                title={
                  reviewFactsPanels.showPay
                    ? copy.tokenFacts.panelTitleReceiveLeg
                    : undefined
                }
                receiveAmountAtomic={frozenIntent.outAmount}
                receiveDecimals={reviewReceiveToken.decimals}
              />
            ) : null}
            {reviewSubject ? (
              <SentimentChip
                mint={reviewSubject.mint}
                symbol={reviewSubject.symbol}
              />
            ) : null}
            {reviewedDangerLine ? (
              <CorsoText style={[reviewShellText.footnoteSpaced, reviewedDangerLine.style]}>
                {reviewedDangerLine.text}
              </CorsoText>
            ) : null}

            </View> : null}
        {reviewChrome?.showConfirm &&
        frozenIntent &&
        reviewedRugcheck?.requiresAcknowledgement &&
        !dangerAcknowledged ? (
          <>
            <ReviewShellDoors
              testID="swap-review-danger-door"
              doors={[
                { label: copy.swap.riskNotThisOne, onPress: closeReviewSheet },
                {
                  label: copy.swap.riskSwapAnyway,
                  onPress: () => setDangerAcknowledged(true),
                },
              ]}
            />
          </>
        ) : null}
            {formError ? <CorsoText style={[reviewShellText.alert, reviewShellText.inset]}>{formError}</CorsoText> : null}
          </ReviewSign>
          <BottomSheet kind="signing" dismissible={true} signing={false} title="Token facts" visible={reviewExplainOpen} onRequestClose={() => setReviewExplainOpen(false)}>
            {reviewFactsPanels.showPay ? <SwapReviewTokenFacts state={payTokenFacts} title={copy.tokenFacts.panelTitlePayLeg} /> : null}
            {reviewFactsPanels.showReceive ? <SwapReviewTokenFacts state={receiveTokenFacts} receiveAmountAtomic={frozenIntent?.outAmount} receiveDecimals={reviewReceiveToken.decimals} /> : null}
          </BottomSheet>
          <StepUpSheet {...stepUp.sheet} />
        </ReviewShellCanvas>
      </Modal>
    </SafeAreaView>
    </EthenaGround>
  );
}

function priceLine(
  order: SwapOrderResponse,
  pay: SwapToken,
  receive: SwapToken,
): string {
  const inAtomic = amountToAtomic('1', pay.decimals);
  if (!inAtomic) return copy.home.balancePlaceholder;
  try {
    const inAmt = BigInt(order.inAmount);
    const outAmt = BigInt(order.outAmount);
    if (inAmt <= 0n) return copy.home.balancePlaceholder;
    // out per 1 pay token, scaled by decimals
    const scaled =
      (outAmt * 10n ** BigInt(pay.decimals)) / inAmt;
    const outPerOne = formatAtomicAmount(scaled.toString(), receive.decimals);
    return copy.swap.rateLine(pay.symbol, outPerOne, receive.symbol);
  } catch {
    return copy.home.balancePlaceholder;
  }
}

function TokenCard(props: {
  label: string;
  amount: string;
  symbol: string;
  mint: string;
  editable: boolean;
  fullAmount?: string;
  amountTone?: 'figure' | 'placeholder';
  onChangeAmount?: (value: string) => void;
  balanceLabel?: string;
  notice?: string;
  onMax?: () => void;
  onPressToken?: () => void;
}) {
  const increaseContrast = useInkContrastEnabled();
  const [amountWidth, setAmountWidth] = useState<number | null>(null);
  const isPlaceholder = props.amountTone === 'placeholder';
  const amountFontSize = isPlaceholder
    ? TOKEN_CARD_AMOUNT_PLACEHOLDER_SIZE
    : resolveTokenCardAmountFontSize({
        text: props.fullAmount ?? props.amount,
        usableWidthDp: amountWidth,
      });

  function measureAmount(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.width;
    setAmountWidth((current) =>
      current != null && Math.abs(current - next) < 1 ? current : next,
    );
  }

  const tokenChip = (
    <View style={styles.tokenChip}>
      <TokenIconView
        symbol={props.symbol}
        mint={props.mint}
        size={22}
        accessibilityLabel={props.symbol}
        accessible={false}
      />
      <CorsoText style={styles.tokenChipText}>{props.symbol}</CorsoText>
      {props.onPressToken ? <CorsoText style={styles.tokenChevron}>›</CorsoText> : null}
    </View>
  );

  return (
    <View style={styles.tokenSlot}>
      <CorsoText style={styles.cardLabel}>{props.label}</CorsoText>
      <View style={styles.legRow}>
        <View style={styles.legAmount}>
          {props.editable ? (
            <TextInput
              style={styles.amountInput}
              value={props.amount}
              onChangeText={props.onChangeAmount}
              keyboardType="decimal-pad"
              showSoftInputOnFocus={false}
              placeholder={copy.swap.amountPlaceholder}
              placeholderTextColor={liftInkColor(ethena.ink.tertiary, increaseContrast)}
              accessibilityLabel={props.label}
              textAlign="left"
            />
          ) : (
            <CompactAmountText
              style={[
                styles.amountRead,
                isPlaceholder ? styles.amountPlaceholder : null,
                { fontSize: amountFontSize, lineHeight: Math.round(amountFontSize * 1.2) },
              ]}
              compactText={props.amount}
              fullText={props.fullAmount ?? props.amount}
              accessibilityLabel={`${props.label}, ${props.fullAmount ?? props.amount}`}
              onLayout={measureAmount}
              numberOfLines={1}
            />
          )}
        </View>
        {props.onPressToken ? (
          <Pressable
            onPress={props.onPressToken}
            accessibilityRole="button"
            accessibilityLabel={`Select ${props.symbol}`}
            style={styles.tokenChipHit}
          >
            {tokenChip}
          </Pressable>
        ) : (
          tokenChip
        )}
      </View>
      {props.balanceLabel ? (
        <View style={styles.balanceRow}>
          <CorsoText style={styles.muted}>{props.balanceLabel}</CorsoText>
          {props.onMax ? (
            <Pressable
              onPress={props.onMax}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={copy.swap.max}
              style={({ pressed }) => [
                styles.presetChip,
                pressed ? styles.presetChipPressed : null,
              ]}
            >
              <CorsoText style={styles.maxLink}>{copy.swap.max}</CorsoText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {props.notice ? <CorsoText style={styles.muted}>{props.notice}</CorsoText> : null}
    </View>
  );
}

const GATE_BACK = {
  label: copy.v1.back,
  onPress: () => goBackOr(BACK_FALLBACK.shell),
  accessibilityLabel: copy.v1.back,
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  /**
   * The composer's scroller only: its content ends a whole bottom fade above
   * the scroller's edge, so the last tray can be scrolled clear of the fade
   * and of the keypad under it. `pad` keeps 12 for the gate states.
   */
  composePad: {
    paddingBottom: SCROLL_FADE_BOTTOM,
  },
  body: {
    flex: 1,
  },
  /** The scroller's own box — the fades pin to THIS, not to the whole body. */
  scrollWrap: {
    flex: 1,
  },
  bodyScroll: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 8,
    paddingBottom: 8,
  },
  /** The shared header owns its gutter and top inset; this adds the gap under it. */
  headerRow: {
    paddingBottom: 8,
  },
  tradeHeadline: {
    // The receipt headline keeps its 22 step: the Ethena ladder has no 22 and
    // neither neighbour (17 / 34) holds the receipt's hierarchy.
    fontSize: 22,
    fontWeight: '600',
    color: ethena.ink.primary,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ethena.ink.tertiary,
  },
  /**
   * "Live quote" — a freshness STATUS on a money screen, not a group label.
   * `--ink48`: at `--ink28` the one word telling someone whether the number
   * they are about to sign is current read 2.35:1.
   */
  liveLabel: {
    fontSize: ETHENA_TYPE.rowSub.fontSize,
    fontWeight: canonWeight('500'),
    color: ethena.ink.tertiary,
  },
  subtitle: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
  },
  pane: {
    alignSelf: 'stretch',
  },
  /** One leg's tray: the radius, and the inset the leg has always had. */
  legPane: {
    borderRadius: PANE_RADIUS,
    overflow: 'hidden',
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 13,
  },
  /** The chart's pane: the plot draws its own inset, so only the sides. */
  chartPane: {
    borderRadius: PANE_RADIUS,
    overflow: 'hidden',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  /** The Review sheet's ledger pane: hairline rows carry their own rhythm. */
  metaContent: {
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  /** One leg pane: label · amount + chip · sub-line. */
  tokenSlot: {
    gap: 6,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  legAmount: {
    flex: 1,
    minWidth: 0,
  },
  cardLabel: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.sub.fontSize,
    fontWeight: canonWeight('500'),
    letterSpacing: 0,
  },
  amountInput: {
    alignSelf: 'stretch',
    fontSize: TOKEN_CARD_AMOUNT_FONT_SIZE,
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(TOKEN_CARD_AMOUNT_FONT_SIZE, -0.02),
    color: ethena.ink.primary,
    paddingVertical: Platform.OS === 'ios' ? 4 : 0,
    minHeight: 44,
    textAlign: 'left',
    fontVariant: canonNumerals(),
  },
  amountRead: {
    alignSelf: 'stretch',
    minWidth: 0,
    fontSize: TOKEN_CARD_AMOUNT_FONT_SIZE,
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(TOKEN_CARD_AMOUNT_FONT_SIZE, -0.02),
    color: ethena.ink.primary,
    minHeight: 44,
    textAlign: 'left',
    fontVariant: canonNumerals(),
  },
  amountPlaceholder: {
    color: ethena.ink.tertiary,
    fontWeight: canonWeight('500'),
    letterSpacing: 0,
  },
  tokenChipHit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  tokenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 6,
    paddingLeft: 7,
    paddingRight: 11,
    borderRadius: 999,
    backgroundColor: ONGLASS,
  },
  tokenChipText: {
    color: ethena.ink.primary,
    fontWeight: canonWeight('600'),
    fontSize: ETHENA_TYPE.rowName.fontSize,
  },
  tokenChevron: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  presetChip: {
    marginLeft: 'auto',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: ONGLASS,
  },
  presetChipPressed: {
    backgroundColor: ONGLASS_HI,
  },
  maxLink: {
    color: ethena.ink.secondary,
    fontWeight: canonWeight('500'),
    fontSize: ETHENA_TYPE.sub.fontSize,
  },
  flipRow: {
    alignItems: 'center',
    marginVertical: -12 - 4,
    zIndex: 1,
  },
  flip: {
    width: 32,
    height: 32,
    borderRadius: 999,
    // The ground-tray disc; the 4px ring is the ground's void, so the disc
    // still lifts off both panes on the desk ground.
    borderWidth: 4,
    borderColor: ethena.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipLabel: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: '600',
  },
  meta: {
    alignSelf: 'stretch',
    borderRadius: ethenaGeometry.radiusBox,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  chartToggle: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  chartToggleLabel: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.sub.fontSize,
    fontWeight: canonWeight('500'),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowLabel: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
  },
  rowValue: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  composeRow: {
    minHeight: 24,
    alignItems: 'center',
    paddingVertical: 9,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ethena.hair,
  },
  composeRowLabel: {
    color: ethena.ink.secondary,
    fontSize: ETHENA_TYPE.sub.fontSize,
    fontWeight: canonWeight('400'),
  },
  composeRowValue: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.sub.fontSize,
    fontWeight: canonWeight('400'),
    fontVariant: canonNumerals(),
  },
  /** Corso fee row label + its "What's this?" affordance, one hit target. */
  feeLabelHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  /** Secondary ink, not azure: this is an explainer, not a money CTA. */
  feeWhatsThis: {
    color: ethena.ink.secondary,
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  signDoor: {
    marginTop: 12,
  },
  reviewCta: {
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 0,
  },
  controlDisabled: {
    opacity: ETHENA_COMMIT_DISABLED_OPACITY,
  },
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: '500',
  },
  muted: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.rowSub.fontSize,
  },
  error: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.rowSub.fontSize,
  },
  riskLine: {
    marginTop: 12,
    color: ethena.ink.secondary,
    fontWeight: canonWeight('500'),
    fontSize: ETHENA_TYPE.sub.fontSize,
    lineHeight: 18,
  },
  warn: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.rowSub.fontSize,
  },
  reviewHero: {
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
  },
  reviewHeroValue: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.title.fontSize,
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(ETHENA_TYPE.title.fontSize, -0.024),
    lineHeight: ETHENA_TYPE.title.fontSize,
    fontVariant: canonNumerals(),
  },
  reviewHeroSub: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.sub.fontSize,
    fontWeight: canonWeight('500'),
    fontVariant: canonNumerals(),
  },
  reviewFloor: {
    marginTop: 16,
    textAlign: 'center',
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.sub.fontSize,
    fontWeight: canonWeight('400'),
  },
  routeTitle: {
    color: ethena.ink.primary,
    fontWeight: '600',
    fontSize: ETHENA_TYPE.rowName.fontSize,
  },
  mono: {
    fontSize: ETHENA_TYPE.rowSub.fontSize,
    /** Signature: slashed zero so `0` cannot read as `O`. */
    fontVariant: canonNumerals(),
    color: ethena.ink.tertiary,
  },
  dimmed: {
    opacity: 0.4,
  },
  sourceSentenceSlot: {
    minHeight: 44,
    justifyContent: 'center',
  },
  /** The words are the title: ink at 100, Inter body, no label. */
  sourceSentence: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    lineHeight: 22,
  },
  /** While the sentence is on screen the cleaned pair steps one register down. */
  titleQuieted: {
    color: ethena.ink.secondary,
  },
  receiptSentence: {
    color: ethena.ink.secondary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    lineHeight: 22,
  },
  sendingCaption: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    marginTop: 16,
    marginBottom: 16,
  },
  resultMarkMoment: {
    alignItems: 'center',
    marginBottom: 16,
  },
});
