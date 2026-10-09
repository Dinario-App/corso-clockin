import { ScrollView, StyleSheet, View } from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  assertNoForbiddenSecurityLabels,
  assertNoUnreachableSecurityHref,
  resolveSecurityRecoveryPresentation,
  securityRecoveryBodies,
  visibleSecurityCopyValues,
} from '@/src/features/profile/securityRoutePresentation';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { CorsoText } from '@/src/theme/CorsoText';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';

const recoveryTitle = resolveSecurityRecoveryPresentation().title;

assertNoForbiddenSecurityLabels([
  ...visibleSecurityCopyValues(),
  recoveryTitle,
  ...securityRecoveryBodies(),
]);
assertNoUnreachableSecurityHref([
  resolveSecurityRecoveryPresentation().phraseHref,
]);

export default function SecurityRecoveryScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const { session } = useCorsoSession();
  const recovery = resolveSecurityRecoveryPresentation({
    sessionType: session?.type,
  });
  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AccountScreenHeader
          family="desk"
          title={recovery.title}
          onBack={() => goBackOr(BACK_FALLBACK.securityHub)}
          backAccessibilityLabel={copy.v1.back}
          testID="security-recovery-header"
        />

        <View style={styles.scrollWrap}>
          <ScrollView
            {...scrollFade.scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <CorsoText style={styles.bodyText}>{recovery.body}</CorsoText>
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
  bodyText: {
    marginTop: 16,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: '400',
    lineHeight: 22,
    color: ethena.ink.primary,
  },
});
