import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import { useMfa, useMfaEnrollment, usePrivy } from '@privy-io/expo';
import { copy } from '@/constants/copy';
import { colors, radii, spacing, typography } from '@/constants/theme';
import { Scrim } from '@/src/ui/primitives/Scrim';
import { resolveBottomSheetBottomInset } from '@/src/ui/primitives/bottomSheetPresentation';
import { useKeyboardOverlapInset } from '@/src/ui/primitives/useKeyboardOverlapInset';
import { sessionIdentityKey } from '@/src/features/security/mfaSessionGuard';
import { resolveStepUpAccessibility } from '@/src/features/security/stepUpAccessibility';
import { resolveStepUpSheetPaint } from '@/src/features/security/stepUpSheetPaint';
import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA';
import {
  applyCaptureSetupResult,
  canPaintTotpSecret,
  canStartTotpEnrollment,
  isEnrollCtaDisabled,
  shouldAcceptEnrollmentSecret,
  type TotpCaptureState,
} from '@/src/features/security/totpEnrollCaptureLogic';
import { totpEnrollmentBuffer } from '@/src/features/security/totpEnrollmentBuffer';
import type { CorsoSession } from '@/src/features/session/types';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { noteTextInputActivity } from '@/src/features/session/sessionGate';
import { trackEvent } from '@/src/lib/analytics';
import { usePasscodeWait } from '@/src/features/security/usePasscodeWait';

export type StepUpMode = 'enroll' | 'verify' | 'app_lock';

const ENROLL_CAPTURE_KEY = 'corso-stepup-enroll';

function mfaErrorKind(
  error: unknown,
): 'locked' | 'timeout' | 'mismatch' | 'unavailable' {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  if (msg.includes('max') || msg.includes('rate') || msg.includes('attempt')) {
    return 'locked';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'timeout';
  }
  if (
    msg.includes('verif') ||
    msg.includes('invalid') ||
    msg.includes('incorrect')
  ) {
    return 'mismatch';
  }
  return 'unavailable';
}

type Props = {
  visible: boolean;
  mode: StepUpMode;
  thresholdLabel: string;
  /** Explicit settings enrollment can use mechanism copy instead of threshold copy. */
  enrollmentBody?: string;
  surface: 'swap' | 'send';
  /**
   * Session identity at sheet open — reported to the owner on factor complete.
   * Sheet never marks the step-up cache; only the root/local owner may mark
   * after an atomic same-session check against the pending op.
   */
  session: CorsoSession | null;
  /**
   * Factor completed. Payload is the session key the sheet claims the factor
   * belongs to (`type:address` or null). Owner validates before any cache mark.
   */
  onVerified: (completedSessionKey: string | null) => void;
  onAppLockPasscode?: (passcode: string) => Promise<'ok' | 'wrong' | 'error'>;
  onCancel: () => void;
};

