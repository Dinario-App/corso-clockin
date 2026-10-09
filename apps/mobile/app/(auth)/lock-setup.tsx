import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, router } from 'expo-router';
import { resolveFirstRunHref } from '@/src/features/howItWorks/howItWorksPreference';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import {
  getBiometricLabel,
  isBiometricEnrolled,
  promptAppUnlock,
} from '@/src/features/security/appLock';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import { shouldAllowLockSetup } from '@/src/features/lock/lockEscape';
import {
  canSkipBiometricSetup,
  resolveBiometricSetupOutcome,
  resolveFaceIdStep,
} from '@/src/features/onboarding/faceIdStepPolicy';
import { PasscodeKeypad } from '@/src/features/onboarding/PasscodeKeypad';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';

export default function LockSetupScreen() {
  const {
    session,
    needsLockSetup,
    markLockSetupComplete,
    phase,
    locked,
    lockPreference,
  } = useCorsoSession();
  const [stage, setStage] = useState<'biometric' | 'passcode'>('biometric');
  const [selectedMethod, setSelectedMethod] = useState<
    'biometric' | 'passcode'
  >('passcode');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passcodeResetToken, setPasscodeResetToken] = useState(0);
  const [biometricLabel, setBiometricLabel] = useState(
    NEUTRAL_BIOMETRIC_LABEL,
  );

  useEffect(() => {
    let cancelled = false;
    void getBiometricLabel()
      .then((label) => {
        if (!cancelled) setBiometricLabel(label);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'booting') {
    return (
      <EthenaGround>
        <View style={styles.boot}>
          <ActivityIndicator color={ethena.ink.primary} />
        </View>
      </EthenaGround>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!shouldAllowLockSetup({ needsLockSetup, locked, lockPreference })) {
    return <Redirect href="/(app)" />;
  }

  const step = resolveFaceIdStep({
    sessionType: session.type,
    biometricLabel,
  });

  async function enableBiometric() {
    setBusy(true);
    setError(null);
    try {
      if (!(await isBiometricEnrolled())) {
        setSelectedMethod('passcode');
        setStage('passcode');
        setBusy(false);
        return;
      }
      const result = await promptAppUnlock();
      const outcome = resolveBiometricSetupOutcome(result);
      if (outcome.action === 'stay_silent') {
        setBusy(false);
        return;
      }
      if (outcome.action === 'show_error') {
        setError(copy.profile.errorSetting);
        setBusy(false);
        return;
      }
      setSelectedMethod(result.success ? 'biometric' : 'passcode');
      setStage('passcode');
      setBusy(false);
    } catch {
      setError(copy.profile.errorSetting);
      setBusy(false);
    }
  }

  async function completePasscode(passcode: string) {
    setBusy(true);
    setError(null);
    try {
      await markLockSetupComplete(selectedMethod, passcode);
      router.replace(await resolveFirstRunHref(AsyncStorage));
    } catch {
      setError(copy.profile.errorSetting);
      setPasscodeResetToken((token) => token + 1);
      setBusy(false);
    }
  }

  function restartLockSetup() {
    setError(null);
    setPasscodeResetToken((token) => token + 1);
    setSelectedMethod('passcode');
    setStage('biometric');
  }

  async function skip() {
    // Belt and braces: the button is not rendered on the import path, and the
    // policy refuses again here.
    if (!canSkipBiometricSetup(session?.type)) {
      return;
    }
    await markLockSetupComplete('skipped');
    router.replace(await resolveFirstRunHref(AsyncStorage));
  }

  if (stage === 'passcode') {
    return (
      <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.passcodeBody}>
          <PasscodeKeypad
            resetToken={passcodeResetToken}
            onComplete={(passcode) => {
              void completePasscode(passcode);
            }}
          />
          {error ? (
            <CorsoText
              style={styles.error}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              {error}
            </CorsoText>
          ) : null}
          <TextButton
            label={copy.v1Onboarding.passcodeStartOver}
            disabled={busy}
            onPress={restartLockSetup}
            labelStyle={styles.door}
          />
        </View>
      </SafeAreaView>
      </EthenaGround>
    );
  }

  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.body}>
        <CorsoText style={styles.title} accessibilityRole="header">
          {step.title}
        </CorsoText>
        <CorsoText style={styles.bodyText}>{step.body}</CorsoText>

        <View style={styles.markWrap} accessible={false}>
          <View style={styles.mark}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
        </View>

        {error ? (
          <CorsoText
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {error}
          </CorsoText>
        ) : null}

        <PrimaryCTA
          label={step.primaryLabel}
          busy={busy}
          onPress={() => {
            void enableBiometric();
          }}
        />

        <TextButton
          label={step.passcodeLabel}
          tone="ink"
          disabled={busy}
          onPress={() => {
            setSelectedMethod('passcode');
            setStage('passcode');
          }}
        />

        {step.canSkip && step.skipLabel ? (
          <TextButton
            label={step.skipLabel}
            disabled={busy}
            onPress={() => {
              void skip();
            }}
          />
        ) : null}
      </View>
    </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 64,
    paddingBottom: 24,
  },
  passcodeBody: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: ethenaGeometry.gutter,
    paddingBottom: 44,
  },
  door: {
    ...ETHENA_TYPE.rowName,
    color: ethena.ink.secondary,
    fontWeight: '500',
  },
  title: {
    ...ETHENA_TYPE.title,
    color: ethena.ink.primary,
  },
  /** Body copy — 13/450 on `--ink48`, the other security door's own line. */
  bodyText: {
    marginTop: 8,
    ...ETHENA_TYPE.body,
    color: ethena.ink.tertiary,
  },
  markWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: 96, height: 96 },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: ethena.ink.secondary,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 10,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 10,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 10,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 10,
  },
  error: {
    marginBottom: 16,
    ...ETHENA_TYPE.body,
    color: ethena.ink.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
});
