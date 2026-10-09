import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import {
  MIN_TAP_TARGET_PT,
  resolveTapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation';

import { formatFeeSol } from '@/src/features/activity/formatActivityAmount';
import { formatSolBalanceFull } from '@/src/features/balances/formatSol';
import { formatUsdcBalanceFull } from '@/src/features/balances/formatUsdc';
import { usdcMintForCluster } from '@/src/features/balances/usdcConstants';
import { useSolBalance } from '@/src/features/balances/useSolBalance';
import { useUsdcBalance } from '@/src/features/balances/useUsdcBalance';
import { freezeReviewedUsdcTransferIntent } from '@/src/features/send/assertUsdcCompiledTransferSemantics';
import {
  buildUsdcTransfer,
  SPL_TOKEN_ACCOUNT_SIZE,
} from '@/src/features/send/buildUsdcTransfer';
import { buildSolTransfer } from '@/src/features/send/buildSolTransfer';
import {
  lamportsToSolString,
  solAmountToLamports,
} from '@/src/features/send/parseSolAmount';
import {
  atomicToUsdcString,
  usdcAmountToAtomic,
} from '@/src/features/send/parseUsdcAmount';
import {
  openSolanaConnectionOnKnownNetwork,
  SolanaNetworkUnknownError,
} from '@/src/features/send/solanaConnection';
import {
  resolveSendNetworkGate,
  sendMayComposeOnNetwork,
} from '@/src/features/send/sendNetworkGate';
import {
  analyticsEventForSolSubmitResult,
  SolTransferExecutionFailedError,
  submitSolTransfer,
  type SubmitSolTransferConfirmation,
} from '@/src/features/send/submitSolTransfer';
import {
  submitUsdcTransfer,
  UsdcTransferExecutionFailedError,
} from '@/src/features/send/submitUsdcTransfer';
import {
  analyticsEventForUsdcSubmitResult,
  reconcileUsdcConfirmForSubmit,
} from '@/src/features/send/usdcConfirmController';
import {
  freezeUsdcSendReviewFromBuilt,
  type SendAsset,
  type UsdcSendReviewFreeze,
} from '@/src/features/send/usdcSendIntent';
import {
  hasPriorRecipient,
  isFirstTimeRecipient,
  listRecentRecipients,
  recordConfirmedRecipient,
  sendNewRecipientAccessibility,
} from '@/src/features/send/priorRecipients';
import { checkRecipientAddress } from '@/src/features/send/recipientCheck';
import { SendScanner } from '@/src/features/send/SendScanner';
import { scanPrefillNotice } from '@/src/features/send/sendScannerPresentation';
import type { ScannedRequest } from '@/src/features/send/solanaPayRequest';
import {
  SEND_CLEAR_LABEL,
  SEND_SHIPPED_ADDRESS_ERROR,
  SEND_SHIPPED_SOL_BALANCE_ERROR,
  SEND_SHIPPED_USDC_BALANCE_ERROR,
  isSendCancelledError,
  isSendReviewEnabled,
  resolveSendBackChrome,
  resolveSendComposeError,
  resolveSendFeeChrome,
  resolveSendScanChrome,
  resolveSendSourceState,
  resolveSendStepUpChrome,
} from '@/src/features/send/sendRoutePresentation';
import {
  maxSendableLamports,
  parseRecipientAddress,
  validateSendForm,
} from '@/src/features/send/validateSend';
import {
  maxSendableUsdcAtomic,
  validateUsdcSendForm,
  type UsdcSendCluster,
} from '@/src/features/send/validateUsdcSend';
import { useActiveSigner } from '@/src/features/security/getActiveSigner';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import { useStepUpConfirm } from '@/src/features/security/useStepUpConfirm';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { noteTextInputActivity } from '@/src/features/session/sessionGate';
import { trackEvent } from '@/src/lib/analytics';
import {
  resolveNetworkStatus,
  resolveSendEnabled,
  type NetworkStatus,
} from '@/src/lib/apiConfig';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA';
import { SlideToConfirm } from '@/src/ui/controls/SlideToConfirm';
import { TextButton } from '@/src/ui/controls/TextButton';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { SendScreenHeader as AccountScreenHeader, SendScreenCard as SettingsCard } from '@/src/features/send/SendScreenChrome';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { AccountSectionHeading } from '@/src/features/account/ui/AccountSectionHeading';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  CANON_TYPE_SIZES,
  canonNumerals,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';

const FIELD_WELL_SIZE = 32;
const FIELD_WELL_HIT_SLOP = resolveTapTargetInsets({
  visualWidth: FIELD_WELL_SIZE,
  visualHeight: FIELD_WELL_SIZE,
});
const CHIP_BTN_MIN_HEIGHT = 32;
const CHIP_BTN_HIT_SLOP = resolveTapTargetInsets({
  visualWidth: MIN_TAP_TARGET_PT,
  visualHeight: CHIP_BTN_MIN_HEIGHT,
});
/** `paddingVertical: spacing.sm` (8) either side of a body-size 17pt line. */
const ASSET_CHIP_VISUAL_HEIGHT = 32;
const ASSET_CHIP_HIT_SLOP = resolveTapTargetInsets({
  visualWidth: MIN_TAP_TARGET_PT,
  visualHeight: ASSET_CHIP_VISUAL_HEIGHT,
});

type Step = 'compose' | 'review' | 'success';

export type SendSheetContentProps = {
  onRequestClose: () => void;
  onSigningChange: (signing: boolean) => void;
};

export function SendSheetContent({
  onRequestClose,
  onSigningChange,
}: SendSheetContentProps) {
  const { session, noteUserActivity } = useCorsoSession();
  const { getActiveSigner, moneySignerGateCells } = useActiveSigner();
  const stepUp = useStepUpConfirm();
  const solBalance = useSolBalance(session?.address);
  const usdcBalance = useUsdcBalance(session?.address);

  const [asset, setAsset] = useState<SendAsset>('SOL');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(
    null,
  );
  // Memoised on the status alone so the gate is referentially stable: it is a
  // dependency of `refreshFeeEstimate`, and a fresh object every render would
  // restart the compose-screen fee debounce on every keystroke's re-render.
  const networkGate = useMemo(
    () => resolveSendNetworkGate(networkStatus),
    [networkStatus],
  );
  const cluster: UsdcSendCluster | null =
    networkGate.state === 'ready' ? networkGate.cluster : null;
  const [step, setStep] = useState<Step>('compose');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [feeLamports, setFeeLamports] = useState<number | null>(null);
  const [ataRentLamports, setAtaRentLamports] = useState(0);
  const [needsDestinationAta, setNeedsDestinationAta] = useState(false);
  const [feeStatus, setFeeStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendEnabled, setSendEnabled] = useState<boolean | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [confirmation, setConfirmation] =
    useState<SubmitSolTransferConfirmation | null>(null);
  useEffect(() => {
    onSigningChange(busy);
    return () => onSigningChange(false);
  }, [busy, onSigningChange]);

  // SOL review freeze
  const [reviewLamports, setReviewLamports] = useState<number | null>(null);
  const [reviewFee, setReviewFee] = useState<number | null>(null);

  // USDC review freeze (immutable snapshot for confirm rebuild)
  const [usdcReview, setUsdcReview] = useState<UsdcSendReviewFreeze | null>(
    null,
  );
  const [reviewNewRecipientWarning, setReviewNewRecipientWarning] =
    useState(true);
  const reviewWarningRequestRef = useRef(0);
  const [recipientBlurred, setRecipientBlurred] = useState(false);
  const [amountBlurred, setAmountBlurred] = useState(false);
  const [destinationExpanded, setDestinationExpanded] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);

  const refreshReviewNewRecipientWarning = useCallback(
    async (recipientAddress: string) => {
      const requestId = ++reviewWarningRequestRef.current;
      setReviewNewRecipientWarning(true);
      try {
        const known = await hasPriorRecipient({
          cluster,
          owner: session?.address,
          recipient: recipientAddress,
        });
        if (requestId !== reviewWarningRequestRef.current) return;
        setReviewNewRecipientWarning(isFirstTimeRecipient(known));
      } catch {
        if (requestId !== reviewWarningRequestRef.current) return;
        setReviewNewRecipientWarning(true);
      }
    },
    [cluster, session?.address],
  );

  useEffect(() => {
    return () => {
      reviewWarningRequestRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [enabled, nextNetwork] = await Promise.all([
        resolveSendEnabled().catch(() => false),
        resolveNetworkStatus(),
      ]);
      if (!cancelled) {
        setSendEnabled(enabled);
        setNetworkStatus(nextNetwork);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Addresses already sent to. No names, no editing, no adding.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listRecentRecipients({
        cluster,
        owner: session?.address,
      });
      if (!cancelled) setRecents(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [cluster, session?.address, step]);

  const clearFeeState = useCallback(() => {
    setFeeLamports(null);
    setAtaRentLamports(0);
    setNeedsDestinationAta(false);
    setFeeStatus('idle');
  }, []);

  const onSelectAsset = useCallback(
    (next: SendAsset) => {
      if (next === asset) return;
      setAsset(next);
      setAmount('');
      setFormError(null);
      clearFeeState();
      setReviewLamports(null);
      setReviewFee(null);
      setUsdcReview(null);
      setSignature(null);
      setConfirmation(null);
    },
    [asset, clearFeeState],
  );

  const refreshFeeEstimate = useCallback(async () => {
    if (!session?.address) return;
    if (sendEnabled !== true) {
      clearFeeState();
      return;
    }
    if (!sendMayComposeOnNetwork(networkGate)) {
      clearFeeState();
      return;
    }
    const to = parseRecipientAddress(recipient);

    if (asset === 'SOL') {
      const lamports = solAmountToLamports(amount);
      if (!to || lamports === null) {
        clearFeeState();
        return;
      }
      setFeeStatus('loading');
      try {
        const connection = await openSolanaConnectionOnKnownNetwork();
        const built = await buildSolTransfer({
          connection,
          fromAddress: session.address,
          recipient: to,
          lamports,
        });
        setFeeLamports(built.feeLamports);
        setAtaRentLamports(0);
        setNeedsDestinationAta(false);
        setFeeStatus(built.feeLamports === null ? 'error' : 'ready');
      } catch {
        clearFeeState();
        setFeeStatus('error');
      }
      return;
    }

    // USDC
    if (!cluster) {
      clearFeeState();
      return;
    }
    const amountAtomic = usdcAmountToAtomic(amount);
    if (!to || amountAtomic === null) {
      clearFeeState();
      return;
    }

    setFeeStatus('loading');
    try {
      const mint = usdcMintForCluster(cluster);
      const connection = await openSolanaConnectionOnKnownNetwork();
      const built = await buildUsdcTransfer({
        connection,
        fromAddress: session.address,
        recipient: to,
        amountAtomic,
        mint,
        cluster,
      });

      let rent = 0;
      if (built.createdDestinationAta) {
        const rentExemption =
          await connection.getMinimumBalanceForRentExemption(
            SPL_TOKEN_ACCOUNT_SIZE,
          );
        if (!Number.isSafeInteger(rentExemption) || rentExemption <= 0) {
          clearFeeState();
          setFeeStatus('error');
          return;
        }
        rent = rentExemption;
      }

      const freeze = freezeUsdcSendReviewFromBuilt({
        built,
        ataRentLamports: rent,
        cluster,
        payer: session.address,
      });
      if (!freeze.ok) {
        clearFeeState();
        setFeeStatus('error');
        return;
      }
      setFeeLamports(freeze.feeLamports);
      setAtaRentLamports(freeze.ataRentLamports);
      setNeedsDestinationAta(freeze.needsDestinationAta);
      setFeeStatus('ready');
    } catch {
      clearFeeState();
      setFeeStatus('error');
    }
  }, [
    amount,
    asset,
    clearFeeState,
    cluster,
    networkGate,
    recipient,
    sendEnabled,
    session?.address,
  ]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void refreshFeeEstimate();
    }, 400);
    return () => clearTimeout(handle);
  }, [refreshFeeEstimate]);

  async function onPaste() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text.trim()) {
        setRecipient(text.trim());
        setFormError(null);
        setRecipientBlurred(true);
        setScanNotice(null);
      }
    } catch {
      setFormError("Couldn't paste. Try again.");
    }
  }

  function applyRecent(address: string) {
    setRecipient(address);
    setFormError(null);
    setRecipientBlurred(true);
    setScanNotice(null);
  }

  /**
   * A scanned payment request never applies quietly. Whatever the code filled
   * in gets said out loud under the field.
   */
  function onScanned(request: ScannedRequest) {
    setRecipient(request.address);
    setRecipientBlurred(true);
    setFormError(null);
    if (request.assetFromRequest) {
      onSelectAsset(request.asset);
    }
    if (request.amount !== null) {
      setAmount(request.amount);
      setAmountBlurred(true);
    }
    setScanNotice(scanPrefillNotice(request));
    setScannerOpen(false);
  }

  function onMax() {
    if (asset === 'SOL') {
      if (solBalance.lamports === null) return;
      const max = maxSendableLamports(solBalance.lamports, feeLamports);
      if (max <= 0) {
        setFormError('Not enough SOL to cover network fees');
        return;
      }
      setAmount(lamportsToSolString(max));
      setFormError(null);
      setAmountBlurred(true);
      return;
    }
    if (usdcBalance.atomic === null) return;
    const max = maxSendableUsdcAtomic(usdcBalance.atomic);
    if (max <= 0n) {
      setFormError('Not enough USDC');
      return;
    }
    setAmount(atomicToUsdcString(max));
    setFormError(null);
    setAmountBlurred(true);
  }

  function onReview() {
    if (sendEnabled !== true) return;
    // Address judgement first, so a bad destination never reaches a builder.
    const destination = checkRecipientAddress({
      raw: recipient,
      ownerAddress: session?.address ?? null,
    });
    if (!destination.ok) {
      setFormError(destination.message);
      setRecipientBlurred(true);
      return;
    }

    if (!sendMayComposeOnNetwork(networkGate)) {
      setFormError(
        networkGate.state === 'declined'
          ? networkGate.body
          : "Couldn't confirm the network. Pull back and try again.",
      );
      return;
    }

    if (asset === 'SOL') {
      const result = validateSendForm({
        recipient,
        amount,
        balanceLamports: solBalance.lamports,
        feeLamports,
        fromAddress: session?.address ?? null,
      });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setReviewLamports(result.lamports);
      setReviewFee(feeLamports);
      setUsdcReview(null);
      setFormError(null);
      setStep('review');
      void refreshReviewNewRecipientWarning(result.recipient.toBase58());
      return;
    }

    if (!cluster) {
      // Unreachable given the gate above; kept as a type narrowing and a floor.
      setFormError("Couldn't confirm the network. Pull back and try again.");
      return;
    }
    if (!session?.address) {
      setFormError('Cannot send without a session address');
      return;
    }
    const mint = usdcMintForCluster(cluster);
    const result = validateUsdcSendForm({
      recipient,
      amount,
      usdcBalanceAtomic: usdcBalance.atomic,
      solBalanceLamports: solBalance.lamports,
      feeLamports,
      ataRentLamports,
      needsDestinationAta,
      fromAddress: session.address,
      mint,
      cluster,
    });
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    if (
      feeLamports === null ||
      !Number.isSafeInteger(feeLamports) ||
      feeLamports < 0
    ) {
      setFormError(
        "Couldn't confirm the network fee. Pull back and try again.",
      );
      return;
    }
    const rent = needsDestinationAta ? ataRentLamports : 0;
    const solRequiredLamports = feeLamports + rent;
    if (!Number.isSafeInteger(solRequiredLamports)) {
      setFormError("Couldn't confirm the SOL reserve required for this send.");
      return;
    }
    setUsdcReview(
      Object.freeze({
        amountAtomic: result.amountAtomic,
        feeLamports,
        ataRentLamports: rent,
        needsDestinationAta,
        mint: result.mint,
        cluster,
        recipient: result.recipient.toBase58(),
        solRequiredLamports,
        payer: session.address,
      }),
    );
    setReviewLamports(null);
    setReviewFee(null);
    setFormError(null);
    setStep('review');
    void refreshReviewNewRecipientWarning(result.recipient.toBase58());
  }

  async function onConfirmSendSol() {
    if (!session?.address || reviewLamports === null) return;
    const to = parseRecipientAddress(recipient);
    if (!to) {
      setFormError('Enter a valid Solana address.');
      setStep('compose');
      return;
    }

    setBusy(true);
    setFormError(null);
    let signer: Awaited<ReturnType<typeof getActiveSigner>> | null = null;

    try {
      const connection = await openSolanaConnectionOnKnownNetwork();
      const built = await buildSolTransfer({
        connection,
        fromAddress: session.address,
        recipient: to,
        lamports: reviewLamports,
      });

      const recheck = validateSendForm({
        recipient,
        amount: lamportsToSolString(reviewLamports),
        balanceLamports: solBalance.lamports,
        feeLamports: built.feeLamports,
        fromAddress: session.address,
      });
      if (!recheck.ok) {
        setFormError(recheck.message);
        setStep('compose');
        return;
      }

      setReviewFee(built.feeLamports);
      const notionalSol = reviewLamports / 1e9;
      const prepared = await stepUp.prepareStepUp({
        session,
        notionalSol,
        surface: 'send',
      });
      signer = await getActiveSigner({
        session,
        notionalSol,
        surface: 'send',
        verifyPrivyMfa:
          prepared.needed && 'verifyPrivyMfa' in prepared
            ? prepared.verifyPrivyMfa
            : undefined,
        policy: prepared.policy ?? stepUp.policy ?? undefined,
      });
      const result = await submitSolTransfer({
        signer,
        connection,
        built,
        session,
        verifyPrivyMfa:
          prepared.needed && 'verifyPrivyMfa' in prepared
            ? prepared.verifyPrivyMfa
            : undefined,
        cells: moneySignerGateCells,
      });
      setSignature(result.signature);
      setConfirmation(result.confirmation);
      void recordConfirmedRecipient({
        cluster,
        owner: session.address,
        recipient: to.toBase58(),
        confirmation: result.confirmation,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      void solBalance.refresh();
      const analyticsEvent = analyticsEventForSolSubmitResult(
        result.confirmation,
      );
      trackEvent(analyticsEvent, {
        asset: 'SOL',
        confirmation: result.confirmation,
        lamports: reviewLamports,
        signature: result.signature,
      });
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof SolTransferExecutionFailedError) {
        setSignature(error.signature);
      }
      setFormError(
        error instanceof SolanaNetworkUnknownError
          ? copy.send.networkUnknownBody
          : error instanceof Error
            ? error.message
            : copy.send.errorGeneric,
      );
      trackEvent('send_failed', {
        asset: 'SOL',
        error_code:
          error instanceof SolTransferExecutionFailedError
            ? 'execution_failed'
            : error instanceof Error
              ? 'send_failed'
              : 'unknown',
      });
    } finally {
      signer?.clear?.();
      setBusy(false);
    }
  }

  async function onConfirmSendUsdc() {
    if (!session?.address || !usdcReview || !cluster) return;

    setBusy(true);
    setFormError(null);
    let signer: Awaited<ReturnType<typeof getActiveSigner>> | null = null;

    try {
      const connection = await openSolanaConnectionOnKnownNetwork();
      const reconciled = await reconcileUsdcConfirmForSubmit({
        connection,
        reviewed: usdcReview,
        sessionAddress: session.address,
        cluster,
        usdcBalanceAtomic: usdcBalance.atomic,
      });

      if (reconciled.status === 'error') {
        setFormError(reconciled.message);
        setStep(reconciled.returnTo);
        return;
      }

      if (reconciled.status === 'review_updated') {
        // Fee/rent/ATA/cluster/payer (or amount/mint/recipient) drifted —
        // show updated terms and require another explicit Send tap.
        setUsdcReview(reconciled.freeze);
        setFormError(null);
        setStep('review');
        void refreshReviewNewRecipientWarning(reconciled.freeze.recipient);
        return;
      }

      const { freeze: liveFreeze, built, liveSolLamports } = reconciled;
      setUsdcReview(liveFreeze);

      const reviewedIntent = freezeReviewedUsdcTransferIntent({
        built,
        payer: session.address,
      });

      const notionalSol = null;
      const prepared = await stepUp.prepareStepUp({
        session,
        notionalSol,
        surface: 'send',
      });
      signer = await getActiveSigner({
        session,
        notionalSol,
        surface: 'send',
        verifyPrivyMfa:
          prepared.needed && 'verifyPrivyMfa' in prepared
            ? prepared.verifyPrivyMfa
            : undefined,
        policy: prepared.policy ?? stepUp.policy ?? undefined,
      });

      const result = await submitUsdcTransfer({
        signer,
        connection,
        built,
        reviewedIntent,
        reviewedFreeze: liveFreeze,
        session,
        balances: {
          usdcBalanceAtomic: usdcBalance.atomic,
          solBalanceLamports: liveSolLamports,
          cluster,
        },
        verifyPrivyMfa:
          prepared.needed && 'verifyPrivyMfa' in prepared
            ? prepared.verifyPrivyMfa
            : undefined,
        policy: prepared.policy ?? stepUp.policy ?? undefined,
        cells: moneySignerGateCells,
      });

      // Rent/fee/ATA (or other consent terms) drifted after reconcile while
      // step-up/signer awaited — return to review; require another Send tap.
      if (result.status === 'review_updated') {
        setUsdcReview(result.freeze);
        setFormError(null);
        setStep('review');
        void refreshReviewNewRecipientWarning(result.freeze.recipient);
        return;
      }

      setSignature(result.signature);
      setConfirmation(result.confirmation);
      void recordConfirmedRecipient({
        cluster,
        owner: session.address,
        recipient: liveFreeze.recipient,
        confirmation: result.confirmation,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('success');
      void solBalance.refresh();
      void usdcBalance.refresh();

      const analyticsEvent = analyticsEventForUsdcSubmitResult(
        result.confirmation,
      );
      trackEvent(analyticsEvent, {
        asset: 'USDC',
        confirmation: result.confirmation,
        amount_atomic: liveFreeze.amountAtomic.toString(),
        signature: result.signature,
      });
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof UsdcTransferExecutionFailedError) {
        setSignature(error.signature);
      }
      setFormError(
        error instanceof SolanaNetworkUnknownError
          ? copy.send.networkUnknownBody
          : error instanceof Error
            ? error.message
            : copy.send.errorGeneric,
      );
      trackEvent('send_failed', {
        asset: 'USDC',
        error_code:
          error instanceof UsdcTransferExecutionFailedError
            ? 'execution_failed'
            : error instanceof Error
              ? 'send_failed'
              : 'unknown',
      });
    } finally {
      // submitUsdcTransfer also clears; defense-in-depth for early exits.
      signer?.clear?.();
      setBusy(false);
    }
  }

  const recipientCheck = checkRecipientAddress({
    raw: recipient,
    ownerAddress: session?.address ?? null,
  });
  const recipientValid = recipientCheck.ok;
  const solLamports = asset === 'SOL' ? solAmountToLamports(amount) : null;
  const usdcAtomic = asset === 'USDC' ? usdcAmountToAtomic(amount) : null;
  const amountPresent =
    asset === 'SOL'
      ? solLamports !== null && solLamports > 0
      : usdcAtomic !== null && usdcAtomic > 0n;
  const overBalance = useMemo(() => {
    if (asset === 'SOL') {
      if (
        solBalance.lamports === null ||
        feeLamports === null ||
        solLamports === null
      ) {
        return false;
      }
      return solLamports + feeLamports > solBalance.lamports;
    }
    if (usdcBalance.atomic === null || usdcAtomic === null) return false;
    return usdcAtomic > usdcBalance.atomic;
  }, [
    asset,
    feeLamports,
    solBalance.lamports,
    solLamports,
    usdcAtomic,
    usdcBalance.atomic,
  ]);
  const reviewEnabled = isSendReviewEnabled({
    recipientValid,
    amountPresent,
    feeStatus,
    feeLamports,
    overBalance,
  });
  const feeChrome = resolveSendFeeChrome({ feeStatus, feeLamports });
  const scanChrome = resolveSendScanChrome();
  const frame = resolveSendSourceState({
    sendEnabled,
    step,
    busy,
    cancelled: isSendCancelledError(formError),
    sendFailed: Boolean(formError) && step === 'review' && !busy,
    showStepUpNotice:
      asset === 'USDC'
        ? stepUp.showReviewNotice(null, stepUp.policy)
        : reviewLamports != null &&
          stepUp.showReviewNotice(reviewLamports / 1e9, stepUp.policy),
    feeStatus,
    feeLamports,
    overBalance,
    amountBlurred,
    recipientEmpty: recipient.trim().length === 0,
    recipientValid,
    recipientBlurred,
    amountPresent,
  });
  const stepUpChrome = resolveSendStepUpChrome({
    showNotice:
      frame === 'F083' ||
      (step === 'review' &&
        (asset === 'USDC'
          ? stepUp.showReviewNotice(null, stepUp.policy)
          : reviewLamports != null &&
            stepUp.showReviewNotice(reviewLamports / 1e9, stepUp.policy))),
    thresholdLabel: stepUp.sheet.thresholdLabel,
  });
  const backChrome = resolveSendBackChrome({ busy });

  const composeError =
    resolveSendComposeError({
      frame,
      formError:
        formError ??
        (frame === 'F078' && asset === 'USDC'
          ? SEND_SHIPPED_USDC_BALANCE_ERROR
          : frame === 'F078'
            ? SEND_SHIPPED_SOL_BALANCE_ERROR
            : frame === 'F077'
              ? // Say which problem it is: your own address, a token mint, an
                // address nothing can be sent to, or simply not an address.
                ((recipientCheck.ok ? null : recipientCheck.message) ??
                SEND_SHIPPED_ADDRESS_ERROR)
              : null),
    }) ?? null;

  const feeLabel =
    feeChrome.kind === 'ready' && feeLamports !== null
      ? formatFeeSol(feeLamports, copy.send.feeUnknown)
      : feeChrome.label;

  function renderHeader(title: string, onBack?: () => void) {
    return (
      <AccountScreenHeader
        title={title}
        onBack={
          backChrome.disabled ? () => undefined : (onBack ?? onRequestClose)
        }
        backAccessibilityLabel={backChrome.accessibilityLabel}
        backDisabled={backChrome.disabled}
        testID="send-header"
      />
    );
  }

  if (sendEnabled === null) {
    return (
      <SafeAreaView style={styles.safe} testID="send-flag-resolving">
        {renderHeader(copy.send.title)}
      </SafeAreaView>
    );
  }

  if (!sendEnabled) {
    return (
      <SafeAreaView style={styles.safe}>
        {renderHeader(copy.send.title)}
        <View style={styles.body}>
          <CorsoText style={styles.subtitle}>{copy.send.disabled}</CorsoText>
        </View>
      </SafeAreaView>
    );
  }

  if (networkGate.state === 'declined') {
    return (
      <SafeAreaView style={styles.safe}>
        {renderHeader(networkGate.title)}
        <View style={styles.body}>
          <CorsoText style={styles.subtitle}>{networkGate.body}</CorsoText>
        </View>
      </SafeAreaView>
    );
  }

  if (!session?.address) {
    return (
      <SafeAreaView style={styles.safe}>
        {renderHeader(copy.send.title)}
        <View style={styles.body}>
          <CorsoText style={styles.subtitle}>
            {copy.send.missingAddress}
          </CorsoText>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'success') {
    const successTitle =
      confirmation === 'uncertain'
        ? copy.send.successTitleUncertain
        : copy.send.successTitle;
    const successBody =
      confirmation === 'uncertain'
        ? copy.send.successBodyUncertain
        : copy.send.successBody;
    const amountLabel =
      asset === 'USDC' && usdcReview
        ? formatUsdcBalanceFull(usdcReview.amountAtomic)
        : reviewLamports !== null
          ? formatFeeSol(reviewLamports, copy.home.balancePlaceholder)
          : null;

    return (
      <SafeAreaView style={styles.safe}>
        {renderHeader(successTitle)}
        <View style={styles.body}>
          <CorsoText style={styles.subtitle}>{successBody}</CorsoText>
          {amountLabel ? (
            <CorsoText style={styles.successAmount}>{amountLabel}</CorsoText>
          ) : null}
          {signature ? (
            <CorsoText style={styles.mono} selectable>
              {truncateAddress(signature)}
            </CorsoText>
          ) : null}
          <PrimaryCTA label={copy.send.successDone} onPress={onRequestClose} />
          <SecondaryCTA
            label={copy.send.successHome}
            onPress={onRequestClose}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'review') {
    const destination =
      asset === 'USDC' && usdcReview ? usdcReview.recipient : recipient.trim();
    const destinationDisplay = destinationExpanded
      ? destination
      : truncateAddress(destination);

    /**
     * The receipt: hero amount, `you send · to`, the hairline ledger,
     * the first-send caution, then the confirmation slide. Both asset
     * branches share the chrome; the frozen values each branch reads are the
     * same ones the old layout read, through the same formatters.
     */
    const renderRecipientRow = () => (
      <Pressable
        onPress={() => setDestinationExpanded((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={`${copy.send.reviewTo} ${destinationDisplay}`}
        style={styles.receiptRow}
      >
        <Text style={styles.receiptLabel}>{copy.send.reviewTo}</Text>
        <Text
          style={[styles.receiptValue, styles.receiptAddress]}
          selectable={destinationExpanded}
        >
          {destinationExpanded ? destination : destinationDisplay}
        </Text>
      </Pressable>
    );
    const renderCaution = () =>
      reviewNewRecipientWarning ? (
        <View
          style={styles.caution}
          {...sendNewRecipientAccessibility({
            title: copy.send.newRecipientTitle,
            body: copy.send.newRecipientBody,
          })}
        >
          <View style={styles.cautionDot} />
          <Text style={styles.cautionText}>
            <Text style={styles.cautionTitle}>
              {copy.send.newRecipientTitle}
            </Text>
            {' · '}
            {copy.send.newRecipientBody}
          </Text>
        </View>
      ) : null;
    const renderHero = (amountText: string) => (
      <View
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${copy.send.reviewSending} ${amountText}`}
        style={styles.reviewHero}
      >
        <Text style={styles.reviewHeroValue} numberOfLines={2}>
          {amountText}
        </Text>
        <Text style={styles.reviewHeroSub}>
          {copy.send.reviewSending} · {copy.send.reviewTo}{' '}
          <Text style={styles.reviewHeroSubStrong}>
            {truncateAddress(destination)}
          </Text>
        </Text>
      </View>
    );

    if (asset === 'USDC' && usdcReview) {
      const feeText = formatFeeSol(usdcReview.feeLamports, copy.send.feeUnknown);
      return (
        <SafeAreaView style={styles.safe}>
          {renderHeader(copy.send.reviewTitle, () => setStep('compose'))}
          <View style={styles.scrollWrap}>
            <ScrollView contentContainerStyle={styles.body}>
              {renderHero(formatUsdcBalanceFull(usdcReview.amountAtomic))}

              <AccountSectionHeading label={copy.send.reviewTitle} />
              <SettingsCard contentStyle={styles.receiptContent}>
                {renderRecipientRow()}
                <Row
                  divider
                  label={copy.send.amountLabel}
                  value={formatUsdcBalanceFull(usdcReview.amountAtomic)}
                  strong
                />
                <Row divider label={copy.send.reviewFee} value={feeText} />
                {usdcReview.needsDestinationAta ? (
                  <Row
                    divider
                    label={copy.send.rentLabel}
                    value={formatFeeSol(usdcReview.ataRentLamports, copy.send.feeUnknown)}
                  />
                ) : null}
                {usdcReview.needsDestinationAta ? (
                  <CorsoText>{copy.send.rentRecovery}</CorsoText>
                ) : null}
                <Row
                  divider
                  label={copy.send.totalCostLabel}
                  value={formatFeeSol(usdcReview.solRequiredLamports, copy.send.feeUnknown)}
                />
              </SettingsCard>
              {renderCaution()}

              {stepUpChrome.noticeVisible && stepUpChrome.noticeText ? (
                <CorsoText style={styles.subtitle}>
                  {stepUpChrome.noticeText}
                </CorsoText>
              ) : null}

              {formError ? (
                <CorsoText style={styles.error}>{formError}</CorsoText>
              ) : null}

              <CorsoText style={styles.reviewFloor}>
                {copy.live.reviewFloor}
              </CorsoText>
              <SlideToConfirm
                label={copy.v1.confirmSend}
                accessibilityLabel={copy.v1.confirmSend}
                busy={busy}
                disabled={busy}
                onConfirm={() => {
                  void onConfirmSendUsdc();
                }}
                style={styles.signDoor}
                testID="send-slide-to-confirm"
              />
              {busy ? (
                <CorsoText style={styles.confirming}>
                  {copy.send.confirming}
                </CorsoText>
              ) : null}
            </ScrollView>
            <ScrollEdgeFade />
          </View>
          <StepUpSheet {...stepUp.sheet} />
        </SafeAreaView>
      );
    }

    const feeText =
      reviewFee !== null ? formatFeeSol(reviewFee, copy.send.feeUnknown) : copy.send.feeUnknown;
    const totalText =
      reviewLamports !== null && reviewFee !== null
        ? formatFeeSol(reviewLamports + reviewFee, copy.send.feeUnknown)
        : copy.send.feeUnknown;
    const solAmountText =
      reviewLamports !== null
        ? formatFeeSol(reviewLamports, copy.home.balancePlaceholder)
        : copy.home.balancePlaceholder;

    return (
      <SafeAreaView style={styles.safe}>
        {renderHeader(copy.send.reviewTitle, () => setStep('compose'))}
        <View style={styles.scrollWrap}>
          <ScrollView contentContainerStyle={styles.body}>
            {renderHero(solAmountText)}

            <AccountSectionHeading label={copy.send.reviewTitle} />
            <SettingsCard contentStyle={styles.receiptContent}>
              {renderRecipientRow()}
              <Row
                divider
                label={copy.send.amountLabel}
                value={solAmountText}
                strong
              />
              <Row divider label={copy.send.reviewFee} value={feeText} />
              <Row divider label={copy.send.totalCostLabel} value={totalText} />
              <Row divider label={copy.send.reviewTotal} value={totalText} />
            </SettingsCard>
            {renderCaution()}

            {stepUpChrome.noticeVisible && stepUpChrome.noticeText ? (
              <CorsoText style={styles.subtitle}>
                {stepUpChrome.noticeText}
              </CorsoText>
            ) : null}

            {formError ? (
              <CorsoText style={styles.error}>{formError}</CorsoText>
            ) : null}

            <CorsoText style={styles.reviewFloor}>
              {copy.live.reviewFloor}
            </CorsoText>
            {/*
            Same slide, same door: `disabled={busy}` is the old
            SignDoor's predicate and the callback is the same `onConfirmSendSol`
            (its `reviewLamports === null` guard untouched).
            */}
            <SlideToConfirm
              label={copy.v1.confirmSend}
              accessibilityLabel={copy.v1.confirmSend}
              busy={busy}
              disabled={busy}
              onConfirm={() => {
                void onConfirmSendSol();
              }}
              style={styles.signDoor}
              testID="send-slide-to-confirm"
            />
            {busy ? (
              <CorsoText style={styles.confirming}>
                {copy.send.confirming}
              </CorsoText>
            ) : null}
          </ScrollView>
          <ScrollEdgeFade />
        </View>
        <StepUpSheet {...stepUp.sheet} />
      </SafeAreaView>
    );
  }

  const balanceHint =
    asset === 'SOL'
      ? solBalance.status === 'ready' && solBalance.lamports !== null
        ? solBalance.error || solBalance.refreshing
          ? copy.send.balanceLastKnown(formatSolBalanceFull(solBalance.lamports))
          : `Balance ${formatSolBalanceFull(solBalance.lamports)}`
        : null
      : usdcBalance.status === 'ready' && usdcBalance.atomic !== null
        ? usdcBalance.error || usdcBalance.refreshing
          ? copy.send.balanceLastKnown(formatUsdcBalanceFull(usdcBalance.atomic))
          : `Balance ${formatUsdcBalanceFull(usdcBalance.atomic)}`
        : null;

  // The scanner is a state of this sheet. Nothing is routed to.
  if (scannerOpen) {
    return (
      <SafeAreaView style={styles.safe}>
        {renderHeader(copy.send.title, () => setScannerOpen(false))}
        <ScrollView contentContainerStyle={styles.body}>
          <SendScanner
            ownerAddress={session?.address ?? null}
            cluster={cluster}
            onScanned={onScanned}
            onClose={() => setScannerOpen(false)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const reviewDisabled = !reviewEnabled;

  return (
    <SafeAreaView style={styles.safe}>
      {renderHeader(copy.send.title)}
      <View style={styles.scrollWrap}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <AccountSectionHeading label={copy.send.toLabel} first />
          <SettingsCard contentStyle={styles.fieldContent}>
            <View style={styles.fieldRow}>
              <TextInput
                style={styles.fieldInput}
                value={recipient}
                onChangeText={(text) => {
                  noteTextInputActivity(text, noteUserActivity, (next) => {
                    setRecipient(next);
                    setFormError(null);
                    setRecipientBlurred(false);
                    setScanNotice(null);
                  });
                }}
                onBlur={() => setRecipientBlurred(true)}
                placeholder={copy.send.toPlaceholder}
                placeholderTextColor={colors.inkTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={copy.send.toLabel}
              />
              <Pressable
                style={styles.fieldWell}
                hitSlop={FIELD_WELL_HIT_SLOP}
                onPress={() => {
                  void onPaste();
                }}
                accessibilityRole="button"
                accessibilityLabel={copy.send.paste}
              >
                <CorsoIcon name="copy" size={16} color={colors.inkTertiary} />
              </Pressable>
              <Pressable
                style={[
                  styles.fieldWell,
                  { backgroundColor: scanChrome.surfaceColor },
                ]}
                hitSlop={FIELD_WELL_HIT_SLOP}
                onPress={() => {
                  setScanNotice(null);
                  setScannerOpen(true);
                }}
                accessibilityRole={scanChrome.accessibilityRole}
                accessibilityLabel={scanChrome.accessibilityLabel}
                accessibilityHint={scanChrome.accessibilityHint}
                accessibilityState={scanChrome.accessibilityState}
              >
                <CorsoIcon
                  name={scanChrome.glyph}
                  size={16}
                  color={scanChrome.glyphColor}
                />
              </Pressable>
            </View>
            {recipientValid ? (
              <View style={styles.pastedRow}>
                <CorsoText style={styles.monoFull} selectable={false}>
                  {truncateAddress(recipient.trim())}
                </CorsoText>
                <TextButton
                  label={SEND_CLEAR_LABEL}
                  tone="action"
                  onPress={() => {
                    setRecipient('');
                    setFormError(null);
                    setRecipientBlurred(false);
                    setScanNotice(null);
                  }}
                />
              </View>
            ) : null}
          </SettingsCard>
          {scanNotice ? (
            <CorsoText
              style={styles.balanceHint}
              accessibilityLiveRegion="polite"
            >
              {scanNotice}
            </CorsoText>
          ) : null}

          {recents.length > 0 && recipient.trim().length === 0 ? (
            <SettingsCard contentStyle={styles.receiptContent}>
              <CorsoText style={styles.recentsLabel}>
                {copy.send.recentsLabel}
              </CorsoText>
              {recents.map((address) => (
                <Pressable
                  key={address}
                  style={styles.recentRow}
                  onPress={() => applyRecent(address)}
                  accessibilityRole="button"
                  accessibilityLabel={address}
                >
                  <CorsoText style={styles.recentAddress} accessible={false}>
                    {truncateAddress(address)}
                  </CorsoText>
                </Pressable>
              ))}
            </SettingsCard>
          ) : null}

          <AccountSectionHeading label={copy.send.amountLabel} />
          <SettingsCard contentStyle={styles.amountPane}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={(text) => {
                noteTextInputActivity(text, noteUserActivity, (next) => {
                  setAmount(next);
                  setFormError(null);
                  setAmountBlurred(false);
                });
              }}
              onBlur={() => setAmountBlurred(true)}
              placeholder={copy.send.amountPlaceholder}
              // WCAG treats placeholder text as text, and `theme.ts` already
              // assigns placeholders to `--ink48`; this one said `--ink28`.
              placeholderTextColor={colors.inkTertiary}
              keyboardType="decimal-pad"
              accessibilityLabel={copy.send.amountLabel}
            />
            {balanceHint ? (
              <CorsoText style={styles.amountSub}>{balanceHint}</CorsoText>
            ) : null}
            <View style={styles.quickAmounts}>
              <Pressable
                style={styles.chipBtn}
                hitSlop={CHIP_BTN_HIT_SLOP}
                onPress={onMax}
                accessibilityRole="button"
                accessibilityLabel={copy.send.max}
              >
                <CorsoText style={styles.chipBtnLabel}>
                  {copy.send.max}
                </CorsoText>
              </Pressable>
            </View>
          </SettingsCard>

          {/* The token selector pane: which asset the amount is denominated in. */}
          <SettingsCard contentStyle={styles.fieldContent}>
            <View style={styles.fieldRow}>
              <View style={styles.assetChips}>
                <Pressable
                  style={[styles.chip, asset === 'SOL' && styles.chipSelected]}
                  hitSlop={ASSET_CHIP_HIT_SLOP}
                  onPress={() => onSelectAsset('SOL')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: asset === 'SOL' }}
                >
                  <CorsoText
                    style={[
                      styles.chipText,
                      asset === 'SOL' && styles.chipTextSelected,
                    ]}
                  >
                    {copy.send.assetSol}
                  </CorsoText>
                </Pressable>
                <Pressable
                  style={[styles.chip, asset === 'USDC' && styles.chipSelected]}
                  hitSlop={ASSET_CHIP_HIT_SLOP}
                  onPress={() => onSelectAsset('USDC')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: asset === 'USDC' }}
                >
                  <CorsoText
                    style={[
                      styles.chipText,
                      asset === 'USDC' && styles.chipTextSelected,
                    ]}
                  >
                    {copy.send.assetUsdc}
                  </CorsoText>
                </Pressable>
              </View>
            </View>
          </SettingsCard>

          <SettingsCard contentStyle={styles.receiptContent}>
            <Row label={copy.send.feeLabel} value={feeLabel} />
            {asset === 'USDC' &&
            feeChrome.kind === 'ready' &&
            needsDestinationAta ? (
              <Row
                divider
                label={copy.send.rentLabel}
                value={formatFeeSol(ataRentLamports, copy.send.feeUnknown)}
              />
            ) : null}
            <Row
              divider
              label={copy.send.totalCostLabel}
              value={formatFeeSol(feeChrome.kind === 'ready' && feeLamports !== null && (asset !== 'SOL' || solLamports !== null)
                ? (asset === 'SOL' ? solLamports! : 0) + feeLamports + (asset === 'USDC' && needsDestinationAta ? ataRentLamports : 0)
                : null, feeChrome.kind === 'unavailable' ? feeChrome.label : copy.send.feeUnknown)}
            />
          </SettingsCard>
          {asset === 'USDC' && feeChrome.kind === 'ready' && needsDestinationAta ? (
            <CorsoText>{copy.send.rentRecovery}</CorsoText>
          ) : null}
          {feeChrome.retryVisible && feeChrome.retryLabel ? (
            <TextButton
              label={feeChrome.retryLabel}
              tone="action"
              onPress={() => {
                void refreshFeeEstimate();
              }}
            />
          ) : null}

          {composeError ? (
            <CorsoText style={styles.error}>{composeError}</CorsoText>
          ) : null}

          <PrimaryCTA
            tone="transactional"
            label={copy.send.review}
            onPress={onReview}
            disabled={reviewDisabled}
            accessibility={{ accessibilityLabel: copy.send.review }}
            style={styles.reviewCta}
          />
        </ScrollView>
        <ScrollEdgeFade />
      </View>
    </SafeAreaView>
  );
}

const CAUTION_TINT = 'rgba(217, 164, 65, 0.09)';
const CAUTION_INK = '#D9A441';

/** Ledger rows — label mute, value ink, hairline between. On screen, but not the send. */
function Row({
  label,
  value,
  divider = false,
  strong = false,
}: {
  label: string;
  value: string;
  /** Hairline above the row — every row but the first in a pane. */
  divider?: boolean;
  /** The amount row: bold, full ink. */
  strong?: boolean;
}) {
  return (
    <View style={[styles.receiptRow, divider && styles.receiptRowDivider]}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={[styles.receiptValue, strong && styles.receiptValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollWrap: { flex: 1, position: 'relative' },
  body: {
    paddingHorizontal: ETHENA_BODY_MARGIN,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.smd,
  },
  subtitle: {
    marginTop: spacing.sm,
    color: colors.inkTertiary,
    fontFamily: typography.face('450'),
    ...ETHENA_TYPE.sub,
    fontWeight: canonWeight('450'),
  },
  /** `.field{padding:8px 8px 8px 16px}` — the wells eat the right inset. */
  fieldContent: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  /** The rows pane: hairline rows carry their own rhythm, the pane only insets. */
  receiptContent: {
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    minHeight: 44,
  },
  /** `.field input{font-size:13.5px;font-weight:500}` — no inner box. */
  fieldInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    color: colors.ink,
    fontFamily: typography.face('500'),
    fontSize: CANON_TYPE_SIZES.rowLabel,
    fontWeight: canonWeight('500'),
    paddingVertical: 0,
  },
  fieldWell: {
    width: FIELD_WELL_SIZE,
    height: FIELD_WELL_SIZE,
    borderRadius: radii.pill,
    backgroundColor: ONGLASS,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipBtn: {
    minHeight: CHIP_BTN_MIN_HEIGHT,
    paddingHorizontal: 11,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: ONGLASS_HI,
    borderRadius: radii.pill,
  },
  chipBtnLabel: {
    color: colors.inkSecondary,
    fontFamily: typography.face('560'),
    fontSize: CANON_TYPE_SIZES.meta,
    fontWeight: canonWeight('560'),
  },
  pastedRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceHint: {
    color: colors.inkTertiary,
    fontFamily: typography.face('500'),
    fontSize: CANON_TYPE_SIZES.sub,
    fontWeight: canonWeight('500'),
  },
  recentsLabel: {
    paddingTop: spacing.sm,
    color: colors.inkTertiary,
    fontFamily: typography.face('500'),
    fontSize: CANON_TYPE_SIZES.sub,
    fontWeight: canonWeight('500'),
  },
  recentRow: {
    minHeight: 44,
    justifyContent: 'center',
  },
  recentAddress: {
    color: colors.ink,
    fontFamily: typography.face('500'),
    fontSize: typography.mono,
    fontWeight: '500',
    fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
  },
  /** `.amt-pane{padding:26px 18px 18px;gap:4px}` — the amount is the hero. */
  amountPane: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 26,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  /** `.amt-in input{font-size:40px;font-weight:660;letter-spacing:-.024em}` */
  amountInput: {
    alignSelf: 'stretch',
    textAlign: 'center',
    color: colors.ink,
    fontFamily: typography.face('660'),
    ...ETHENA_TYPE.amount,
    paddingVertical: 0,
    fontVariant: canonNumerals(),
  },
  amountSub: {
    color: colors.inkTertiary,
    fontFamily: typography.face('500'),
    fontSize: CANON_TYPE_SIZES.body,
    fontWeight: canonWeight('500'),
    fontVariant: canonNumerals(),
  },
  /** `.qamt{gap:6px;margin-top:16px}` */
  quickAmounts: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  assetChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    flex: 1,
  },
  /** Asset chips on glass; the selected one is ink, never azure. */
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  chipSelected: {
    backgroundColor: colors.ink,
  },
  chipText: {
    color: colors.ink,
    fontFamily: typography.face('560'),
    fontSize: CANON_TYPE_SIZES.body,
    fontWeight: canonWeight('560'),
  },
  chipTextSelected: {
    color: colors.canvas,
  },
  receiptRow: {
    flexWrap: 'wrap',
    rowGap: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  receiptRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceStroke,
  },
  receiptLabel: {
    color: colors.inkTertiary,
    fontFamily: typography.face('550'),
    fontSize: CANON_TYPE_SIZES.meta,
    fontWeight: canonWeight('550'),
  },
  receiptValue: {
    maxWidth: '100%',
    marginLeft: 'auto',
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontSize: CANON_TYPE_SIZES.body,
    fontWeight: canonWeight('600'),
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: canonNumerals(),
  },
  receiptValueStrong: {
    fontSize: CANON_TYPE_SIZES.cardTitle,
    fontFamily: typography.face('650'),
    fontWeight: canonWeight('650'),
  },
  receiptAddress: {
    letterSpacing: 0.2,
    fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
  },
  /** The review hero — the amount, then who it is going to. */
  reviewHero: {
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    gap: 4,
  },
  reviewHeroValue: {
    textAlign: 'center',
    color: colors.ink,
    fontSize: typography.amount,
    fontFamily: typography.face('660'),
    fontWeight: canonWeight('660'),
    letterSpacing: canonTracking(typography.amount, -0.024),
    lineHeight: Math.round(typography.amount * 1.1),
    fontVariant: canonNumerals(),
  },
  reviewHeroSub: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.sub,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  reviewHeroSubStrong: {
    color: colors.inkSecondary,
    fontFamily: typography.face('560'),
    fontWeight: canonWeight('560'),
  },
  /** The first-send caution: amber tint, radius 12, dot + `Caution · body`. */
  caution: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: CAUTION_TINT,
  },
  cautionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: CAUTION_INK,
  },
  cautionText: {
    flex: 1,
    color: colors.inkSecondary,
    fontFamily: typography.face('500'),
    fontSize: CANON_TYPE_SIZES.sub,
    fontWeight: canonWeight('500'),
  },
  cautionTitle: {
    color: CAUTION_INK,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  reviewFloor: {
    marginTop: spacing.xs,
    textAlign: 'center',
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  signDoor: {
    marginTop: 0,
  },
  confirming: {
    textAlign: 'center',
    color: colors.inkTertiary,
    fontFamily: typography.face('500'),
    fontSize: CANON_TYPE_SIZES.sub,
    fontWeight: canonWeight('500'),
  },
  reviewCta: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
    marginBottom: 0,
  },
  error: {
    color: colors.destructive,
    fontFamily: typography.face('550'),
    fontSize: CANON_TYPE_SIZES.body,
    fontWeight: canonWeight('550'),
  },
  successAmount: {
    marginTop: spacing.lg,
    fontFamily: typography.face('660'),
    fontSize: typography.amount,
    fontWeight: canonWeight('660'),
    letterSpacing: canonTracking(typography.amount, -0.024),
    color: colors.ink,
    fontVariant: canonNumerals(),
  },
  mono: {
    marginTop: spacing.md,
    fontFamily: typography.face('500'),
    color: colors.inkTertiary,
    fontSize: typography.mono,
    fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
  },
  monoFull: {
    fontFamily: typography.face('500'),
    color: colors.inkTertiary,
    fontSize: typography.mono,
    lineHeight: 18,
    fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
  },
});
