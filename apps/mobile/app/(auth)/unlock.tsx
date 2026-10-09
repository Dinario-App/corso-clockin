import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePrivy } from '@privy-io/expo';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { LockedGround } from '@/src/features/lock/LockedGround';
import { PasscodeEntry } from '@/src/features/lock/PasscodeEntry';
import { resolveLockedPresentation } from '@/src/features/lock/lockedPresentation';
import { resolveLockEscape } from '@/src/features/lock/lockEscape';
import {
  appendPasscodeDigit,
  deletePasscodeDigit,
  isPasscodeComplete,
  type PasscodeKey,
} from '@/src/features/lock/passcodePadPresentation';
import {
  resolveUnlockAttempt,
  shouldApplyUnlockAttempt,
  shouldLeaveLockRoute,
} from '@/src/features/lock/resumeLock';
import { getBiometricLabel } from '@/src/features/security/appLock';
import { usePasscodeWait } from '@/src/features/security/usePasscodeWait';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { executeSessionTypeAwareSignOut } from '@/src/features/session/sessionSignOut';
import {
  isSignOutConfirmed,
  resolveSignOutSheet,
} from '@/src/features/session/signOutSheetPresentation';
import { LockIcyCta } from '@/src/features/lock/LockIcyCta';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

export default function UnlockScreen() {
  const {
    phase,
    session,
    needsLockSetup,
    locked,
    lockPreference,
    unlockSession,
    lockSession,
    unlockWithPasscode,
    clearConnectedSession,
    resetSessionLocalState,
  } = useCorsoSession();
  const { logout } = usePrivy();
  const [busy, setBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutTyped, setSignOutTyped] = useState('');
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutInFlight = useRef(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeBusy, setPasscodeBusy] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [passcodeShake, setPasscodeShake] = useState(0);
  const passcodeWait = usePasscodeWait(passcodeOpen);
  const passcodeInFlight = useRef(false);
  const autoTried = useRef(false);
  const attemptSeq = useRef(0);
  const liveAttempt = useRef(0);
  const mounted = useRef(true);
  /** True while one of OUR prompts is standing. Gates the leave-the-route
   *  redirect below, so a transient `locked → false` cannot navigate to Home
   *  from under a live system prompt. */
  const [promptInFlight, setPromptInFlight] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState(NEUTRAL_BIOMETRIC_LABEL);
  const [biometricResolved, setBiometricResolved] = useState(false);
  const lockedChrome = resolveLockedPresentation({
    lockPreference,
    biometricLabel,
  });
  const signOutSheet = resolveSignOutSheet(session?.type);
  const lockEscape = resolveLockEscape({ locked, lockPreference });

  useEffect(() => {
    let cancelled = false;
    void getBiometricLabel()
      .then((label) => {
        if (!cancelled) {
          setBiometricLabel(label);
          setBiometricResolved(true);
        }
      })
      .catch(() => {
        if (!cancelled) setBiometricResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function openPasscode() {
    setPasscode('');
    setPasscodeError(null);
    setPasscodeOpen(true);
  }

  async function onUnlock() {
    const attemptId = ++attemptSeq.current;
    liveAttempt.current = attemptId;
    setBusy(true);
    setPromptInFlight(true);
    setError(null);
    let result: 'unlocked' | 'passcode_required' | 'error';
    try {
      result = await unlockSession();
    } catch {
      result = 'error';
    }
    if (
      !shouldApplyUnlockAttempt({
        attemptId,
        liveAttemptId: liveAttempt.current,
        mounted: mounted.current,
      })
    ) {
      // An orphan. It may not relock either — a live newer attempt owns the gate.
      return;
    }
    setBusy(false);
    setPromptInFlight(false);
    const action = resolveUnlockAttempt({ result, lockEscape });
    if (action.relock) {
      lockSession();
    }
    if (result === 'error') setError(copy.lock.errorDeviceAuth);
    if (action.door === 'passcode') openPasscode();
    if (action.navigate === 'app') router.replace('/(app)');
  }

  async function onPasscodeUnlock(code: string) {
    if (!isPasscodeComplete(code) || passcodeBusy || passcodeInFlight.current) {
      return;
    }
    passcodeInFlight.current = true;
    setPasscodeBusy(true);
    setPasscodeError(null);
    try {
      if (await unlockWithPasscode(code)) {
        setPasscodeOpen(false);
        router.replace('/(app)');
        return;
      }
      setPasscode('');
      setPasscodeError(copy.lock.wrongPasscode);
      setPasscodeShake((token) => token + 1);
    } catch (caught) {
      // A verify that threw is not a verdict on the digits, but six full cells
      // with no Continue button left would be a dead pad: clear them, so the
      // "Try again" in the message is something the person can do.
      setPasscode('');
      setPasscodeError(
        passcodeWait.acceptError(caught) ? null : copy.lock.errorStillLocked,
      );
    } finally {
      passcodeInFlight.current = false;
      setPasscodeBusy(false);
    }
  }

  function onPasscodeKey(key: PasscodeKey) {
    if (passcodeBusy || passcodeInFlight.current || passcodeWait.wait) return;
    if (key === 'delete') {
      setPasscode(deletePasscodeDigit(passcode));
      setPasscodeError(null);
      return;
    }
    const next = appendPasscodeDigit(passcode, key);
    if (next === passcode) return;
    setPasscode(next);
    setPasscodeError(null);
    if (isPasscodeComplete(next)) {
      void onPasscodeUnlock(next);
    }
  }

  useEffect(() => {
    if (phase !== 'ready' || !session || needsLockSetup || !locked) return;
    if (lockPreference === 'biometric' && !biometricResolved) return;
    if (autoTried.current) return;
    if (lockEscape === 'lock-setup') return;
    autoTried.current = true;
    if (lockedChrome.unlockMethod === 'biometric') {
      void onUnlock();
    } else {
      openPasscode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on enter
  }, [
    phase,
    session,
    needsLockSetup,
    locked,
    lockPreference,
    biometricResolved,
    lockedChrome.unlockMethod,
    lockEscape,
  ]);

  function openSignOut() {
    setSignOutTyped('');
    setSignOutError(null);
    setSignOutOpen(true);
  }

  async function onSignOut() {
    if (signOutInFlight.current) return;
    if (
      !isSignOutConfirmed({ sessionType: session?.type, typed: signOutTyped })
    ) {
      return;
    }
    signOutInFlight.current = true;
    setSigningOut(true);
    setSignOutError(null);
    setError(null);
    try {
      await executeSessionTypeAwareSignOut(session?.type, {
        clearConnectedSession,
        resetSessionLocalState,
        logoutPrivy: logout,
      });
      setSignOutOpen(false);
      setSignOutTyped('');
      router.replace('/(auth)/welcome');
    } catch (e) {
      setSignOutError(
        e instanceof Error ? e.message : copy.signin.errorNetwork,
      );
    } finally {
      signOutInFlight.current = false;
      setSigningOut(false);
    }
  }

  if (phase === 'booting') {
    return <LockedGround testID="app-lock-booting" />;
  }

  if (!session) return <Redirect href="/(auth)/welcome" />;
  if (needsLockSetup) return <Redirect href="/(auth)/lock-setup" />;
  if (shouldLeaveLockRoute({ locked, promptInFlight })) {
    return <Redirect href="/(app)" />;
  }

  return (
    <View style={styles.root}>
      {/* Full-window, under the doors: it centres where the splash centred. */}
      <LockedGround testID="app-lock-ground" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <View style={styles.spacer} />
          {lockEscape === 'lock-setup' ? (
            <>
              <CorsoText style={styles.escapeNote}>
                {copy.lock.noUnlockMethod}
              </CorsoText>
              <LockIcyCta
                label={copy.lock.ctaSetUpUnlock}
                accessibilityLabel={copy.lock.ctaSetUpUnlock}
                disabled={busy || signingOut}
                onPress={() => {
                  router.replace('/(auth)/lock-setup');
                }}
                testID="app-lock-setup-escape"
              />
            </>
          ) : (
            <>
              <LockIcyCta
                label={lockedChrome.unlockLabel}
                accessibilityLabel={lockedChrome.unlockLabel}
                disabled={busy || signingOut}
                busy={busy}
                onPress={() => {
                  if (lockedChrome.unlockMethod === 'biometric') {
                    void onUnlock();
                  } else {
                    openPasscode();
                  }
                }}
              />
              {lockedChrome.showPasscodeFallback ? (
                <TextButton
                  label={copy.lock.ctaSecondary}
                  disabled={busy || signingOut}
                  onPress={openPasscode}
                  labelStyle={styles.door}
                />
              ) : null}
            </>
          )}
          {error ? <CorsoText style={styles.error}>{error}</CorsoText> : null}
          <TextButton
            label={signingOut ? copy.signin.signingOut : copy.signin.signOut}
            disabled={busy || signingOut}
            onPress={openSignOut}
            accessibilityLabel={copy.signin.signOut}
            labelStyle={styles.door}
          />
        </View>
      </SafeAreaView>
      <BottomSheet
        kind="passcode"
        closeButton
        title={copy.lock.passcodeTitle}
        visible={passcodeOpen}
        dismissible={!passcodeBusy}
        signing={passcodeBusy}
        onRequestClose={() => {
          setPasscodeOpen(false);
          setPasscode('');
          setPasscodeError(null);
        }}
        testID="app-lock-passcode-sheet"
      >
        <PasscodeEntry
          value={passcode}
          error={passcodeWait.line ?? passcodeError}
          errorBody={passcodeWait.wait ? copy.lock.tooManyTriesBody : null}
          disabled={passcodeBusy || passcodeWait.wait !== null}
          disabledAccessibilityLabel={passcodeWait.accessibilityLabel}
          announceError={passcodeWait.wait === null}
          shakeToken={passcodeShake}
          onKey={onPasscodeKey}
          testID="app-lock-passcode-entry"
        />
      </BottomSheet>
      <BottomSheet
        kind="destructive"
        title={signOutSheet.title}
        visible={signOutOpen}
        dismissible={!signingOut}
        signing={signingOut}
        onRequestClose={() => setSignOutOpen(false)}
        testID="app-lock-sign-out-sheet"
      >
        <CorsoText style={styles.sheetBody}>{signOutSheet.body}</CorsoText>
        {signOutSheet.requiresTypedConfirm ? (
          <TextInput
            value={signOutTyped}
            onChangeText={setSignOutTyped}
            placeholder={signOutSheet.confirmPlaceholder ?? ''}
            placeholderTextColor={ethena.ink.secondary}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!signingOut}
            accessibilityLabel={signOutSheet.confirmPlaceholder ?? ''}
            style={styles.confirmInput}
            testID="app-lock-sign-out-confirm"
          />
        ) : null}
        <PrimaryCTA
          label={signOutSheet.ctaLabel}
          busy={signingOut}
          disabled={
            !isSignOutConfirmed({
              sessionType: session?.type,
              typed: signOutTyped,
            })
          }
          onPress={() => {
            void onSignOut();
          }}
        />
        <TextButton
          label={signOutSheet.cancelLabel}
          disabled={signingOut}
          onPress={() => setSignOutOpen(false)}
        />
        {signOutError ? (
          <CorsoText
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {signOutError}
          </CorsoText>
        ) : null}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Full window, so `LockedGround` centres where the OS centred the splash. */
  root: { flex: 1, backgroundColor: ethena.void },
  /** Transparent — the ground under it is this screen's paint. */
  safe: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 32,
    paddingBottom: 24,
  },
  spacer: { flex: 1 },
  door: {
    ...ETHENA_TYPE.section,
    color: ethena.ink.secondary,
  },
  error: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    marginTop: 16,
    textAlign: 'center',
  },
  escapeNote: {
    ...ETHENA_TYPE.sub,
    fontWeight: '400',
    color: ethena.ink.secondary,
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetBody: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.secondary,
    marginBottom: 24,
  },
  confirmInput: {
    ...ETHENA_TYPE.body,
    fontWeight: '600',
    minHeight: ethenaGeometry.pillHeight,
    marginBottom: 16,
    color: ethena.ink.primary,
    backgroundColor: ethena.material.v2,
    borderRadius: ethenaGeometry.radiusBox,
    letterSpacing: 1,
    paddingHorizontal: ethenaGeometry.pad,
  },
});
