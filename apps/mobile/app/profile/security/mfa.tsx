import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { useMfaEnrollment, usePrivy } from '@privy-io/expo';
import { useLinkWithPasskey } from '@privy-io/expo/passkey';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  extractPasskeyCredentialIds,
  mayContinueMfaEnrollment,
} from '@/src/features/security/mfaEnrollment';
import { sessionIdentityKey } from '@/src/features/security/mfaSessionGuard';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { Banner } from '@/src/ui/feedback/Banner';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

export default function MfaEnrollmentScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const { user } = usePrivy();
  const { session } = useCorsoSession();
  const liveSessionRef = useRef(session);
  liveSessionRef.current = session;
  const { initMfaEnrollment, submitMfaEnrollment } = useMfaEnrollment();
  const { linkWithPasskey } = useLinkWithPasskey();
  const [busy, setBusy] = useState(false);
  const [totpOpen, setTotpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentEpoch, setEnrollmentEpoch] = useState(0);
  const totpStartedSessionKeyRef = useRef<string | null>(null);

  const methods = user?.mfa_methods?.map((method) => method.type) ?? [];
  const hasPasskey = methods.includes('passkey');
  const hasTotp = methods.includes('totp');
  const embeddedWallet = session?.type === 'privy_embedded';
  const relyingParty =
    process.env.EXPO_PUBLIC_PRIVY_MFA_RELYING_PARTY?.trim() || undefined;

  function sameLiveSession(startedSessionKey: string): boolean {
    return mayContinueMfaEnrollment({
      startedSessionKey,
      currentSession: liveSessionRef.current,
    });
  }

  async function enrollPasskey() {
    const startedSessionKey = sessionIdentityKey(liveSessionRef.current);
    if (!startedSessionKey || !embeddedWallet || !relyingParty || busy) return;
    setBusy(true);
    setError(null);
    try {
      let credentialIds = extractPasskeyCredentialIds(user?.linked_accounts);
      if (credentialIds.length === 0) {
        const linkedUser = await linkWithPasskey({ relyingParty });
        if (!sameLiveSession(startedSessionKey)) return;
        credentialIds = extractPasskeyCredentialIds(
          linkedUser?.linked_accounts,
        );
      }
      if (credentialIds.length === 0 || !sameLiveSession(startedSessionKey)) {
        throw new Error('passkey_credential_unavailable');
      }
      await initMfaEnrollment({ method: 'passkey' });
      if (!sameLiveSession(startedSessionKey)) return;
      await submitMfaEnrollment({ method: 'passkey', credentialIds });
      if (!sameLiveSession(startedSessionKey)) return;
      setEnrollmentEpoch((value) => value + 1);
    } catch {
      if (sameLiveSession(startedSessionKey)) {
        setError(copy.profile.securityMfaFailed);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AccountScreenHeader
        family="desk"
        title={copy.profile.securitySigningCheck}
        onBack={() => goBackOr(BACK_FALLBACK.securityHub)}
        backAccessibilityLabel={copy.v1.back}
        testID="security-mfa-header"
      />
      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          contentContainerStyle={styles.body}
        >
          <Text style={styles.mechanism}>
            {copy.profile.securityMfaMechanism}
          </Text>

          {!embeddedWallet ? (
            <Banner
              message={copy.profile.securityMfaWrongWallet}
              tone="warning"
            />
          ) : (
            <>
              <SettingsCard contentStyle={styles.cardContent}>
                <Text style={styles.cardTitle}>
                  {copy.profile.securityMfaPasskey}
                </Text>
                <Text style={styles.cardBody}>
                  {copy.profile.securityMfaPasskeyBody}
                </Text>
                {hasPasskey ? (
                  <Text style={styles.state}>
                    {copy.profile.securityMfaEnrolled}
                  </Text>
                ) : (
                  <PrimaryCTA
                    label={copy.profile.securityMfaSetUpPasskey}
                    onPress={() => void enrollPasskey()}
                    disabled={!relyingParty}
                    busy={busy}
                  />
                )}
                {!hasPasskey && !relyingParty ? (
                  <Text style={styles.unavailable}>
                    {copy.profile.securityMfaPasskeyUnavailable}
                  </Text>
                ) : null}
              </SettingsCard>

              <SettingsCard contentStyle={styles.cardContent}>
                <Text style={styles.cardTitle}>
                  {copy.profile.securityMfaTotp}
                </Text>
                <Text style={styles.cardBody}>
                  {copy.profile.securityMfaTotpBody}
                </Text>
                {hasTotp ? (
                  <Text style={styles.state}>
                    {copy.profile.securityMfaEnrolled}
                  </Text>
                ) : (
                  <PrimaryCTA
                    label={copy.profile.securityMfaSetUpTotp}
                    onPress={() => {
                      totpStartedSessionKeyRef.current = sessionIdentityKey(
                        liveSessionRef.current,
                      );
                      setTotpOpen(true);
                    }}
                    disabled={busy}
                  />
                )}
              </SettingsCard>
              <Text style={styles.note}>
                {copy.profile.securityMfaRecovery}
              </Text>
              <Text style={styles.note}>
                {copy.profile.securityMfaAccountLimit}
              </Text>
            </>
          )}

          {error ? <Banner message={error} tone="warning" /> : null}
        </ScrollView>
        <ScrollEdgeFade top={scrollFade.top} color={ethena.groundStops[0][1]} />
      </View>

      <StepUpSheet
        key={enrollmentEpoch}
        visible={totpOpen && embeddedWallet}
        mode="enroll"
        thresholdLabel=""
        enrollmentBody={copy.profile.securityMfaMechanism}
        surface="swap"
        session={session}
        onVerified={(completedSessionKey) => {
          const current = sessionIdentityKey(liveSessionRef.current);
          const started = totpStartedSessionKeyRef.current;
          if (
            started &&
            completedSessionKey === started &&
            current === started
          ) {
            setTotpOpen(false);
            totpStartedSessionKeyRef.current = null;
            setEnrollmentEpoch((value) => value + 1);
          } else {
            setError(copy.profile.securityMfaFailed);
          }
        }}
        onCancel={() => {
          totpStartedSessionKeyRef.current = null;
          setTotpOpen(false);
        }}
      />
    </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { flex: 1, position: 'relative' },
  safe: { flex: 1 },
  body: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 16,
    paddingBottom: 64,
    gap: 16,
  },
  mechanism: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.secondary,
  },
  /** Inner box only: the material, radius and clipping belong to the lens. */
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    ...ETHENA_TYPE.cardHeading,
    color: ethena.ink.primary,
  },
  cardBody: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
    marginVertical: 8,
  },
  state: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.secondary,
    paddingVertical: 8,
  },
  unavailable: { ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary },
  note: { ...ETHENA_TYPE.rowSub, color: ethena.ink.tertiary },
});
