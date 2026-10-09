import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ScreenCapture from 'expo-screen-capture';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Redirect, router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { BeforeYouPasteScreen } from '@/src/features/onboarding/BeforeYouPasteScreen';
import { resolveBringYourWalletPresentation } from '@/src/features/onboarding/bringYourWalletPresentation';
import { shouldShowOneSecond } from '@/src/features/onboarding/provisioningVisibility';
import { GlassPill } from '@/src/ui/controls/GlassPill';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { resolveKeyboardAvoidanceBehavior } from '@/src/ui/primitives/keyboardAvoidancePresentation';
import { OneSecond } from '@/src/ui/state/OneSecond';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { importedMnemonicStore } from '@/src/features/session/importedMnemonicStore';
import { guardImportedPhraseReplacement } from '@/src/features/session/importReplacementGuard';
import {
  isImportGridEditable,
  needsDiscardConfirm,
  resolveCaptureSetupResult,
  respondToRecordingCapture,
  type CaptureReadiness,
} from '@/src/features/session/importCaptureLogic';
import {
  resolveImportControlAccessibility,
  resolveImportWordCellAccessibility,
} from '@/src/features/session/importAccessibility';
import {
  clearAfterPersistedSave,
  mnemonicBuffer,
} from '@/src/features/session/mnemonicBuffer';
import { trackEvent } from '@/src/lib/analytics';
import { Material } from '@/src/ui/glass/Material';
import { GLASS_EDGE } from '@/src/ui/glass/glassTokens';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

type CellMeta = { filled: boolean; invalid: boolean };

const WORDSET = new Set(wordlist);
const CAPTURE_KEY = 'corso-import';

export default function ImportScreen() {
  const { session } = useCorsoSession();
  // Gate before the phrase form and its capture/storage hooks can mount.
  if (!session) return <Redirect href="/(auth)/welcome" />;
  return <SignedInImportScreen />;
}

