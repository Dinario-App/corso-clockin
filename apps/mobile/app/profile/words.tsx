import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import * as ScreenCapture from 'expo-screen-capture';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { copy } from '@/constants/copy';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import {
  getAppLockPreference,
  getBiometricLabel,
  hasBiometricHardware,
  promptAppUnlock,
  verifyAppLockPasscode,
} from '@/src/features/security/appLock';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import { usePasscodeWait } from '@/src/features/security/usePasscodeWait';
import { readPhraseForReveal } from '@/src/features/security/readPhraseForReveal';
import {
  afterBiometricStepUp,
  decideReadPhrase,
  resolveRevealStepUpMethod,
  type RevealStepUpMethod,
} from '@/src/features/security/revealStepUp';
import { resolveSafeRevealCeremony } from '@/src/features/security/safeRevealPresentation';
import {
  canRevealWords,
  resolveWordsReveal,
  splitPhraseCells,
  wordsScreenshotAlert,
} from '@/src/features/security/wordsReveal';
import {
  resolveSafeRevealChrome,
  resolveSafeRevealStepIndex,
  SAFE_REVEAL_STEP_COUNT,
} from '@/src/features/security/safeRevealChrome';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { AccountStepDots } from '@/src/features/account/ui/AccountStepDots';
import { CorsoText } from '@/src/theme/CorsoText';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { canonWeight } from '@/src/ui/cards/canonType';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { ethena, ethenaCaution } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

/** The passcode field stands on the ground tray (material law, `ground`). */

const CAPTURE_KEY = 'corso-your-words';
const TICK_MS = 500;

type CeremonyStage = 'warning' | 'reveal';

