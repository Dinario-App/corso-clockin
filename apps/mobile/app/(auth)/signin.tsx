import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  useEmbeddedSolanaWallet,
  usePrivy,
  isCreating,
  isConnecting,
  isNotCreated,
  isConnected,
  isReconnecting,
  needsRecovery,
  hasError,
} from '@privy-io/expo';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { resolveFirstRunHref } from '@/src/features/howItWorks/howItWorksPreference';
import {
  HOME_HREF,
  HOW_IT_WORKS_HREF,
} from '@/src/features/howItWorks/howItWorksPresentation';
import { recordFirstRunIntent } from '@/src/features/onboarding/firstRunOnboarding';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { resolveSignInAccessibility } from '@/src/features/session/signInAccessibility';
import {
  isAlreadyLoggedInError,
  mapSignInError,
  resolveOAuthSignInError,
  type SignInErrorKind,
  type SignInOtpStep,
} from '@/src/features/session/signInErrorMap';
import {
  resolveSignInBackAffordance,
  resolveSignInChrome,
  resolveSignInHelperText,
  resolveSignInProvisionFrame,
  resolveSignInSourceState,
} from '@/src/features/session/signInRoutePresentation';
import { resolveWalletErrorRecovery } from '@/src/features/session/sessionGate';
import { clearPerUserLocalStores } from '@/src/features/session/localClearRegistry';
import {
  armPendingSignOutClear,
  finishPendingSignOutClear,
} from '@/src/features/session/pendingSignOutClear';
import { isAppleSignInEnabled } from '@/src/features/security/config';
import { trackEvent } from '@/src/lib/analytics';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { EthenaGround, EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { HeaderRow } from '@/src/ui/navigation/HeaderRow';
import { resolveKeyboardAvoidanceBehavior } from '@/src/ui/primitives/keyboardAvoidancePresentation';
import { OneSecondWhenSlow } from '@/src/ui/state/OneSecond';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

type Method = 'email' | 'google' | 'apple' | 'resume';

/** Fail visibly sooner than the 30s contract ceiling so Sign out / Try again appear. */
const PROVISION_TIMEOUT_MS = 12_000;

export default function SignInScreen() {
  const params = useLocalSearchParams<{ method?: string }>();
  // Preserve base Privy methods; unknown methods fall back to email.
  if (
    params.method &&
    params.method !== 'email' &&
    params.method !== 'google' &&
    params.method !== 'apple' &&
    params.method !== 'resume'
  ) {
    return (
      <Redirect
        href={{ pathname: '/(auth)/signin', params: { method: 'email' } }}
      />
    );
  }
  return <PrivySignInScreen />;
}

function PrivySignInScreen() {
  const params = useLocalSearchParams<{ method?: string }>();
  const method = (params.method as Method) || 'email';
  const { session, needsLockSetup, locked, retrySessionRestore } =
    useCorsoSession();
  const { user, logout } = usePrivy();
  // Email reads the same new-user bit as Google.
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onLoginSuccess: (_user, isNewUser) => {
      recordFirstRunIntent(isNewUser === true ? 'new' : 'restore');
    },
  });
  const oauth = useLoginWithOAuth();
  const oauthLoginInFlight = useRef(false);
  const oauthState = oauth.state;
  useEffect(() => {
    if (!oauthLoginInFlight.current || oauthState.status !== 'done') return;
    oauthLoginInFlight.current = false;
    recordFirstRunIntent(oauthState.isNewUser === true ? 'new' : 'restore');
  }, [oauthState]);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [otpErrorKind, setOtpErrorKind] = useState<SignInErrorKind>('none');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionTimedOut, setProvisionTimedOut] = useState(false);
  const [provisionAttempt, setProvisionAttempt] = useState(0);
  const lastOtpStep = useRef<SignInOtpStep>('send');
  const oauthStarted = useRef(false);
  const createStarted = useRef(false);
  const errorRedriveAttempted = useRef(false);
  const signInTracked = useRef(false);
  const signInStartedTracked = useRef(false);
  const [firstRunHref, setFirstRunHref] = useState<
    typeof HOME_HREF | typeof HOW_IT_WORKS_HREF | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void resolveFirstRunHref(AsyncStorage).then((href) => {
      if (!cancelled) setFirstRunHref(href);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (method === 'resume' || signInStartedTracked.current) return;
    if (method !== 'email' && method !== 'google' && method !== 'apple') return;
    signInStartedTracked.current = true;
    trackEvent('privy_signin_started', { method });
  }, [method]);

  const onCreateWalletSuccess = useCallback(() => {
    createStarted.current = false;
    setError(null);
    setProvisionTimedOut(false);
    setProvisioning(true);
  }, []);

  const onCreateWalletError = useCallback(
    (err: Error) => {
      createStarted.current = false;
      setError(err.message || copy.signin.errorProvision);
      setProvisionTimedOut(true);
      trackEvent('privy_signin_failed', {
        method,
        error_code: 'provision_failed',
      });
    },
    [method],
  );

  const solanaWallet = useEmbeddedSolanaWallet({
    onCreateWalletSuccess,
    onCreateWalletError,
    onRecoverWalletSuccess: onCreateWalletSuccess,
    onRecoverWalletError: onCreateWalletError,
  });

  const ensureWallet = useCallback(
    (opts?: { force?: boolean }) => {
      if (!user) return;
      if (opts?.force) {
        createStarted.current = false;
        errorRedriveAttempted.current = false;
        setError(null);
        setProvisionTimedOut(false);
        setProvisionAttempt((attempt) => attempt + 1);
      }
      setProvisioning(true);
      if (createStarted.current) return;
      if (isConnected(solanaWallet)) return;
      if (
        isCreating(solanaWallet) ||
        isConnecting(solanaWallet) ||
        isReconnecting(solanaWallet)
      ) {
        return;
      }

      if (hasError(solanaWallet)) {
        if (
          resolveWalletErrorRecovery({
            hasPrivyUser: Boolean(user),
            redriveAttempted: errorRedriveAttempted.current,
          }) === 'redrive'
        ) {
          errorRedriveAttempted.current = true;
          void solanaWallet.getProvider().catch(() => {});
          return;
        }
        const message =
          'error' in solanaWallet && typeof solanaWallet.error === 'string'
            ? solanaWallet.error
            : copy.signin.errorProvision;
        setError(message);
        setProvisionTimedOut(true);
        return;
      }

      if (needsRecovery(solanaWallet)) {
        createStarted.current = true;
        void solanaWallet.recover().then((provider) => {
          // Android AuthSession bug: null does not mean failure — wait for callback / connected.
          if (provider === null) return;
          createStarted.current = false;
        });
        return;
      }

      if (isNotCreated(solanaWallet)) {
        createStarted.current = true;
        void solanaWallet.create().then((provider) => {
          // Android Google-Drive recovery path returns null; success arrives via callback.
          if (provider === null) return;
          createStarted.current = false;
        });
      }
    },
    [user, solanaWallet],
  );

  // Privy session already open (e.g. prior Email) but Corso wallet not ready yet.
  useEffect(() => {
    if (!user || session) return;
    setProvisioning(true);
  }, [user, session]);

  // Drive create / recover while provisioning.
  useEffect(() => {
    if (!user || !provisioning || session) return;
    if (isConnected(solanaWallet)) return;
    if (
      isCreating(solanaWallet) ||
      isConnecting(solanaWallet) ||
      isReconnecting(solanaWallet)
    ) {
      return;
    }
    if (createStarted.current) return;
    ensureWallet();
  }, [user, provisioning, session, solanaWallet, ensureWallet]);

  // Never spin forever — surface Try again + keep Sign out visible.
  useEffect(() => {
    if (!provisioning || session) {
      setProvisionTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setProvisionTimedOut(true);
      setError((prev) => prev ?? copy.signin.errorProvision);
    }, PROVISION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [provisioning, session, provisionAttempt]);

  // Navigate only once CorsoSession is formed (wallet connected + address).
  useEffect(() => {
    if (!provisioning || !session) return;
    if (!signInTracked.current) {
      signInTracked.current = true;
      const resolvedMethod = method === 'resume' ? 'email' : method || 'email';
      trackEvent('sign_in', { method: resolvedMethod, door: 'privy' });
      trackEvent('privy_signin_succeeded', { method: resolvedMethod });
      trackEvent('privy_wallet_provisioned');
      trackEvent('wallet_created', { door: 'privy' });
    }
    if (!needsLockSetup && !locked) {
      if (firstRunHref == null) return;
      if (firstRunHref === HOW_IT_WORKS_HREF) {
        router.replace(firstRunHref);
        return;
      }
    }
    router.replace(
      needsLockSetup
        ? '/(auth)/lock-setup'
        : locked
          ? '/(auth)/unlock'
          : '/(app)',
    );
  }, [provisioning, session, needsLockSetup, locked, method, firstRunHref]);

  const startOAuth = useCallback(
    async (provider: 'google' | 'apple') => {
      if (provider === 'apple' && !isAppleSignInEnabled()) {
        setError(copy.signin.errorProviderUnavailable);
        return;
      }
      if (user) {
        setProvisioning(true);
        setBusy(false);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        oauthLoginInFlight.current = true;
        await oauth.login({ provider });
        setProvisioning(true);
      } catch (e) {
        oauthLoginInFlight.current = false;
        if (isAlreadyLoggedInError(e)) {
          setProvisioning(true);
          setBusy(false);
          return;
        }
        const oauthError = resolveOAuthSignInError(e);
        setBusy(false);
        setError(oauthError);
        if (oauthError === null) {
          router.replace('/(auth)/welcome');
          return;
        }
        trackEvent('privy_signin_failed', {
          method: provider,
          error_code: 'oauth_failed',
        });
        setBusy(false);
      }
    },
    [oauth, user],
  );

  useEffect(() => {
    if (method === 'resume') return;
    if (method !== 'google' && method !== 'apple') return;
    if (oauthStarted.current) return;
    oauthStarted.current = true;
    void startOAuth(method);
  }, [method, startOAuth]);

  function onProvisionRetry() {
    retrySessionRestore();
    ensureWallet({ force: true });
  }

  async function onSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await armPendingSignOutClear();
      await logout();
      const signOutClear = await clearPerUserLocalStores('sign-out');
      await finishPendingSignOutClear(signOutClear);
      createStarted.current = false;
      oauthStarted.current = false;
      setProvisioning(false);
      setProvisionTimedOut(false);
      setBusy(false);
      router.replace('/(auth)/welcome');
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.signin.errorNetwork);
    } finally {
      setSigningOut(false);
    }
  }

  function applyOtpFailure(e: unknown, step: SignInOtpStep) {
    const kind = mapSignInError(e, step);
    if (kind === 'alreadyIn') {
      setOtpErrorKind('alreadyIn');
      setProvisioning(true);
      setBusy(false);
      return;
    }
    setOtpErrorKind(kind);
    if (step === 'verify' && kind === 'badCode') {
      trackEvent('privy_signin_failed', {
        method: 'email',
        error_code: 'bad_code',
      });
    }
    setBusy(false);
  }

  async function onSendCode() {
    lastOtpStep.current = 'send';
    setBusy(true);
    setOtpErrorKind('none');
    try {
      await sendCode({ email: email.trim() });
      setCodeSent(true);
    } catch (e) {
      applyOtpFailure(e, 'send');
      return;
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCode() {
    lastOtpStep.current = 'verify';
    setBusy(true);
    setOtpErrorKind('none');
    try {
      await loginWithCode({ code: code.trim(), email: email.trim() });
      setProvisioning(true);
    } catch (e) {
      applyOtpFailure(e, 'verify');
      return;
    }
    setBusy(false);
  }

  async function onResendCode() {
    lastOtpStep.current = 'send';
    setBusy(true);
    setOtpErrorKind('none');
    try {
      await sendCode({ email: email.trim() });
    } catch (e) {
      applyOtpFailure(e, 'send');
      return;
    } finally {
      setBusy(false);
    }
  }

  function onOtpBack() {
    if (codeSent) {
      setCodeSent(false);
      setCode('');
      setOtpErrorKind('none');
      return;
    }
    goBackOr(BACK_FALLBACK.authWelcome);
  }

  if (session && needsLockSetup) {
    return <Redirect href="/(auth)/lock-setup" />;
  }
  if (session && locked) {
    return <Redirect href="/(auth)/unlock" />;
  }
  if (session) {
    if (firstRunHref == null) {
      return (
        <View style={[styles.safe, styles.center, styles.voidFill]}>
          <ActivityIndicator color={ethena.ink.primary} accessible={false} />
        </View>
      );
    }
    return <Redirect href={firstRunHref} />;
  }

  const showProvision =
    provisioning ||
    isCreating(solanaWallet) ||
    isConnecting(solanaWallet) ||
    isReconnecting(solanaWallet) ||
    (Boolean(user) &&
      (method === 'resume' || method === 'google' || method === 'apple'));
  const showAlreadyInFrame =
    otpErrorKind === 'alreadyIn' || method === 'resume';

  const a11y = resolveSignInAccessibility({
    busy,
    codeSent,
    emailEmpty: !email.trim(),
    codeEmpty: !code.trim(),
    copy: {
      back: copy.v1.back,
      emailInput: copy.signin.emailInput,
      codeInput: copy.signin.codeInput,
      cta: copy.signin.cta,
      verify: copy.signin.verify,
      workingSuffix: copy.signin.workingSuffix,
      errorRetry: copy.signin.errorRetry,
      signOut: copy.signin.signOut,
      codeResend: copy.signin.codeResend,
    },
  });

  const provisionFrame = resolveSignInProvisionFrame({
    showProvision,
    showAlreadyInFrame,
    provisionStuck: provisionTimedOut || Boolean(error),
  });
  if (provisionFrame === 'one-second') {
    return <OneSecondWhenSlow />;
  }
  if (provisionFrame === 'stuck') {
    return (
      <EthenaGround>
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <CorsoText style={styles.provision} accessibilityRole="header">
              {copy.provision.headline}
            </CorsoText>
            <CorsoText style={styles.provisionHint}>
              {copy.provision.takingLong}
            </CorsoText>
            {error ? (
              <CorsoText
                style={styles.provisionError}
                accessibilityRole={a11y.error.accessibilityRole}
                accessibilityLiveRegion={a11y.error.accessibilityLiveRegion}
              >
                {error}
              </CorsoText>
            ) : null}

            <PrimaryCTA
              label={copy.signin.errorRetry}
              disabled={signingOut}
              onPress={onProvisionRetry}
              accessibilityLabel={a11y.retryCta.accessibilityLabel}
              style={styles.stretch}
            />

            {/* Always visible escape — do not wait for timeout. */}
            <TextButton
              label={signingOut ? copy.signin.signingOut : copy.signin.signOut}
              disabled={signingOut}
              tone="action"
              onPress={() => {
                void onSignOut();
              }}
              accessibilityLabel={a11y.signOut.accessibilityLabel}
              style={styles.stretch}
            />
          </View>
        </SafeAreaView>
      </EthenaGround>
    );
  }

  if (method === 'google' || method === 'apple') {
    return (
      <EthenaGround>
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            {(busy || oauth.state.status === 'loading') && (
              <ActivityIndicator
                color={ethena.ink.primary}
                accessible={false}
              />
            )}
            {error ? (
              <CorsoText
                style={styles.provisionError}
                accessibilityRole={a11y.error.accessibilityRole}
                accessibilityLiveRegion={a11y.error.accessibilityLiveRegion}
              >
                {error}
              </CorsoText>
            ) : null}
            <TextButton
              label={copy.v1.back}
              onPress={() => router.replace('/(auth)/welcome')}
              accessibilityLabel={a11y.back.accessibilityLabel}
              style={styles.stretch}
            />
            {error && !busy && oauth.state.status !== 'loading' ? (
              <TextButton
                label={copy.signin.tryEmailInstead}
                tone="action"
                onPress={() => {
                  setError(null);
                  setBusy(false);
                  setProvisioning(false);
                  router.replace({
                    pathname: '/(auth)/signin',
                    params: { method: 'email' },
                  });
                }}
                style={styles.stretch}
              />
            ) : null}
            {user ? (
              <TextButton
                label={copy.signin.signOut}
                tone="action"
                onPress={() => {
                  void onSignOut();
                }}
                accessibilityLabel={a11y.signOut.accessibilityLabel}
                style={styles.stretch}
              />
            ) : null}
          </View>
        </SafeAreaView>
      </EthenaGround>
    );
  }

  const chrome = resolveSignInChrome({
    method,
    codeSent,
    emailEmpty: !email.trim(),
    errorKind: otpErrorKind,
    alreadySignedIn: otpErrorKind === 'alreadyIn',
  });
  const frame = resolveSignInSourceState({
    method,
    codeSent,
    emailEmpty: !email.trim(),
    errorKind: otpErrorKind,
    alreadySignedIn: otpErrorKind === 'alreadyIn',
  });
  const helperText = resolveSignInHelperText(chrome.helperKind, email.trim());

  const continueDisabled =
    !email.trim() || busy || emailState.status === 'sending-code';
  const verifyDisabled =
    !code.trim() || busy || emailState.status === 'submitting-code';
  const primaryDisabled =
    chrome.primaryAction === 'continue'
      ? continueDisabled
      : chrome.primaryAction === 'verify'
        ? verifyDisabled
        : busy;
  const primaryA11y =
    chrome.primaryAction === 'continue'
      ? a11y.continueCta
      : chrome.primaryAction === 'verify'
        ? a11y.verifyCta
        : chrome.primaryAction === 'retry'
          ? a11y.retryCta
          : a11y.resend;

  function onPrimaryPress() {
    if (chrome.primaryAction === 'continue') {
      void onSendCode();
      return;
    }
    if (chrome.primaryAction === 'verify') {
      void onVerifyCode();
      return;
    }
    if (chrome.primaryAction === 'resend') {
      void onResendCode();
      return;
    }
    if (chrome.primaryAction === 'retry') {
      if (lastOtpStep.current === 'verify') {
        void onVerifyCode();
        return;
      }
      void onSendCode();
    }
  }

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe}>
        {resolveSignInBackAffordance({ frame, hasUser: Boolean(user) }) ===
        'none' ? (
          <HeaderRow left="none" right="none" />
        ) : (
          <HeaderRow
            left="back-chevron"
            onBackPress={onOtpBack}
            backAccessibilityLabel={a11y.back.accessibilityLabel}
            right="none"
          />
        )}
        <KeyboardAvoidingView
          style={styles.body}
          behavior={resolveKeyboardAvoidanceBehavior(Platform.OS)}
        >
          <CorsoText
            style={styles.title}
            accessibilityRole="header"
            testID={`signin-frame-${frame}`}
          >
            {chrome.title}
          </CorsoText>
          {helperText ? (
            <CorsoText style={styles.helper}>{helperText}</CorsoText>
          ) : null}
          {chrome.showEmailField ? (
            <EthenaTray testID="signin-email-field" style={styles.field}>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder={copy.signin.emailPlaceholder}
                placeholderTextColor={ethena.ink.secondary}
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  if (otpErrorKind !== 'none') setOtpErrorKind('none');
                }}
                accessibilityLabel={a11y.emailInput.accessibilityLabel}
              />
            </EthenaTray>
          ) : null}
          {chrome.showCodeField ? (
            <EthenaTray testID="signin-code-field" style={styles.field}>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder={copy.signin.codePlaceholder}
                placeholderTextColor={ethena.ink.secondary}
                value={code}
                onChangeText={(value) => {
                  setCode(value);
                  if (otpErrorKind !== 'none') setOtpErrorKind('none');
                }}
                maxLength={6}
                accessibilityLabel={a11y.codeInput.accessibilityLabel}
              />
            </EthenaTray>
          ) : null}
          {chrome.errorMessage ? (
            <CorsoText
              style={styles.error}
              accessibilityRole={a11y.error.accessibilityRole}
              accessibilityLiveRegion={a11y.error.accessibilityLiveRegion}
            >
              {chrome.errorMessage}
            </CorsoText>
          ) : null}
          <View style={styles.spacer} />
          {chrome.primaryAction !== 'none' ? (
            <PrimaryCTA
              label={chrome.primaryLabel}
              disabled={primaryDisabled}
              busy={busy}
              onPress={onPrimaryPress}
              accessibilityLabel={primaryA11y.accessibilityLabel}
            />
          ) : null}
          {chrome.signOutEscape ? (
            <TextButton
              label={signingOut ? copy.signin.signingOut : copy.signin.signOut}
              onPress={() => {
                void onSignOut();
              }}
              disabled={signingOut}
              tone="action"
              accessibilityLabel={a11y.signOut.accessibilityLabel}
            />
          ) : null}
          {chrome.showResend ? (
            <TextButton
              label={copy.signin.codeResend}
              onPress={() => {
                void onResendCode();
              }}
              disabled={busy}
              tone="action"
              accessibilityLabel={a11y.resend.accessibilityLabel}
            />
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  /** The door's column: the Ethena gutter. */
  body: {
    flex: 1,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ethenaGeometry.gutter,
    gap: 16,
  },
  /** The door's `title` rung — `Welcome` and `Sign in` are one headline size. */
  title: {
    ...ETHENA_TYPE.title,
    color: ethena.ink.primary,
    marginBottom: 8,
  },
  /** The door's custody-line rung: `sub` in the cool secondary ink. */
  helper: {
    ...ETHENA_TYPE.sub,
    color: ethena.ink.secondary,
    marginBottom: 16,
  },
  /**
   * Outer box only — the tray owns the fill, the rim and the radius. The
   * input carries the horizontal pad, so the tray's own is zeroed.
   */
  field: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  /** The door's field: `body` type at the Ethena pill height and pad. */
  input: {
    ...ETHENA_TYPE.body,
    paddingHorizontal: ethenaGeometry.pad,
    minHeight: ethenaGeometry.pillHeight,
    color: ethena.ink.primary,
  },
  spacer: { flex: 1 },
  /** The session hand-off spinner has no ground behind it. */
  voidFill: { backgroundColor: ethena.void },
  stretch: { alignSelf: 'stretch' },
  /** The door's error line: `body` in ink. */
  error: {
    ...ETHENA_TYPE.body,
    marginBottom: 8,
    color: ethena.ink.primary,
  },
  provision: {
    ...ETHENA_TYPE.title,
    color: ethena.ink.primary,
    textAlign: 'center',
  },
  provisionHint: {
    ...ETHENA_TYPE.sub,
    color: ethena.ink.secondary,
    textAlign: 'center',
  },
  provisionError: {
    ...ETHENA_TYPE.body,
    marginTop: 8,
    color: ethena.ink.primary,
    textAlign: 'center',
  },
});