function SignedInImportScreen() {
  const { session, needsLockSetup, setImportedSession } = useCorsoSession();
  const [length, setLength] = useState<12 | 24>(12);
  const [revealed, setRevealed] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [perCell, setPerCell] = useState<CellMeta[]>(
    () => Array.from({ length: 12 }, () => ({ filled: false, invalid: false })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [obscured, setObscured] = useState(false);
  const [captureWarning, setCaptureWarning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gridEpoch, setGridEpoch] = useState(0);
  const [captureReadiness, setCaptureReadiness] = useState<CaptureReadiness>({
    status: 'pending',
  });
  /**
   * Bumped by the "Try again" action on the Android capture-fail banner so the
   * setup effect below re-runs in place — no app restart. The grid stays
   * fail-closed until a retry actually resolves to `ready`.
   */
  const [captureAttempt, setCaptureAttempt] = useState(0);
  const [pendingDiscard12, setPendingDiscard12] = useState(false);
  const [replacementConfirmOpen, setReplacementConfirmOpen] = useState(false);
  /** `Before you paste` stands in front of the grid, always. */
  const [gatePassed, setGatePassed] = useState(false);
  const [busyElapsedMs, setBusyElapsedMs] = useState(0);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const recordingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const gridEditable = isImportGridEditable(captureReadiness);

  useEffect(() => {
    mnemonicBuffer.setLength(12);
    trackEvent('import_started', {});
    return () => {
      mnemonicBuffer.clear();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // SDK: prevents screenshots + recording on Android and iOS 11+/13+.
        await ScreenCapture.preventScreenCaptureAsync(CAPTURE_KEY);
        if (Platform.OS === 'ios') {
          try {
            await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
          } catch {
            // overlay is best-effort; preventScreenCapture may still hold
          }
        }
        if (!cancelled) {
          setCaptureReadiness(
            resolveCaptureSetupResult({ platform: Platform.OS, ok: true }),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setCaptureReadiness(
            resolveCaptureSetupResult({
              platform: Platform.OS,
              ok: false,
              errorMessage:
                error instanceof Error ? error.message : 'capture_setup_failed',
            }),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      void ScreenCapture.allowScreenCaptureAsync(CAPTURE_KEY);
      if (Platform.OS === 'ios') {
        void ScreenCapture.disableAppSwitcherProtectionAsync();
      }
    };
  }, [captureAttempt]);

  useEffect(() => {
    const sub = ScreenCapture.addScreenshotListener(() => {
      setCaptureWarning(true);
      setRevealed(false);
      setFocusedIndex(null);
    });
    return () => sub.remove();
  }, []);

  // Best-effort iOS recording response: pure logic + optional isCaptured probe.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const applyRecording = (isCaptured: boolean) => {
      const response = respondToRecordingCapture(isCaptured);
      if (response.remask) {
        setRevealed(false);
        setFocusedIndex(null);
      }
      if (response.showWarning) {
        setCaptureWarning(true);
      }
    };
    // expo-screen-capture has no isCaptured subscription; probe AppState + prevent API.
    // When OS cannot report, preventScreenCaptureAsync is the hard path (setup above).
    applyRecording(false);
    recordingPollRef.current = setInterval(() => {
    }, 5_000);
    return () => {
      if (recordingPollRef.current) clearInterval(recordingPollRef.current);
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        setRevealed(false);
        setFocusedIndex(null);
        setObscured(true);
        if (state === 'background') {
          mnemonicBuffer.clear();
          setPerCell(
            Array.from({ length }, () => ({ filled: false, invalid: false })),
          );
          setGridEpoch((n) => n + 1);
          setPendingDiscard12(false);
          setReplacementConfirmOpen(false);
        }
      } else {
        setObscured(false);
      }
    });
    return () => sub.remove();
  }, [length]);

  // `One second.` only paints past ~600ms, so a fast import never flashes.
  useEffect(() => {
    if (!busy) {
      setBusyElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    const tick = setInterval(() => {
      setBusyElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(tick);
  }, [busy]);

  // Imperative seed from buffer after remount — never pass words via React props.
  useLayoutEffect(() => {
    for (let i = 0; i < length; i += 1) {
      const input = inputsRef.current[i];
      if (!input) continue;
      if (mnemonicBuffer.isFilled(i)) {
        input.setNativeProps({ text: mnemonicBuffer.wordPrefix(i) });
      } else {
        input.setNativeProps({ text: '' });
      }
    }
  }, [gridEpoch, length]);

  if (session) {
    return (
      <Redirect href={needsLockSetup ? '/(auth)/lock-setup' : '/(app)'} />
    );
  }

  if (!gatePassed) {
    return <BeforeYouPasteScreen onContinue={() => setGatePassed(true)} />;
  }

  if (shouldShowOneSecond({ working: busy, elapsedMs: busyElapsedMs })) {
    return <OneSecond />;
  }

  function onChangeWord(index: number, text: string) {
    const cleaned = text.replace(/\s+/g, '').toLowerCase();
    mnemonicBuffer.setWord(index, cleaned);
    const invalid = cleaned.length > 0 && !WORDSET.has(cleaned);
    setPerCell((prev) => {
      const next = [...prev];
      next[index] = { filled: cleaned.length > 0, invalid };
      return next;
    });
    if (error) setError(null);
    if (text.endsWith(' ') || text.endsWith('\n')) {
      if (cleaned && !WORDSET.has(cleaned)) {
        setError(copy.import.errorWordlistAt(index + 1));
        return;
      }
      const next = Math.min(index + 1, length - 1);
      inputsRef.current[next]?.focus();
    }
  }

  function requestLengthToggle() {
    const next: 12 | 24 = length === 12 ? 24 : 12;
    const filledBeyond12 =
      length === 24 &&
      Array.from({ length: 12 }, (_, i) => i + 12).some((i) =>
        mnemonicBuffer.isFilled(i),
      );
    if (
      needsDiscardConfirm({
        currentLength: length,
        nextLength: next,
        filledBeyond12,
      })
    ) {
      setPendingDiscard12(true);
      setError(copy.import.lengthDiscard);
      return;
    }
    applyLength(next);
  }

  function applyLength(next: 12 | 24) {
    mnemonicBuffer.setLength(next);
    setLength(next);
    setPendingDiscard12(false);
    setError(null);
    setPerCell(
      Array.from({ length: next }, (_, i) => {
        const word = mnemonicBuffer.wordPrefix(i);
        return {
          filled: mnemonicBuffer.isFilled(i),
          invalid: word.length > 0 && !WORDSET.has(word),
        };
      }),
    );
    setGridEpoch((n) => n + 1);
  }

  function confirmDiscard12() {
    applyLength(12);
  }

  function cancelDiscard12() {
    setPendingDiscard12(false);
    setError(null);
  }

  async function onPaste() {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) return;
      // Split into buffer immediately; do not retain paste string in React state.
      const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const pasteCount = words.length;
      const nextLen: 12 | 24 = pasteCount === 24 ? 24 : 12;
      mnemonicBuffer.setLength(nextLen);
      for (let i = 0; i < nextLen; i += 1) {
        mnemonicBuffer.setWord(i, words[i] ?? '');
      }
      // Drop local word array reference after buffer write (best-effort).
      words.length = 0;
      setLength(nextLen);
      setPerCell(
        Array.from({ length: nextLen }, (_, i) => {
          const filled = mnemonicBuffer.isFilled(i);
          const w = mnemonicBuffer.wordPrefix(i);
          return {
            filled,
            invalid: filled && !WORDSET.has(w),
          };
        }),
      );
      setGridEpoch((n) => n + 1);
      setToast(copy.import.pasteDone(Math.min(pasteCount, nextLen)));
      setError(
        pasteCount !== 12 && pasteCount !== 24
          ? copy.v1Onboarding.bringWalletWrongCount(pasteCount)
          : null,
      );
    } catch {
      // ignore
    }
  }

  async function onImport(allowReplace = false) {
    setBusy(true);
    setError(null);
    const failure = { kind: 'unknown' as 'storage' | 'unknown' };
    try {
      for (let i = 0; i < length; i += 1) {
        const w = mnemonicBuffer.wordPrefix(i);
        if (!WORDSET.has(w)) {
          // Index only — no secret word in React state (stricter exposure posture).
          setError(copy.import.errorWordlistAt(i + 1));
          setPerCell((prev) => {
            const next = [...prev];
            next[i] = { filled: Boolean(w), invalid: true };
            return next;
          });
          trackEvent('import_failed', { reason: 'wordlist' });
          return;
        }
      }
      const phrase = mnemonicBuffer.readAll();
      const wc = phrase.split(' ').length;
      if (wc !== 12 && wc !== 24) {
        setError(copy.v1Onboarding.bringWalletWrongCount(wc));
        trackEvent('import_failed', { reason: 'word_count' });
        return;
      }
      // Only BIP-39 validation can establish that the phrase is invalid.
      // Validate before replacement confirmation and authenticated storage.
      if (!validateMnemonic(phrase, wordlist)) {
        setError(copy.import.errorChecksum);
        trackEvent('import_failed', { reason: 'checksum' });
        trackEvent('wallet_import_failed', {
          door: 'import',
          error_code: 'invalid',
        });
        return;
      }
      const guarded = await guardImportedPhraseReplacement({
        phrase,
        store: importedMnemonicStore,
        allowReplace,
      });
      if (guarded.status === 'confirmation_required') {
        setReplacementConfirmOpen(true);
        return;
      }
      const outcome = await clearAfterPersistedSave(
        async () => {
          failure.kind = 'storage';
          const saved = await importedMnemonicStore.save(phrase);
          failure.kind = 'unknown';
          return saved;
        },
        () => Clipboard.setStringAsync(''),
        () => {
          setRevealed(false);
          setFocusedIndex(null);
          setPerCell(
            Array.from({ length }, () => ({ filled: false, invalid: false })),
          );
          setGridEpoch((n) => n + 1);
        },
      );
      setImportedSession(outcome.result.address);
      trackEvent('import_succeeded', { word_count: wc });
      trackEvent('wallet_imported', { door: 'import', word_count: wc });
      trackEvent('sign_in', { method: 'import', door: 'import' });
      // The toast is a claim about the clipboard, so it tracks the clipboard.
      setToast(
        outcome.clipboardCleared
          ? copy.import.clipboardCleared
          : copy.import.clipboardClearFailed,
      );
      router.replace('/(auth)/lock-setup');
    } catch {
      // Pre-persist failure retains the grid (state G). Successful persistence
      // already cleared it; neither case establishes an invalid phrase.
      setError(
        failure.kind === 'storage'
          ? copy.import.errorSave
          : copy.import.errorUnknown,
      );
      trackEvent('import_failed', {
        reason: failure.kind,
      });
      trackEvent('wallet_import_failed', {
        door: 'import',
        error_code: failure.kind,
      });
    } finally {
      setBusy(false);
    }
  }

  const filledCount = perCell.filter((c) => c.filled).length;
  const canImport =
    gridEditable &&
    filledCount === length &&
    !busy &&
    perCell.every((c) => c.filled && !c.invalid);

  const screen = resolveBringYourWalletPresentation({
    filled: filledCount,
    length,
    canSubmit: canImport,
    busy,
    error,
  });

  const controlsA11y = resolveImportControlAccessibility({
    busy,
    canImport,
    ctaLabel: screen.ctaLabel,
    ctaWorkingLabel: copy.import.ctaWorking,
    backLabel: copy.v1.back,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.body}
        behavior={resolveKeyboardAvoidanceBehavior(Platform.OS)}
      >
        <View style={styles.scroller}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <CorsoText style={styles.title} accessibilityRole="header">
              {screen.title}
            </CorsoText>
            <CorsoText style={styles.trust}>{screen.body}</CorsoText>

            {captureReadiness.status === 'failed' ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <Material
                  weight="card"
                  hug
                  radius={radii.smallPane}
                  contentStyle={styles.warningBanner}
                >
                  <CorsoText style={styles.warningText}>
                    {copy.import.captureProtectionFailed}
                  </CorsoText>
                  <PrimaryCTA
                    label={copy.import.captureRetry}
                    onPress={() => {
                      // Re-run the capture-setup effect in place. The grid stays
                      // fail-closed (not editable) until this resolves to ready.
                      setCaptureReadiness({ status: 'pending' });
                      setCaptureAttempt((n) => n + 1);
                    }}
                  />
                </Material>
              </View>
            ) : null}

            {captureWarning ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <Material
                  weight="card"
                  hug
                  radius={radii.smallPane}
                  contentStyle={styles.warningBanner}
                >
                  <CorsoText style={styles.warningText}>
                    {copy.import.captureWarning}
                  </CorsoText>
                  <Pressable
                    onPress={() => setCaptureWarning(false)}
                    accessibilityRole="button"
                    accessibilityLabel={copy.import.dismiss}
                  >
                    <CorsoText style={styles.toolLabel} accessible={false}>
                      {copy.import.dismiss}
                    </CorsoText>
                  </Pressable>
                </Material>
              </View>
            ) : null}

            <View style={styles.toolbar}>
              <Pressable
                disabled={!gridEditable}
                onPress={() => {
                  setRevealed((v) => !v);
                  setFocusedIndex(null);
                  setGridEpoch((n) => n + 1);
                }}
                accessibilityRole={controlsA11y.reveal.accessibilityRole}
                accessibilityLabel={
                  revealed ? copy.import.revealHide : copy.import.revealShow
                }
                accessibilityState={{ disabled: !gridEditable }}
              >
                <CorsoText style={styles.toolLabel} accessible={false}>
                  {revealed ? copy.import.revealHide : copy.import.revealShow}
                </CorsoText>
              </Pressable>
              <Pressable
                disabled={!gridEditable}
                onPress={requestLengthToggle}
                accessibilityRole={controlsA11y.lengthToggle.accessibilityRole}
                accessibilityLabel={
                  length === 12
                    ? copy.import.lengthUse24
                    : copy.import.lengthUse12
                }
                accessibilityState={{ disabled: !gridEditable }}
              >
                <CorsoText style={styles.toolLabel} accessible={false}>
                  {length === 12
                    ? copy.import.lengthUse24
                    : copy.import.lengthUse12}
                </CorsoText>
              </Pressable>
            </View>

            {pendingDiscard12 ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <Material
                  weight="card"
                  hug
                  radius={radii.smallPane}
                  contentStyle={styles.warningBanner}
                >
                  <CorsoText style={styles.warningText}>
                    {copy.import.lengthDiscard}
                  </CorsoText>
                  <View style={styles.confirmRow}>
                    <Pressable
                      onPress={confirmDiscard12}
                      accessibilityRole="button"
                      accessibilityLabel={copy.v1.continue}
                    >
                      <CorsoText style={styles.toolLabel} accessible={false}>
                        {copy.v1.continue}
                      </CorsoText>
                    </Pressable>
                    <Pressable
                      onPress={cancelDiscard12}
                      accessibilityRole="button"
                      accessibilityLabel={copy.v1.cancel}
                    >
                      <CorsoText style={styles.toolLabel} accessible={false}>
                        {copy.v1.cancel}
                      </CorsoText>
                    </Pressable>
                  </View>
                </Material>
              </View>
            ) : null}

            <Material
              weight="card"
              hug
              radius={radii.pane}
              contentStyle={styles.cardContent}
              rimColor={screen.cardInvalid ? colors.inkSecondary : GLASS_EDGE}
            >
              {filledCount === 0 ? (
                <CorsoText style={styles.placeholder} accessible={false}>
                  {screen.placeholder}
                </CorsoText>
              ) : null}
              <View style={styles.grid}>
                {Array.from({ length }, (_, index) => {
                  const meta = perCell[index] ?? {
                    filled: false,
                    invalid: false,
                  };
                  const masked = !revealed && focusedIndex !== index;
                  const cellA11y = resolveImportWordCellAccessibility({
                    index,
                    filled: meta.filled,
                    masked,
                  });
                  return (
                    <Material
                      weight="card"
                      hug
                      nested
                      key={`${gridEpoch}-${index}`}
                      radius={radii.menuRow}
                      style={styles.cell}
                      contentStyle={styles.cellContent}
                    >
                      <CorsoText style={styles.index} accessible={false}>
                        {index + 1}
                      </CorsoText>
                      <TextInput
                        ref={(el) => {
                          inputsRef.current[index] = el;
                        }}
                        style={[
                          styles.input,
                          meta.invalid && styles.inputInvalid,
                        ]}
                        secureTextEntry={masked}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        autoComplete="off"
                        textContentType="none"
                        keyboardType={
                          Platform.OS === 'android'
                            ? 'visible-password'
                            : 'default'
                        }
                        contextMenuHidden
                        accessibilityLabel={cellA11y.accessibilityLabel}
                        accessibilityValue={cellA11y.accessibilityValue}
                        onFocus={() => {
                          setFocusedIndex(index);
                        }}
                        onBlur={() => {
                          setFocusedIndex((current) =>
                            current === index ? null : current,
                          );
                        }}
                        onChangeText={(text) => onChangeWord(index, text)}
                        onKeyPress={({ nativeEvent }) => {
                          if (
                            nativeEvent.key === 'Backspace' &&
                            !mnemonicBuffer.isFilled(index) &&
                            index > 0
                          ) {
                            inputsRef.current[index - 1]?.focus();
                          }
                        }}
                        editable={!busy && gridEditable}
                      />
                    </Material>
                  );
                })}
                {obscured ? (
                  <View style={styles.privacyOverlay} accessible={false} />
                ) : null}
              </View>

              <View style={styles.cardFooter}>
                <CorsoText style={styles.counter} accessible={false}>
                  {screen.counter}
                </CorsoText>
                <GlassPill
                  label={copy.v1.paste}
                  disabled={!gridEditable}
                  onPress={() => {
                    void onPaste();
                  }}
                  accessibilityLabel={copy.v1.paste}
                  style={styles.pastePill}
                />
              </View>
            </Material>

            {toast ? <CorsoText style={styles.toast}>{toast}</CorsoText> : null}
            {screen.errorText && !pendingDiscard12 ? (
              <CorsoText
                style={styles.error}
                accessibilityRole={controlsA11y.error.accessibilityRole}
                accessibilityLiveRegion={
                  controlsA11y.error.accessibilityLiveRegion
                }
              >
                {screen.errorText}
              </CorsoText>
            ) : null}

            <CorsoText style={styles.secureNote}>{screen.secureNote}</CorsoText>

            <View style={styles.spacer} />

            <PrimaryCTA
              label={screen.ctaLabel}
              disabled={screen.ctaDisabled}
              busy={busy}
              onPress={() => {
                void onImport();
              }}
              accessibilityLabel={controlsA11y.cta.accessibilityLabel}
            />

            <Pressable
              onPress={() => goBackOr(BACK_FALLBACK.authWelcome)}
              style={styles.back}
              accessibilityRole={controlsA11y.back.accessibilityRole}
              accessibilityLabel={controlsA11y.back.accessibilityLabel}
            >
              <CorsoText style={styles.backLabel} accessible={false}>
                {copy.v1.back}
              </CorsoText>
            </Pressable>
          </ScrollView>
          <ScrollEdgeFade color={colors.canvas} />
        </View>
      </KeyboardAvoidingView>
      <BottomSheet
        kind="destructive"
        title={copy.welcome.resume.replaceTitle}
        visible={replacementConfirmOpen}
        dismissible={!busy}
        signing={busy}
        onRequestClose={() => setReplacementConfirmOpen(false)}
        testID="import-replacement-confirm"
      >
        <CorsoText style={styles.sheetBody}>
          {copy.welcome.resume.replaceBody}
        </CorsoText>
        <PrimaryCTA
          label={copy.welcome.resume.replaceCta}
          busy={busy}
          onPress={() => {
            setReplacementConfirmOpen(false);
            void onImport(true);
          }}
        />
        <TextButton
          label={copy.welcome.resume.replaceCancel}
          disabled={busy}
          onPress={() => setReplacementConfirmOpen(false)}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: { flex: 1 },
  scroller: { flex: 1, position: 'relative' },
  scroll: {
    paddingHorizontal: spacing.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  title: {
    fontSize: CANON_TYPE_SIZES.askTitle,
    lineHeight: Math.round(CANON_TYPE_SIZES.askTitle * 1.16),
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
    color: colors.ink,
  },
  trust: {
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkTertiary,
  },
  sheetBody: {
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkSecondary,
  },
  cardContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  placeholder: {
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkTertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pastePill: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  secureNote: {
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    color: colors.inkTertiary,
  },
  spacer: { minHeight: spacing.xl },
  /** Inner box only — the fill, rim and radius are the material's. */
  warningBanner: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  warningText: {
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    color: colors.ink,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  toolLabel: {
    fontSize: CANON_TYPE_SIZES.rowLabel,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    color: colors.ink,
  },
  counter: {
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    color: colors.inkTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    position: 'relative',
  },
  /** Outer box only — a nested lens on the seed card, never a flat surface. */
  cell: {
    width: '31%',
  },
  cellContent: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  index: {
    fontSize: CANON_TYPE_SIZES.groupLabel,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    color: colors.inkTertiary,
  },
  input: {
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    color: colors.ink,
    /** Seed cells are the `0`/`O` case the slashed zero exists for. */
    fontVariant: [...typography.fontVariantMono] as TextStyle['fontVariant'],
    padding: 0,
    minHeight: 22,
  },
  inputInvalid: {
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
  },
  privacyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.canvas,
  },
  toast: {
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    color: colors.inkTertiary,
  },
  error: {
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    color: colors.ink,
  },
  back: { alignItems: 'center', padding: spacing.md },
  backLabel: {
    fontSize: CANON_TYPE_SIZES.rowLabel,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    color: colors.inkTertiary,
  },
});