export default function YourWordsScreen() {
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: tray.borderWidth,
    borderColor: tray.borderColor ?? undefined,
  };
  const { session } = useCorsoSession();
  const [cells, setCells] = useState<{ index: number; word: string }[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [revealedAtMs, setRevealedAtMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [screenshotDetected, setScreenshotDetected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  // Ceremony chrome. None of this touches what is read or how.
  const [stage, setStage] = useState<CeremonyStage>('warning');
  const [consented, setConsented] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState(NEUTRAL_BIOMETRIC_LABEL);
  const [stepUpMethod, setStepUpMethod] =
    useState<RevealStepUpMethod>('biometric');

  // Passcode fallback for the step-up. Same sheet shape as `(auth)/unlock`.
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeBusy, setPasscodeBusy] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const passcodeWait = usePasscodeWait(passcodeOpen);
  /** Resolves the in-flight step-up once the passcode sheet settles. */
  const pendingStepUp = useRef<((passed: boolean) => void) | null>(null);

  const allowed = canRevealWords(session?.type);
  const ceremony = resolveSafeRevealCeremony({
    door: 'import',
    biometricLabel,
    stepUpMethod,
  });

  const forget = useCallback(() => {
    setCells([]);
    setRevealed(false);
    setRevealedAtMs(null);
    setElapsedMs(0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync(CAPTURE_KEY);
        if (Platform.OS === 'ios') {
          try {
            await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
          } catch {
            // Best effort; preventScreenCapture is the hard path.
          }
        }
      } catch {
        if (!cancelled) setError(copy.profile.errorSetting);
      }
    })();
    return () => {
      cancelled = true;
      void ScreenCapture.allowScreenCaptureAsync(CAPTURE_KEY);
      if (Platform.OS === 'ios') {
        void ScreenCapture.disableAppSwitcherProtectionAsync();
      }
    };
  }, []);

  useEffect(() => {
    const sub = ScreenCapture.addScreenshotListener(() => {
      setScreenshotDetected(true);
      forget();
    });
    return () => sub.remove();
  }, [forget]);

  // Leaving the app takes the words with it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') forget();
    });
    return () => sub.remove();
  }, [forget]);

  useEffect(() => {
    if (revealedAtMs === null) return;
    const tick = setInterval(() => {
      setElapsedMs(Date.now() - revealedAtMs);
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [revealedAtMs]);

  const state = resolveWordsReveal({
    revealed,
    elapsedMs,
    screenshotDetected,
  });

  // The clock ran out: drop what was read, do not just stop painting it.
  useEffect(() => {
    if (state.autoHidden) forget();
  }, [state.autoHidden, forget]);

  // Once words have been on screen, the covered state reads "Hidden again".
  useEffect(() => {
    if (revealed) setHasRevealed(true);
  }, [revealed]);

  // Wording only: which factor the gate names. The OS prompt is unaffected.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [label, preference, hardware] = await Promise.all([
        getBiometricLabel().catch(() => NEUTRAL_BIOMETRIC_LABEL),
        getAppLockPreference().catch(() => null),
        hasBiometricHardware().catch(() => false),
      ]);
      if (cancelled) return;
      setBiometricLabel(label);
      setStepUpMethod(
        resolveRevealStepUpMethod({ preference, biometricHardware: hardware }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A dismissed passcode sheet is a refused step-up.
  useEffect(() => {
    return () => {
      pendingStepUp.current?.(false);
      pendingStepUp.current = null;
    };
  }, []);

  /**
   * The app-lock step-up for THIS reveal. Biometric when it is the lock the
   * user chose and the device can honour it; otherwise, or whenever the
   * biometric does not succeed, the passcode sheet. Never cached.
   */
  async function runStepUp(): Promise<boolean> {
    const [preference, hardware] = await Promise.all([
      getAppLockPreference(),
      hasBiometricHardware().catch(() => false),
    ]);
    const method = resolveRevealStepUpMethod({
      preference,
      biometricHardware: hardware,
    });
    setStepUpMethod(method);
    if (method === 'biometric') {
      let success = false;
      try {
        success = (await promptAppUnlock()).success;
      } catch {
        success = false;
      }
      if (afterBiometricStepUp(success) === 'passed') return true;
    }
    return new Promise<boolean>((resolve) => {
      pendingStepUp.current?.(false);
      pendingStepUp.current = resolve;
      setPasscode('');
      setPasscodeError(null);
      setPasscodeOpen(true);
    });
  }

  function settlePasscode(passed: boolean) {
    setPasscodeOpen(false);
    setPasscode('');
    setPasscodeError(null);
    const pending = pendingStepUp.current;
    pendingStepUp.current = null;
    pending?.(passed);
  }

  async function onPasscodeSubmit() {
    if (passcode.length !== 6 || passcodeBusy || passcodeWait.wait) return;
    setPasscodeBusy(true);
    setPasscodeError(null);
    try {
      if (await verifyAppLockPasscode(passcode)) {
        settlePasscode(true);
        return;
      }
      setPasscode('');
      setPasscodeError(copy.lock.wrongPasscode);
    } catch (caught) {
      setPasscodeError(
        passcodeWait.acceptError(caught) ? null : copy.lock.errorStillLocked,
      );
    } finally {
      setPasscodeBusy(false);
    }
  }

  async function reveal() {
    if (loadingRef.current) return;
    // Pre-flight: nothing to ask for if the door or consent is missing.
    const preflight = decideReadPhrase({
      allowed,
      consented,
      stepUpPassed: true,
      screenshotDetected,
    });
    if (!preflight.read) return;
    loadingRef.current = true;
    setError(null);
    try {
      const stepUpPassed = await runStepUp();
      const decision = decideReadPhrase({
        allowed,
        consented,
        stepUpPassed,
        screenshotDetected,
      });
      if (!decision.read) return;
      const phrase = await readPhraseForReveal();
      if (phrase === null) {
        setError(copy.profile.errorSetting);
        return;
      }
      setCells(splitPhraseCells(phrase));
      setRevealed(true);
      setRevealedAtMs(Date.now());
      setElapsedMs(0);
    } catch {
      setError(copy.profile.errorSetting);
    } finally {
      loadingRef.current = false;
    }
  }

  const alert = wordsScreenshotAlert();
  /** Styles only — see `safeRevealChrome`, which owns no key material. */
  const chrome = resolveSafeRevealChrome();
  const coveredCopy = hasRevealed
    ? { title: ceremony.hidden.title, body: ceremony.hidden.body }
    : { title: ceremony.gate.title, body: ceremony.gate.body };

  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <AccountScreenHeader
        family="desk"
        title={copy.account.recoveryPhraseTitle}
        onBack={() => {
          forget();
          goBackOr(BACK_FALLBACK.securityHub);
        }}
        backAccessibilityLabel={copy.v1.back}
        right={
          <AccountStepDots
            count={SAFE_REVEAL_STEP_COUNT}
            index={resolveSafeRevealStepIndex({
              stage,
              wordsVisible: state.wordsVisible,
            })}
          />
        }
        testID="words-header"
      />

      <View style={styles.scrollWrap}>
        {stage === 'warning' ? (
          <ScrollView contentContainerStyle={styles.body}>
            <CorsoText style={styles.eyebrow}>{ceremony.eyebrow}</CorsoText>
            <CorsoText style={chrome.leadStyle} accessibilityRole="header">
              {ceremony.warning.title}
            </CorsoText>
            <View style={chrome.gateStyle}>
              {ceremony.warning.lines.map((line, i) => (
                <SettingsCard
                  key={line}
                  radius={ethenaGeometry.radiusBox}
                  contentStyle={chrome.gateItemStyle}
                >
                  <View style={chrome.gateIndexStyle} accessible={false}>
                    <CorsoText style={chrome.gateIndexTextStyle}>
                      {i + 1}
                    </CorsoText>
                  </View>
                  <CorsoText style={chrome.gateTextStyle}>{line}</CorsoText>
                </SettingsCard>
              ))}
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            <CorsoText style={chrome.leadStyle} accessibilityRole="header">
              {state.wordsVisible
                ? copy.v1Security.yourWords
                : coveredCopy.title}
            </CorsoText>
            <CorsoText style={chrome.bodyCopyStyle}>
              {state.wordsVisible
                ? copy.v1Security.yourWordsBody
                : coveredCopy.body}
            </CorsoText>

            {allowed && !state.wordsVisible && !state.screenshotAlert ? (
              <SettingsCard
                radius={ethenaGeometry.radiusBox}
                style={styles.seedPaneOuter}
                contentStyle={chrome.faceIdCardStyle}
                testID="words-faceid-card"
              >
                <View style={chrome.faceIdGlyphStyle} accessible={false}>
                  <CorsoIcon
                    name="scan"
                    size={28}
                    color={ethena.ink.secondary}
                  />
                </View>
                <CorsoText style={chrome.faceIdTitleStyle}>
                  {hasRevealed ? ceremony.hidden.title : ceremony.gate.title}
                </CorsoText>
                <CorsoText style={chrome.faceIdSubStyle}>
                  {ceremony.reveal.captureChrome}
                </CorsoText>
              </SettingsCard>
            ) : null}

            {!allowed || !state.wordsVisible ? null : (
              <SettingsCard
                radius={ethenaGeometry.radiusBox}
                style={styles.seedPaneOuter}
                contentStyle={chrome.seedPaneStyle}
                testID="words-seed-pane"
              >
                <View style={styles.seedChrome}>
                  <View style={styles.captureNotice}>
                    {/*
                      `ethenaCaution` is the same amber this glyph drew from
                      `colors.riskDanger` (both EMBER_AMBER), taken from the
                      Ethena set as SleeveFace's cap notice already does.
                    */}
                    <CorsoIcon
                      name="scan"
                      size={13}
                      color={ethenaCaution}
                    />
                    <CorsoText style={styles.chromeText}>
                      {ceremony.reveal.captureChrome}
                    </CorsoText>
                  </View>
                  {state.hidesInLabel ? (
                    <CorsoText style={styles.chromeText}>
                      {state.hidesInLabel}
                    </CorsoText>
                  ) : null}
                </View>
                <View style={chrome.seedGridStyle}>
                  {cells.map((cell) => (
                    <View
                      key={cell.index}
                      style={[chrome.seedCellStyle, styles.seedCellWidth]}
                    >
                      <CorsoText
                        style={chrome.seedIndexStyle}
                        accessible={false}
                      >
                        {cell.index}
                      </CorsoText>
                      <CorsoText
                        style={chrome.seedWordStyle}
                        accessible={false}
                      >
                        {cell.word}
                      </CorsoText>
                    </View>
                  ))}
                </View>
              </SettingsCard>
            )}

            {/*
              The custody claim. Neutral ink and centred — it is a statement of
              fact about where the key lives, not a caution, so it takes no
              colour and no glyph.
            */}
            {state.wordsVisible ? (
              <CorsoText style={chrome.claimStyle}>
                {ceremony.reveal.claim}
              </CorsoText>
            ) : null}

            {error ? (
              <CorsoText
                style={styles.error}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                {error}
              </CorsoText>
            ) : null}

            {state.screenshotAlert ? (
              <SettingsCard
                radius={ethenaGeometry.radiusBox}
                style={styles.alertOuter}
                contentStyle={chrome.doneCardStyle}
                testID="words-screenshot-alert"
              >
                <View
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                  style={styles.alertBodyWrap}
                >
                  <CorsoText style={chrome.doneWordStyle}>
                    {alert.title}
                  </CorsoText>
                  <CorsoText style={chrome.doneSubStyle}>
                    {alert.body}
                  </CorsoText>
                </View>
                <PrimaryCTA
                  label={alert.ctaLabel}
                  tone="transactional"
                  onPress={() => {
                    forget();
                    goBackOr(BACK_FALLBACK.securityHub);
                  }}
                />
              </SettingsCard>
            ) : null}
          </ScrollView>
        )}
        <ScrollEdgeFade color={ethena.groundStops[0][1]} />
      </View>

      <View style={chrome.footerStyle}>
        {stage === 'warning' ? (
          <PrimaryCTA
            label={ceremony.warning.cta}
            tone="transactional"
            disabled={!allowed}
            onPress={() => {
              // Consent is the acknowledgement of the gate, on this mount only.
              setConsented(true);
              setStage('reveal');
            }}
          />
        ) : state.wordsVisible ? (
          <PrimaryCTA
            label={copy.v1.done}
            tone="transactional"
            onPress={() => {
              forget();
              goBackOr(BACK_FALLBACK.securityHub);
            }}
          />
        ) : (
          <PrimaryCTA
            label={hasRevealed ? ceremony.hidden.cta : ceremony.gate.cta}
            tone="transactional"
            disabled={!allowed || !consented || state.screenshotAlert}
            onPress={() => {
              void reveal();
            }}
          />
        )}
        <TextButton
          label={copy.v1.cancel}
          onPress={() => goBackOr(BACK_FALLBACK.securityHub)}
        />
      </View>

      {/* Step-up passcode fallback. Dismissing it refuses the reveal. */}
      <BottomSheet
        title={copy.lock.passcodeTitle}
        visible={passcodeOpen}
        dismissible={!passcodeBusy}
        signing={passcodeBusy}
        onRequestClose={() => settlePasscode(false)}
        testID="words-step-up-passcode-sheet"
      >
        <CorsoText style={styles.passcodeHelper}>
          {copy.lock.passcodeHelper}
        </CorsoText>
        <TextInput
          value={passcode}
          onChangeText={(value) => {
            setPasscode(value.replace(/\D/g, '').slice(0, 6));
            setPasscodeError(null);
          }}
          secureTextEntry
          keyboardType="number-pad"
          maxLength={6}
          autoComplete="off"
          editable={!passcodeBusy && passcodeWait.wait === null}
          accessibilityLabel={
            passcodeWait.accessibilityLabel ?? copy.lock.passcodeTitle
          }
          accessibilityState={{
            disabled: passcodeBusy || passcodeWait.wait !== null,
          }}
          style={[styles.passcodeInput, trayPaint]}
          onSubmitEditing={() => {
            void onPasscodeSubmit();
          }}
        />
        {(passcodeWait.line ?? passcodeError) ? (
          <CorsoText
            style={styles.error}
            accessibilityRole={passcodeWait.wait ? undefined : 'alert'}
            accessibilityLiveRegion={passcodeWait.wait ? 'none' : 'assertive'}
          >
            {passcodeWait.line ?? passcodeError}
          </CorsoText>
        ) : null}
        {passcodeWait.wait ? (
          <CorsoText style={styles.error}>{copy.lock.tooManyTriesBody}</CorsoText>
        ) : null}
        <PrimaryCTA
          label={copy.v1.continue}
          disabled={
            passcode.length !== 6 || passcodeBusy || passcodeWait.wait !== null
          }
          busy={passcodeBusy}
          accessibility={{
            accessibilityLabel:
              passcodeWait.accessibilityLabel ?? copy.v1.continue,
            accessibilityState: {
              disabled:
                passcode.length !== 6 ||
                passcodeBusy ||
                passcodeWait.wait !== null,
            },
          }}
          onPress={() => {
            void onPasscodeSubmit();
          }}
        />
      </BottomSheet>
    </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollWrap: { flex: 1, position: 'relative' },
  /** The desk gutter, the same one the `family="desk"` header row reads. */
  body: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 24,
    paddingBottom: 32,
  },
  eyebrow: {
    color: ethena.ink.tertiary,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.2,
    fontWeight: canonWeight('600'),
    marginBottom: 8,
  },
  seedPaneOuter: { marginTop: 24 },
  captureNotice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  /** The capture notice and the auto-hide clock, above the grid. */
  seedChrome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  /**
   * The capture notice and the auto-hide countdown. `--ink48`: the countdown
   * is the only thing telling someone how long they have left to write down a
   * recovery phrase, and a clock nobody can read is not a clock.
   */
  chromeText: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    fontWeight: canonWeight('500'),
  },
  /**
   * `.seedgrid{grid-template-columns:1fr 1fr 1fr}` — three columns, so each
   * cell takes a third of the row minus its share of the two 7pt gaps.
   */
  seedCellWidth: { width: '31.5%' },
  alertOuter: { marginTop: 24 },
  alertBodyWrap: { alignItems: 'center', gap: 8 },
  error: {
    ...ETHENA_TYPE.body,
    marginTop: 12,
    color: ethena.ink.secondary,
  },
  passcodeHelper: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.tertiary,
    marginBottom: 24,
  },
  passcodeInput: {
    minHeight: 58,
    borderRadius: ethenaGeometry.radiusBox,
    color: ethena.ink.primary,
    fontSize: 22,
    textAlign: 'center',
    letterSpacing: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
});
