import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenCapture from 'expo-screen-capture';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, spacing } from '@/constants/theme';
import { typography } from '@/src/ui/tokens';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { useStepUpConfirm } from '@/src/features/security/useStepUpConfirm';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import { clearStepUpCache } from '@/src/features/security/mfaGateCore';
import {
  EXPORT_CONSENT_VERSION,
  resolveExportEntryPointFromEnv,
} from '@/src/features/export/exportConfig';
import {
  canLaunchExportWebView,
  EXPORT_CONSENT_COPY,
  isGate1ConfirmEnabled,
  launchRefusalMessage,
  type ConsentStage,
  type Gate1State,
} from '@/src/features/export/exportConsent';
import { buildExportUrl } from '@/src/features/export/exportUrl';
import { decideExportNavigation } from '@/src/features/export/exportNavigationPolicy';
import {
  parseExportBridgeMessage,
  shouldDismissOnBridgeResult,
} from '@/src/features/export/exportBridge';
import {
  buildExportWebViewConfig,
  teardownExportWebView,
  type ExportWebViewRef,
} from '@/src/features/export/exportWebViewConfig';
import { probeExportOrigin } from '@/src/features/export/exportReachability';
import { buildExportConsentAckEvent } from '@/src/features/export/exportTelemetry';
import { resolveExportConsentAccessibility } from '@/src/features/export/exportAccessibility';
import { getAnonymousId, trackEvent } from '@/src/lib/analytics';

const CAPTURE_KEY = 'corso-key-export';

