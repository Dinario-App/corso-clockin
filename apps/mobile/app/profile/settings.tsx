import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { AccountSectionHeading } from '@/src/features/account/ui/AccountSectionHeading';
import { resolveSettingsDetailPresentation } from '@/src/features/profile/settingsDetailPresentation';
import {
  getAppLockPreference,
  getBiometricLabel,
  isLocalAuthAvailable,
  promptAppUnlock,
} from '@/src/features/security/appLock';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { collectSupportDiagnostics } from '@/src/features/support/supportDiagnostics';
import {
  SUPPORT_EMAIL,
  buildSupportMailtoUrl,
} from '@/src/features/support/supportEmail';
import {
  analyticsSwitchAccessibilityLabel,
  isAnalyticsOptedOut,
  setAnalyticsOptedOut,
} from '@/src/lib/analytics';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { CorsoText } from '@/src/theme/CorsoText';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { canonWeight } from '@/src/ui/cards/canonType';
import { Banner } from '@/src/ui/feedback/Banner';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { AccountRow } from '@/src/ui/rows/AccountRow';
import {
  ACCOUNT_CARD_PADDING_HORIZONTAL,
  ACCOUNT_CARD_PADDING_VERTICAL,
} from '@/src/ui/rows/accountRowPresentation';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