export function StepUpSheet({
  visible,
  mode,
  thresholdLabel,
  enrollmentBody,
  surface,
  session,
  onVerified,
  onAppLockPasscode,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardOverlapInset();
  const paint = resolveStepUpSheetPaint({
    increaseContrast: useInkContrastEnabled(),
  });
  const { noteUserActivity } = useCorsoSession();
  const { user } = usePrivy();
  const { init, submit, cancel } = useMfa();
  const { initMfaEnrollment, submitMfaEnrollment } = useMfaEnrollment();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passcodeWait = usePasscodeWait(visible && mode === 'app_lock');
  /** Epoch forces re-paint of secret hint without storing secret in state. */
  const [secretEpoch, setSecretEpoch] = useState(0);
  const [phase, setPhase] = useState<'prompt' | 'code'>('prompt');
  const [captureState, setCaptureState] = useState<TotpCaptureState>('idle');
  const captureNonceRef = useRef(0);
  const captureStateRef = useRef<TotpCaptureState>('idle');
  const liveSessionRef = useRef(session);
  const enrollmentSessionKeyRef = useRef<string | null>(null);
  captureStateRef.current = captureState;
  liveSessionRef.current = session;

  const relyingParty =
    process.env.EXPO_PUBLIC_PRIVY_MFA_RELYING_PARTY?.trim() || undefined;

  useEffect(() => {
    if (!visible) {
      setCode('');
      setError(null);
      setBusy(false);
      totpEnrollmentBuffer.clear();
      setSecretEpoch((n) => n + 1);
      setPhase('prompt');
      setCaptureState('idle');
      enrollmentSessionKeyRef.current = null;
      captureNonceRef.current += 1; // invalidate any in-flight capture/enroll
    }
  }, [visible]);

  // Capture / Recents protection MUST complete before enrollment can init secret.
  useEffect(() => {
    if (!visible || mode !== 'enroll') {
      setCaptureState('idle');
      return;
    }
    const requestNonce = captureNonceRef.current + 1;
    captureNonceRef.current = requestNonce;
    setCaptureState('pending');
    totpEnrollmentBuffer.clear();
    setSecretEpoch((n) => n + 1);

    void (async () => {
      let ok = false;
      try {
        await ScreenCapture.preventScreenCaptureAsync(ENROLL_CAPTURE_KEY);
        if (Platform.OS === 'ios') {
          try {
            await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
          } catch {
            // best-effort overlay — preventScreenCapture already succeeded
          }
        }
        ok = true;
      } catch {
        ok = false;
      }
      const next = applyCaptureSetupResult({
        requestNonce,
        currentNonce: captureNonceRef.current,
        ok,
      });
      if (next === 'stale') return;
      setCaptureState(next);
      if (next === 'failed') {
        totpEnrollmentBuffer.clear();
        setSecretEpoch((n) => n + 1);
        setError(copy.stepup.enrollFailed);
        setPhase('prompt');
      }
    })();

    return () => {
      // Invalidate in-flight setup so late success cannot enable enroll/secret.
      captureNonceRef.current += 1;
      setCaptureState('idle');
      void ScreenCapture.allowScreenCaptureAsync(ENROLL_CAPTURE_KEY);
      if (Platform.OS === 'ios') {
        void ScreenCapture.disableAppSwitcherProtectionAsync();
      }
      totpEnrollmentBuffer.clear();
      setSecretEpoch((n) => n + 1);
    };
  }, [visible, mode]);

  const enrolledMethods =
    user?.mfa_methods?.map((m) => m.type).filter(Boolean) ?? [];
  const hasTotp = enrolledMethods.includes('totp');
  const hasPasskey = enrolledMethods.includes('passkey');

  /**
   * Report completed factor identity to the owner. Never marks cache here.
   * Missing session → null key so owner fails closed (no anonymous mark).
   */
  function reportFactorCompleted(): void {
    onVerified(sessionIdentityKey(session));
  }

  async function onEnrollStart() {
    // Hard gate: never call provider enroll / receive secret until capture ready.
    if (!canStartTotpEnrollment(captureStateRef.current)) {
      setError(copy.stepup.enrollFailed);
      return;
    }
    const enrollNonce = captureNonceRef.current;
    const startedSessionKey = sessionIdentityKey(liveSessionRef.current);
    if (
      !startedSessionKey ||
      liveSessionRef.current?.type !== 'privy_embedded'
    ) {
      setError(copy.stepup.unavailable);
      return;
    }
    enrollmentSessionKeyRef.current = startedSessionKey;
    setBusy(true);
    setError(null);
    trackEvent('stepup_enroll_started', { session_type: 'privy_embedded' });
    try {
      const result = await initMfaEnrollment({ method: 'totp' });
      if (sessionIdentityKey(liveSessionRef.current) !== startedSessionKey) {
        totpEnrollmentBuffer.clear();
        enrollmentSessionKeyRef.current = null;
        setPhase('prompt');
        return;
      }
      // Ignore late async results after unmount / capture invalidation / fail.
      if (
        !shouldAcceptEnrollmentSecret({
          requestNonce: enrollNonce,
          currentNonce: captureNonceRef.current,
          captureState: captureStateRef.current,
        })
      ) {
        totpEnrollmentBuffer.clear();
        enrollmentSessionKeyRef.current = null;
        setSecretEpoch((n) => n + 1);
        setPhase('prompt');
        return;
      }
      // Secret stays in module buffer only — never useState / selectable props.
      totpEnrollmentBuffer.set(result.secret ?? null);
      setSecretEpoch((n) => n + 1);
      setPhase('code');
    } catch {
      totpEnrollmentBuffer.clear();
      enrollmentSessionKeyRef.current = null;
      setSecretEpoch((n) => n + 1);
      setError(copy.stepup.enrollFailed);
      setPhase('prompt');
      trackEvent('stepup_enroll_failed', {
        session_type: 'privy_embedded',
        reason: 'init_failed',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onEnrollSubmit() {
    if (code.trim().length < 6) return;
    const startedSessionKey = enrollmentSessionKeyRef.current;
    if (
      !startedSessionKey ||
      sessionIdentityKey(liveSessionRef.current) !== startedSessionKey
    ) {
      totpEnrollmentBuffer.clear();
      setPhase('prompt');
      setError(copy.stepup.unavailable);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitMfaEnrollment({ method: 'totp', code: code.trim() });
      if (sessionIdentityKey(liveSessionRef.current) !== startedSessionKey) {
        totpEnrollmentBuffer.clear();
        enrollmentSessionKeyRef.current = null;
        setPhase('prompt');
        return;
      }
      totpEnrollmentBuffer.clear();
      enrollmentSessionKeyRef.current = null;
      setSecretEpoch((n) => n + 1);
      // Identity required for owner mark — report null if missing (owner fails closed).
      if (!sessionIdentityKey(session)) {
        setError(copy.stepup.unavailable);
        onVerified(null);
        return;
      }
      trackEvent('stepup_enroll_succeeded', { session_type: 'privy_embedded' });
      reportFactorCompleted();
    } catch {
      setError(copy.stepup.enrollFailed);
      trackEvent('stepup_enroll_failed', {
        session_type: 'privy_embedded',
        reason: 'submit_failed',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyTotp() {
    setBusy(true);
    setError(null);
    try {
      if (phase === 'prompt') {
        await init({ method: 'totp' });
        setPhase('code');
        return;
      }
      await submit({ method: 'totp', mfaCode: code.trim() });
      if (!sessionIdentityKey(session)) {
        setError(copy.stepup.unavailable);
        onVerified(null);
        return;
      }
      trackEvent('stepup_verify_succeeded', { session_type: 'privy_embedded' });
      reportFactorCompleted();
    } catch (e) {
      handleVerifyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyPasskey() {
    if (!relyingParty) {
      setError(copy.stepup.unavailable);
      trackEvent('stepup_blocked', {
        surface,
        reason: 'relying_party_missing',
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const options = await init({ method: 'passkey', relyingParty });
      await submit({
        method: 'passkey',
        mfaCode: options,
        relyingParty,
      });
      if (!sessionIdentityKey(session)) {
        setError(copy.stepup.unavailable);
        onVerified(null);
        return;
      }
      trackEvent('stepup_verify_succeeded', { session_type: 'privy_embedded' });
      reportFactorCompleted();
    } catch (e) {
      handleVerifyError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitAppLockPasscode() {
    if (code.length !== 6 || !onAppLockPasscode || passcodeWait.wait) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onAppLockPasscode(code);
      if (result === 'wrong') {
        setCode('');
        setError(copy.stepup.appLockWrong);
      } else if (result === 'error') {
        setError(copy.stepup.unavailable);
      }
    } catch (caught) {
      if (!passcodeWait.acceptError(caught)) setError(copy.stepup.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function handleVerifyError(e: unknown) {
    const kind = mfaErrorKind(e);
    if (kind === 'locked') {
      setError(copy.stepup.verifyLocked);
    } else if (kind === 'mismatch') {
      setError(copy.stepup.verifyFailed);
    } else {
      setError(copy.stepup.unavailable);
    }
    trackEvent('stepup_verify_failed', {
      session_type: 'privy_embedded',
      reason: kind,
    });
  }

  function onPressCancel() {
    if (mode !== 'app_lock') cancel();
    totpEnrollmentBuffer.clear();
    setSecretEpoch((n) => n + 1);
    trackEvent('stepup_blocked', { surface, reason: 'cancelled' });
    onCancel();
  }

  const title =
    mode === 'enroll'
      ? copy.stepup.enrollTitle
      : mode === 'app_lock'
        ? copy.stepup.appLockTitle
        : copy.stepup.verifyTitle;
  const body =
    mode === 'enroll'
      ? (enrollmentBody ?? copy.stepup.enrollBody(thresholdLabel))
      : mode === 'app_lock'
        ? copy.stepup.appLockBody(thresholdLabel)
        : copy.stepup.verifyBody(thresholdLabel);

  // Read secret only at paint from module buffer — not from React state.
  // Capture must be ready; secretEpoch is non-secret re-render trigger. Never selectable.
  const secretForPaint =
    mode === 'enroll' &&
    phase === 'code' &&
    canPaintTotpSecret({
      captureState,
      secret: totpEnrollmentBuffer.peek(),
    })
      ? totpEnrollmentBuffer.peek()
      : null;
  void secretEpoch;

  const enrollDisabled = isEnrollCtaDisabled({
    captureState,
    busy,
    phase,
  });
  const a11y = resolveStepUpAccessibility({
    mode: mode === 'app_lock' ? 'verify' : mode,
    phase,
    busy,
    capturePending: captureState === 'pending',
    enrollDisabled,
    copy: {
      enrollCta: copy.stepup.enrollCta,
      verifyCta: copy.stepup.verifyWithTotp,
      enrollCancel: copy.stepup.enrollCancel,
      verifyCancel: copy.stepup.verifyCancel,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onPressCancel}
    >
      <View
        style={
          keyboardInset > 0
            ? [styles.backdrop, { paddingBottom: keyboardInset }]
            : styles.backdrop
        }
      >
        <Scrim />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: paint.sheetFill,
              borderTopWidth: paint.topEdgeWidth,
              borderTopColor: paint.topEdgeColor,
              paddingBottom: resolveBottomSheetBottomInset(insets.bottom),
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.grabber} accessible={false} />
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[styles.body, { color: paint.bodyInk }]}>{body}</Text>

          {secretForPaint ? (
            <Text
              style={[styles.secretHint, { backgroundColor: paint.wellFill }]}
              selectable={false}
              {...a11y.secret}
            >
              {secretForPaint}
            </Text>
          ) : null}

          {(mode === 'verify' && phase === 'code') ||
          (mode === 'enroll' && phase === 'code') ||
          mode === 'app_lock' ? (
            <TextInput
              style={[styles.codeInput, { backgroundColor: paint.wellFill }]}
              value={code}
              onChangeText={(text) => {
                const next =
                  mode === 'app_lock'
                    ? text.replace(/\D/g, '').slice(0, 6)
                    : text;
                noteTextInputActivity(next, noteUserActivity, setCode);
              }}
              keyboardType="number-pad"
              autoComplete={mode === 'app_lock' ? 'off' : 'one-time-code'}
              placeholder={copy.stepup.codePlaceholder}
              placeholderTextColor={paint.placeholderInk}
              maxLength={mode === 'app_lock' ? 6 : 8}
              secureTextEntry={mode === 'app_lock'}
              editable={!busy && passcodeWait.wait === null}
              accessibilityLabel={
                passcodeWait.accessibilityLabel ?? a11y.codeInput.accessibilityLabel
              }
              accessibilityState={{
                disabled: busy || passcodeWait.wait !== null,
              }}
            />
          ) : null}

          {(passcodeWait.line ?? error) ? (
            <Text
              style={styles.error}
              accessibilityRole={passcodeWait.wait ? undefined : a11y.error.accessibilityRole}
              accessibilityLiveRegion={
                passcodeWait.wait ? 'none' : a11y.error.accessibilityLiveRegion
              }
            >
              {passcodeWait.line ?? error}
            </Text>
          ) : null}

          {mode === 'app_lock' && passcodeWait.wait ? (
            <Text style={styles.error}>{copy.v1.nothingMoved}</Text>
          ) : null}

          {mode === 'app_lock' ? (
            <PrimaryCTA
              label={copy.stepup.verifyCta}
              disabled={code.length !== 6 || passcodeWait.wait !== null}
              busy={busy}
              onPress={() => {
                void onSubmitAppLockPasscode();
              }}
              accessibility={{
                accessibilityLabel:
                  passcodeWait.accessibilityLabel ?? copy.stepup.verifyCta,
                accessibilityState: {
                  disabled:
                    busy || code.length !== 6 || passcodeWait.wait !== null,
                },
              }}
            />
          ) : mode === 'enroll' ? (
            <PrimaryCTA
              label={
                phase === 'prompt'
                  ? copy.stepup.enrollCta
                  : copy.stepup.verifyWithTotp
              }
              disabled={enrollDisabled}
              busy={busy || captureState === 'pending'}
              onPress={() => {
                void (phase === 'prompt' ? onEnrollStart() : onEnrollSubmit());
              }}
              accessibility={{
                accessibilityLabel: a11y.primary.accessibilityLabel,
                accessibilityState: a11y.primary.accessibilityState,
              }}
            />
          ) : (
            <>
              {(hasTotp || enrolledMethods.length === 0) && (
                <PrimaryCTA
                  label={copy.stepup.verifyWithTotp}
                  busy={busy}
                  onPress={() => {
                    void onVerifyTotp();
                  }}
                  accessibility={{
                    accessibilityLabel: a11y.primary.accessibilityLabel,
                    accessibilityState: a11y.primary.accessibilityState,
                  }}
                />
              )}
              {hasPasskey && relyingParty ? (
                <SecondaryCTA
                  label={copy.stepup.verifyWithPasskey}
                  disabled={busy}
                  onPress={() => {
                    void onVerifyPasskey();
                  }}
                />
              ) : null}
            </>
          )}

          <Pressable
            style={styles.cancel}
            onPress={onPressCancel}
            disabled={busy}
            accessibilityRole={a11y.cancel.accessibilityRole}
            accessibilityLabel={a11y.cancel.accessibilityLabel}
            accessibilityState={a11y.cancel.accessibilityState}
          >
            <Text
              style={[styles.cancelLabel, { color: paint.cancelInk }]}
              accessible={false}
            >
              {mode === 'enroll'
                ? copy.stepup.enrollCancel
                : copy.stepup.verifyCancel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    zIndex: 1,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: typography.fontFamily,
    fontSize: typography.title,
    fontWeight: '600',
    color: colors.ink,
  },
  body: {
    fontFamily: typography.fontFamily,
    fontSize: typography.body,
  },
  secretHint: {
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    color: colors.ink,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  codeInput: {
    fontFamily: typography.fontFamily,
    fontSize: typography.title,
    letterSpacing: 6,
    color: colors.ink,
    borderRadius: radii.sm,
    padding: spacing.md,
    textAlign: 'center',
  },
  error: {
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
    color: colors.ink,
  },
  cancel: { alignItems: 'center', padding: spacing.sm },
  cancelLabel: {
    fontFamily: typography.fontFamily,
    fontSize: typography.caption,
  },
  disabled: { opacity: 0.45 },
});