export default function ExportScreen() {
  const { session } = useCorsoSession();
  const stepUp = useStepUpConfirm();

  const entry = useMemo(() => resolveExportEntryPointFromEnv(), []);
  const exportUrl = useMemo(() => {
    if (!entry.enabled) return null;
    const built = buildExportUrl(entry.origin, {
      address: session?.address,
      privyUserId: session?.privyUserId,
      privyWalletId: session?.privyWalletId,
    });
    return built.ok ? built.url : null;
  }, [entry, session?.address, session?.privyUserId, session?.privyWalletId]);

  const [stage, setStage] = useState<ConsentStage>('gate1');
  const [gate1, setGate1] = useState<Gate1State>({
    copyRendered: false,
    scrolledToEnd: false,
    acknowledged: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const webViewRef = useRef<ExportWebViewRef | null>(null);
  const renderedBlocks = useRef(0);

  const a11y = resolveExportConsentAccessibility({
    confirmEnabled: isGate1ConfirmEnabled(gate1),
    busy,
  });

  useEffect(() => {
    void (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync(CAPTURE_KEY);
        if (Platform.OS === 'ios') {
          try {
            await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
          } catch {
            // Overlay is best-effort; preventScreenCapture already holds.
          }
        }
      } catch {
      }
    })();
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(CAPTURE_KEY);
      if (Platform.OS === 'ios') {
        void ScreenCapture.disableAppSwitcherProtectionAsync();
      }
    };
  }, []);

  // Backgrounding during a reveal tears the page down. Fail closed, always.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        closeWebView('gate3');
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      teardownExportWebView(webViewRef.current);
      webViewRef.current = null;
    };
  }, []);

  const closeWebView = useCallback((next: ConsentStage) => {
    setStage((current) => {
      if (current !== 'webview') return current;
      teardownExportWebView(webViewRef.current);
      webViewRef.current = null;
      return next;
    });
  }, []);

  const onBlockLayout = useCallback((total: number) => {
    renderedBlocks.current += 1;
    if (renderedBlocks.current >= total) {
      setGate1((prev) =>
        prev.copyRendered ? prev : { ...prev, copyRendered: true },
      );
    }
  }, []);

  const onScroll = useCallback(
    (
      event: NativeSyntheticEvent<{
        contentOffset: { y: number };
        contentSize: { height: number };
        layoutMeasurement: { height: number };
      }>,
    ) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const atEnd =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 24;
      if (atEnd) {
        setGate1((prev) =>
          prev.scrolledToEnd ? prev : { ...prev, scrolledToEnd: true },
        );
      }
    },
    [],
  );

  async function onConfirm() {
    setError(null);
    setBusy(true);
    try {
      stepUp.bindSession(session);
      clearStepUpCache();

      let stepUpPassed = false;
      try {
        stepUpPassed = await stepUp.verifyPrivyMfa();
      } catch {
        stepUpPassed = false;
      }

      const acknowledged: Gate1State = { ...gate1, acknowledged: true };
      setGate1(acknowledged);

      const decision = canLaunchExportWebView({
        entryEnabled: entry.enabled && Boolean(exportUrl),
        gate1: acknowledged,
        stepUpPassed,
        sessionType: session?.type,
      });
      if (!decision.launch) {
        setError(launchRefusalMessage(decision.reason));
        setStage('gate1');
        return;
      }

      const ack = buildExportConsentAckEvent({
        anonymousId: await getAnonymousId(),
        consentVersion: EXPORT_CONSENT_VERSION,
        timestamp: new Date().toISOString(),
      });
      if (ack.ok) trackEvent(ack.name, ack.properties);

      setStage('launching');
      const reachable = await probeExportOrigin(exportUrl!);
      if (!reachable.reachable) {
        setError(EXPORT_CONSENT_COPY.errors.originUnreachable);
        setStage('gate1');
        return;
      }

      setStage('webview');
    } finally {
      setBusy(false);
    }
  }

  function onBridgeMessage(event: WebViewMessageEvent) {
    const result = parseExportBridgeMessage(event.nativeEvent.data);
    if (!shouldDismissOnBridgeResult(result)) return;
    if (result.status === 'error') {
      setError(
        result.code === 'cancelled'
          ? EXPORT_CONSENT_COPY.errors.exportCancelled
          : EXPORT_CONSENT_COPY.errors.exportFailed,
      );
    }
    closeWebView('gate3');
  }

  if (!entry.enabled || !exportUrl) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.body}>
          <Text style={styles.title} accessibilityRole="header">
            {EXPORT_CONSENT_COPY.gate1.title}
          </Text>
          <Text
            style={styles.errorText}
            accessibilityRole={a11y.error.accessibilityRole}
            accessibilityLiveRegion={a11y.error.accessibilityLiveRegion}
          >
            {EXPORT_CONSENT_COPY.errors.entryDisabled}
          </Text>
          <Pressable
            style={styles.secondary}
            onPress={() => goBackOr(BACK_FALLBACK.keys)}
            {...a11y.cancel}
          >
            <Text style={styles.secondaryLabel} accessible={false}>
              {EXPORT_CONSENT_COPY.gate1.cancel}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const blocks = [
    EXPORT_CONSENT_COPY.gate1.lede,
    ...EXPORT_CONSENT_COPY.gate1.bullets,
    EXPORT_CONSENT_COPY.gate1.outro,
  ];
  const totalBlocks = blocks.length + 1; // + title
  const confirmEnabled = isGate1ConfirmEnabled(gate1) && !busy;
  const webViewConfig = buildExportWebViewConfig(entry.origin);

  return (
    <SafeAreaView style={styles.safe}>
      {stage === 'gate3' ? (
        <View style={styles.body}>
          <Text
            style={styles.gate3}
            accessibilityRole={a11y.gate3.accessibilityRole}
            accessibilityLiveRegion={a11y.gate3.accessibilityLiveRegion}
          >
            {EXPORT_CONSENT_COPY.gate3.body}
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryCTA
            label={EXPORT_CONSENT_COPY.gate3.done}
            onPress={() => goBackOr(BACK_FALLBACK.keys)}
          />
        </View>
      ) : (
        <>
          <View style={styles.scrollWrap}>
            <ScrollView
              contentContainerStyle={styles.scroll}
              onScroll={onScroll}
              scrollEventThrottle={32}
            >
              <Text
                style={styles.title}
                onLayout={() => onBlockLayout(totalBlocks)}
                {...a11y.interstitial}
              >
                {EXPORT_CONSENT_COPY.gate1.title}
              </Text>
              {blocks.map((block) => (
                <Text
                  key={block}
                  style={styles.paragraph}
                  onLayout={() => onBlockLayout(totalBlocks)}
                >
                  {block}
                </Text>
              ))}

              {error ? (
                <Text
                  style={styles.errorText}
                  accessibilityRole={a11y.error.accessibilityRole}
                  accessibilityLiveRegion={a11y.error.accessibilityLiveRegion}
                >
                  {error}
                </Text>
              ) : null}

              {!confirmEnabled && !busy ? (
                <Text style={styles.hint}>
                  {EXPORT_CONSENT_COPY.gate1.scrollHint}
                </Text>
              ) : null}

              <PrimaryCTA
                label={EXPORT_CONSENT_COPY.gate1.confirm}
                disabled={!confirmEnabled}
                busy={busy}
                onPress={() => {
                  void onConfirm();
                }}
                accessibility={{
                  accessibilityLabel: a11y.confirm.accessibilityLabel,
                  accessibilityHint: a11y.confirm.accessibilityHint,
                  accessibilityState: a11y.confirm.accessibilityState,
                }}
              />

              <Pressable
                style={styles.secondary}
                onPress={() => goBackOr(BACK_FALLBACK.keys)}
                {...a11y.cancel}
              >
                <Text style={styles.secondaryLabel} accessible={false}>
                  {EXPORT_CONSENT_COPY.gate1.cancel}
                </Text>
              </Pressable>
            </ScrollView>
            <ScrollEdgeFade color={colors.canvas} />
          </View>

          <Modal
            visible={stage === 'webview'}
            animationType="slide"
            statusBarTranslucent
            navigationBarTranslucent
            onRequestClose={() => closeWebView('gate3')}
          >
            <SafeAreaView style={styles.safe}>
              <Pressable
                style={styles.secondary}
                onPress={() => closeWebView('gate3')}
                accessibilityRole="button"
                accessibilityLabel={EXPORT_CONSENT_COPY.gate1.cancel}
              >
                <Text style={styles.secondaryLabel} accessible={false}>
                  {EXPORT_CONSENT_COPY.gate1.cancel}
                </Text>
              </Pressable>
              {stage === 'webview' ? (
                <WebView
                  ref={(instance) => {
                    webViewRef.current = instance as ExportWebViewRef | null;
                  }}
                  source={{ uri: exportUrl }}
                  onMessage={onBridgeMessage}
                  onShouldStartLoadWithRequest={(request) => {
                    const decision = decideExportNavigation({
                      url: request.url,
                      allowedOrigin: entry.origin,
                      isTopFrame: request.isTopFrame,
                    });
                    if (decision.terminate) {
                      setError(EXPORT_CONSENT_COPY.errors.navigationBlocked);
                      closeWebView('gate3');
                    }
                    return decision.allow;
                  }}
                  onError={() => {
                    setError(EXPORT_CONSENT_COPY.errors.originUnreachable);
                    closeWebView('gate3');
                  }}
                  onHttpError={() => {
                    setError(EXPORT_CONSENT_COPY.errors.originUnreachable);
                    closeWebView('gate3');
                  }}
                  onContentProcessDidTerminate={() => {
                    setError(EXPORT_CONSENT_COPY.errors.exportFailed);
                    closeWebView('gate3');
                  }}
                  style={styles.webView}
                  {...webViewConfig}
                />
              ) : null}
            </SafeAreaView>
          </Modal>
        </>
      )}

      <StepUpSheet {...stepUp.sheet} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollWrap: { flex: 1, position: 'relative' },
  body: { flex: 1, padding: spacing.gutter, gap: spacing.md },
  scroll: {
    padding: spacing.gutter,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.face('620'),
    fontSize: CANON_TYPE_SIZES.askTitle,
    lineHeight: Math.round(CANON_TYPE_SIZES.askTitle * 1.16),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
    fontWeight: canonWeight('620'),
    color: colors.ink,
  },
  paragraph: {
    fontFamily: typography.face('450'),
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
    fontWeight: canonWeight('450'),
    color: colors.inkSecondary,
  },
  gate3: {
    fontFamily: typography.face('450'),
    fontSize: CANON_TYPE_SIZES.body,
    lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
    fontWeight: canonWeight('450'),
    color: colors.inkSecondary,
  },
  hint: {
    fontFamily: typography.face('500'),
    fontSize: CANON_TYPE_SIZES.sub,
    lineHeight: 16,
    fontWeight: canonWeight('500'),
    color: colors.inkTertiary,
  },
  errorText: {
    fontFamily: typography.face('550'),
    fontSize: CANON_TYPE_SIZES.sub,
    lineHeight: 16,
    fontWeight: canonWeight('550'),
    color: colors.destructive,
  },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: spacing.md,
  },
  secondaryLabel: {
    fontFamily: typography.face('550'),
    fontSize: CANON_TYPE_SIZES.body,
    fontWeight: canonWeight('550'),
    color: colors.inkTertiary,
  },
  webView: { flex: 1 },
});
