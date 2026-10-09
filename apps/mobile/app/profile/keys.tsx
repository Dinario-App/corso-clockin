import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import { resolveSafeRevealCeremony } from '@/src/features/security/safeRevealPresentation';
import { EXPORT_PAGE_PATH } from '@/src/features/export/exportConfig';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

/** The ground tray the intro's card stands on (material law, `ground`). */

export default function ExportWalletIntroScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const tray = useEthenaMaterial('ground');
  const trayPaint = {
    backgroundColor: tray.fill as string,
    borderWidth: tray.borderWidth,
    borderColor: tray.borderColor ?? undefined,
  };
  const { session } = useCorsoSession();
  // The export door never names a biometric; the neutral label satisfies the
  // shared resolver and no prompt is raised from this screen.
  const ceremony = resolveSafeRevealCeremony({
    door: 'export',
    biometricLabel: NEUTRAL_BIOMETRIC_LABEL,
  });

  // The sheet only draws this row on the sign-in door; a stray deep link from
  // an imported session gets the honest refusal `/export` already carries.
  const continueLabel = ceremony.cta;
  const canContinue = session?.type !== 'imported_seed';

  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <AccountScreenHeader
        family="desk"
        title={ceremony.title}
        onBack={() => goBackOr(BACK_FALLBACK.securityHub)}
        backAccessibilityLabel={copy.v1.back}
        testID="profile-keys-header"
      />

      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          contentContainerStyle={styles.body}
        >
          <Text style={styles.eyebrow}>{ceremony.eyebrow}</Text>
          <Text style={styles.intro}>{ceremony.intro}</Text>

          <View testID="profile-keys-card" style={[styles.card, trayPaint]}>
            <Text style={styles.stepLabel}>{ceremony.stepLabel}</Text>
            <Text style={styles.step}>{ceremony.step}</Text>
            <View style={styles.divider} />
            <Text style={styles.warning}>{ceremony.warning}</Text>
          </View>
        </ScrollView>
        <ScrollEdgeFade top={scrollFade.top} color={ethena.groundStops[0][1]} />
      </View>

      <View style={styles.footer}>
        <PrimaryCTA
          label={continueLabel}
          disabled={!canContinue}
          onPress={() => router.push(EXPORT_PAGE_PATH)}
        />
        <TextButton
          label={ceremony.cancel}
          onPress={() => goBackOr(BACK_FALLBACK.securityHub)}
        />
      </View>
    </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { flex: 1, position: 'relative' },
  safe: { flex: 1 },
  /** The desk gutter, the same one the `family="desk"` header row reads. */
  body: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 32,
    paddingBottom: 32,
  },
  eyebrow: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    fontWeight: '600',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  intro: {
    ...ETHENA_TYPE.body,
    marginTop: 16,
    color: ethena.ink.secondary,
  },
  card: {
    marginTop: 32,
    borderRadius: ethenaGeometry.radiusBox,
    padding: 24,
  },
  stepLabel: {
    ...ETHENA_TYPE.rowSub,
    color: ethena.ink.tertiary,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  step: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
  },
  divider: {
    marginVertical: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ethena.hair,
  },
  warning: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: ethenaGeometry.gutter,
    paddingBottom: 8,
  },
});
