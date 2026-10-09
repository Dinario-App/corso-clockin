import { useMwaAvailability } from '@/src/features/connect/useMwaAvailability';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import * as Haptics from 'expo-haptics';
import { usePrivy } from '@privy-io/expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { resolveDeleteEntryPresentation } from '@/src/features/account/deleteEntryPresentation';
import {
  getAppLockPreference,
  getBiometricLabel,
  isLocalAuthAvailable,
  promptAppUnlock,
} from '@/src/features/security/appLock';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import {
  SECURITY_BIOMETRICS_UNAVAILABLE,
  SECURITY_KEYS_HREF,
  SECURITY_LOCK_ENABLE_FAILED,
  SECURITY_MFA_HREF,
  SECURITY_RECOVERY_HREF,
  SECURITY_WORDS_HREF,
  assertNoForbiddenSecurityLabels,
  assertNoUnreachableSecurityHref,
  resolveSecurityHubRows,
  visibleSecurityCopyValues,
} from '@/src/features/profile/securityRoutePresentation';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { CorsoText } from '@/src/theme/CorsoText';
import { Banner } from '@/src/ui/feedback/Banner';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { SettingsRow } from '@/src/ui/rows/SettingsRow';
import {
  ACCOUNT_CARD_PADDING_HORIZONTAL,
  ACCOUNT_CARD_PADDING_VERTICAL,
} from '@/src/ui/rows/accountRowPresentation';
import { PasscodeKeypad } from '@/src/features/onboarding/PasscodeKeypad';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

assertNoForbiddenSecurityLabels(visibleSecurityCopyValues());
assertNoUnreachableSecurityHref([
  SECURITY_RECOVERY_HREF,
  SECURITY_MFA_HREF,
  SECURITY_WORDS_HREF,
  SECURITY_KEYS_HREF,
]);