export default function SettingsDetailScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const { markLockSetupComplete, session } = useCorsoSession();
  const { reduceMotion } = useAccessibilityPreference();
  const [biometricLabel, setBiometricLabel] = useState(NEUTRAL_BIOMETRIC_LABEL);
  const [biometricsOn, setBiometricsOn] = useState(false);
  const [biometricsReady, setBiometricsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const [analyticsReady, setAnalyticsReady] = useState(false);
  // Only shown after a mailto attempt actually fails — never pre-emptively.
  const [supportFallback, setSupportFallback] = useState(false);
  const [supportToast, setSupportToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getAppLockPreference(), getBiometricLabel()])
      .then(([preference, label]) => {
        if (cancelled) return;
        setBiometricsOn(preference === 'biometric');
        setBiometricLabel(label);
        setBiometricsReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(copy.profile.errorSetting);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void isAnalyticsOptedOut()
      .then((optedOut) => {
        if (cancelled) return;
        setAnalyticsOn(!optedOut);
        setAnalyticsReady(true);
      })
      .catch(() => {
        if (!cancelled) setError(copy.profile.errorSetting);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The switch reads "share usage analytics", the store reads "opted out", so
   * the write is the inverse. Same two calls `app/money.tsx:355-367` made — no
   * new consent surface, no new default.
   */
  async function changeAnalytics(nextEnabled: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await setAnalyticsOptedOut(!nextEnabled);
      setAnalyticsOn(nextEnabled);
      void Haptics.selectionAsync();
    } catch {
      setError(copy.profile.errorSetting);
    } finally {
      setBusy(false);
    }
  }

  async function changeBiometrics(nextEnabled: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (nextEnabled && !(await isLocalAuthAvailable())) {
        setError(copy.profile.biometricsUnavailable);
        return;
      }
      if (!(await promptAppUnlock()).success) return;
      // Off is not "no lock": the fallback is the passcode preference
      // lock-setup already uses. Never skip app lock from here.
      await markLockSetupComplete(nextEnabled ? 'biometric' : 'passcode');
      setBiometricsOn(nextEnabled);
      void Haptics.selectionAsync();
    } catch {
      setError(copy.profile.errorSetting);
    } finally {
      setBusy(false);
    }
  }

  async function onContactSupport() {
    setSupportFallback(false);
    try {
      const url = buildSupportMailtoUrl(
        collectSupportDiagnostics(session?.type),
      );
      await Linking.openURL(url);
      void Haptics.selectionAsync();
    } catch {
      setSupportFallback(true);
    }
  }

  async function onCopySupportAddress() {
    try {
      await Clipboard.setStringAsync(SUPPORT_EMAIL);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSupportToast(copy.support.toastAddressCopied);
    } catch {
      showSupportToast(copy.support.toastCopyFailed);
    }
  }

  function showSupportToast(message: string) {
    setSupportToast(message);
    setTimeout(() => setSupportToast(null), 1600);
  }

  const settings = resolveSettingsDetailPresentation({
    biometricLabel,
    biometricsOn,
    biometricsReady,
    busy,
    reduceMotion,
    analyticsOn,
    analyticsReady,
  });

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AccountScreenHeader
          family="desk"
          title={settings.title}
          onBack={() => goBackOr(BACK_FALLBACK.accountTab)}
          backAccessibilityLabel={copy.v1.back}
          testID="settings-header"
        />

        <View style={styles.scrollWrap}>
          <ScrollView
            {...scrollFade.scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {settings.sections.map((section, sectionIndex) => (
              <View key={section.id}>
                <AccountSectionHeading
                  label={section.heading}
                  first={sectionIndex === 0}
                />
                <SettingsCard
                  contentStyle={styles.cardContent}
                  testID={`settings-card-${section.id}`}
                >
                  {section.rows.map((row, index) => {
                    const last = index === section.rows.length - 1;
                    if (row.kind === 'switch') {
                      // Two switches now, and they drive different stores. The
                      // row id is what says which — never the position.
                      const isAnalytics = row.id === 'analytics';
                      return (
                        <AccountRow
                          key={row.id}
                          glyph={row.glyph}
                          label={row.label}
                          sub={row.sub}
                          accessory="switch"
                          checked={row.checked}
                          switchDisabled={row.disabled}
                          onValueChange={(value) => {
                            if (isAnalytics) {
                              void changeAnalytics(value);
                              return;
                            }
                            void changeBiometrics(value);
                          }}
                          accessibilityLabel={
                            isAnalytics
                              ? analyticsSwitchAccessibilityLabel(row.checked)
                              : undefined
                          }
                          accessibilityHint={
                            isAnalytics
                              ? copy.profile.analyticsSwitchHint
                              : undefined
                          }
                          last={last}
                          testID={`settings-row-${row.id}`}
                        />
                      );
                    }
                    if (row.kind === 'action') {
                      return (
                        <AccountRow
                          key={row.id}
                          glyph={row.glyph}
                          label={row.label}
                          sub={row.sub}
                          accessory="chevron"
                          onPress={() => {
                            void onContactSupport();
                          }}
                          last={last}
                          testID={`settings-row-${row.id}`}
                        />
                      );
                    }
                    if (row.kind === 'value') {
                      return (
                        <AccountRow
                          key={row.id}
                          glyph={row.glyph}
                          label={row.label}
                          sub={row.sub}
                          accessory="value"
                          value={row.value}
                          family="desk"
                          last={last}
                          testID={`settings-row-${row.id}`}
                        />
                      );
                    }
                    return (
                      <AccountRow
                        key={row.id}
                        glyph={row.glyph}
                        label={row.label}
                        accessory="chevron"
                        onPress={() => router.push(row.href as never)}
                        last={last}
                        testID={`settings-row-${row.id}`}
                      />
                    );
                  })}
                </SettingsCard>
              </View>
            ))}

            {error ? <Banner message={error} tone="warning" /> : null}

            {/*
          Mail could not open, or the body failed the secrets guard. Show the
          address so the person is not stranded, and copy THAT and nothing
          else.
        */}
            {supportFallback ? (
              <View style={styles.section} testID="settings-support-fallback">
                <Banner message={copy.support.fallbackBody} tone="info" />
                <SettingsCard contentStyle={styles.cardContent}>
                  <AccountRow
                    glyph="mail"
                    label={copy.support.fallbackTitle}
                    accessory="none"
                    last
                  />
                </SettingsCard>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.support.copyAddress}
                  onPress={() => {
                    void onCopySupportAddress();
                  }}
                  style={styles.copyButton}
                  testID="settings-support-copy-address"
                >
                  <CorsoText style={styles.copyButtonLabel}>
                    {copy.support.copyAddress}
                  </CorsoText>
                </Pressable>
                {supportToast ? (
                  <CorsoText style={styles.supportToast}>
                    {supportToast}
                  </CorsoText>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
          <ScrollEdgeFade
            top={scrollFade.top}
            color={ethena.groundStops[0][1]}
          />
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollWrap: { flex: 1, position: 'relative' },
  scroll: { flex: 1 },
  body: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 16,
    paddingBottom: 64,
  },
  section: { gap: 8 },
  /** `.rows{padding:4px 8px}` — the pane's inset; the row adds its own 6. */
  cardContent: {
    paddingHorizontal: ACCOUNT_CARD_PADDING_HORIZONTAL,
    paddingVertical: ACCOUNT_CARD_PADDING_VERTICAL,
  },
  /** Neutral ink, never azure: this is a recovery affordance, not the CTA. */
  copyButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  copyButtonLabel: {
    color: ethena.ink.primary,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: canonWeight('600'),
  },
  supportToast: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    paddingHorizontal: 4,
  },
});