export default function SecurityHubScreen() {
  const connectAvailable = useMwaAvailability();
  const scrollFade = useScrollLinkedFadeTop();
  const { user, isReady } = usePrivy();
  const {
    markLockSetupComplete,
    session,
    hasImportedWalletOnPhone,
    connectedStatus,
  } = useCorsoSession();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState(NEUTRAL_BIOMETRIC_LABEL);

  const rows = resolveSecurityHubRows({
    biometricsEnabled,
    mfaApplicable: session?.type === 'privy_embedded',
    mfaMethods: user?.mfa_methods?.map((method) => method.type) ?? [],
    sessionType: session?.type,
    biometricLabel,
  });
  const deleteEntry = resolveDeleteEntryPresentation({
    hasCorsoServerAccount: isReady ? Boolean(user) : null,
    hasImportedWalletOnPhone,
    hasConnectedWalletOnPhone: connectedStatus !== 'none',
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const preference = await getAppLockPreference();
      if (cancelled) return;
      setBiometricsEnabled(preference === 'biometric');
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getBiometricLabel()
      .then((label) => {
        if (!cancelled) setBiometricLabel(label);
      })
      .catch(() => {
        // The neutral label is the honest fallback; the row still draws.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onBiometricsChange(nextEnabled: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (nextEnabled) {
        const available = await isLocalAuthAvailable();
        if (!available) {
          setError(SECURITY_BIOMETRICS_UNAVAILABLE);
          return;
        }
      }
      const result = await promptAppUnlock();
      if (!result.success) return;
      await markLockSetupComplete(nextEnabled ? 'biometric' : 'passcode');
      setBiometricsEnabled(nextEnabled);
      void Haptics.selectionAsync();
    } catch {
      setError(SECURITY_LOCK_ENABLE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  async function onChangePasscode(passcode: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const method = biometricsEnabled ? 'biometric' : 'passcode';
      await markLockSetupComplete(method, passcode);
      setPasscodeOpen(false);
      void Haptics.selectionAsync();
    } catch {
      setError(SECURITY_LOCK_ENABLE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AccountScreenHeader
          family="desk"
          title={copy.profile.securityTitle}
          onBack={() => goBackOr(BACK_FALLBACK.accountTab)}
          backAccessibilityLabel={copy.v1.back}
          testID="security-hub-header"
        />

        <View style={styles.scrollWrap}>
          <ScrollView
            {...scrollFade.scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <SettingsCard contentStyle={styles.cardContent}>
              {rows.map((row) => {
                if (row.id === 'biometrics') {
                  return (
                    <SettingsRow
                      key={row.id}
                      accessory="switch"
                      glyph={row.glyph}
                      label={row.label}
                      checked={row.checked}
                      switchDisabled={!ready || busy || row.disabled}
                      onValueChange={(value) => {
                        void onBiometricsChange(value);
                      }}
                      accessibilityLabel={row.label}
                    />
                  );
                }

                if (row.id === 'change-passcode') {
                  return (
                    <SettingsRow
                      key={row.id}
                      accessory="chevron"
                      glyph={row.glyph}
                      label={row.label}
                      onPress={() => setPasscodeOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel={row.label}
                    />
                  );
                }

                if (row.id === 'reveal-phrase' || row.id === 'export-key') {
                  return (
                    <View key={row.id}>
                      <CorsoText style={styles.revealEyebrow}>
                        {row.eyebrow}
                      </CorsoText>
                      <SettingsRow
                        accessory="chevron"
                        glyph={row.glyph}
                        label={row.label}
                        onPress={() => router.push(row.href)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          row.hint ? `${row.label}. ${row.hint}` : row.label
                        }
                        testID={`security-row-${row.id}`}
                      />
                      {row.hint ? (
                        <CorsoText style={styles.revealHint}>
                          {row.hint}
                        </CorsoText>
                      ) : null}
                    </View>
                  );
                }

                if (row.id === 'wallet-signing-check') {
                  return (
                    <SettingsRow
                      key={row.id}
                      accessory="value"
                      glyph={row.glyph}
                      label={row.label}
                      value={row.value}
                      family="desk"
                      onPress={() => router.push(SECURITY_MFA_HREF)}
                      accessibilityRole="button"
                      accessibilityLabel={`${row.label}, ${row.value}`}
                    />
                  );
                }

                return (
                  <SettingsRow
                    key={row.id}
                    accessory="chevron"
                    glyph={row.glyph}
                    label={row.label}
                    onPress={() => router.push(SECURITY_RECOVERY_HREF)}
                    accessibilityRole="button"
                    accessibilityLabel={row.label}
                  />
                );
              })}
              {connectAvailable ? <SettingsRow accessory="chevron" glyph="lock" label={copy.connect.title} onPress={() => router.push('/(auth)/connect')} accessibilityRole="button" accessibilityLabel={copy.connect.title} /> : null}
              <SettingsRow
                accessory="chevron"
                glyph="warning"
                tone="destructive"
                last
                label={deleteEntry.label}
                onPress={() => router.push('/profile/delete')}
                accessibilityRole="button"
                accessibilityLabel={deleteEntry.accessibilityLabel}
              />
            </SettingsCard>

            {error ? <Banner message={error} tone="warning" /> : null}
          </ScrollView>
          <ScrollEdgeFade
            top={scrollFade.top}
            color={ethena.groundStops[0][1]}
          />
        </View>
        <BottomSheet
          title={copy.profile.securityChangePasscode}
          visible={passcodeOpen}
          dismissible={!busy}
          signing={busy}
          onRequestClose={() => setPasscodeOpen(false)}
          testID="security-change-passcode-sheet"
        >
          <View style={styles.passcodeWrap}>
            <PasscodeKeypad
              onComplete={(passcode) => {
                void onChangePasscode(passcode);
              }}
            />
          </View>
        </BottomSheet>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollWrap: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 16,
    paddingBottom: 64,
  },
  /** `.rows{padding:4px 8px}` — the pane's inset; the row adds its own 6. */
  cardContent: {
    paddingHorizontal: ACCOUNT_CARD_PADDING_HORIZONTAL,
    paddingVertical: ACCOUNT_CARD_PADDING_VERTICAL,
  },
  passcodeWrap: {
    minHeight: 620,
  },
  revealEyebrow: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.rowSub.fontSize,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  revealHint: {
    color: ethena.ink.tertiary,
    fontSize: ETHENA_TYPE.rowSub.fontSize,
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
});
