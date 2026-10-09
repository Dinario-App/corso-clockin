import { ScrollView, StyleSheet, View } from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CorsoText } from '@/src/theme/CorsoText';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  assertNoForbiddenSettingsLabels,
  resolveNotificationPreferencesPresentation,
  visibleSettingsCopyValues,
} from '@/src/features/profile/settingsRoutePresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';

const preferences = resolveNotificationPreferencesPresentation();

assertNoForbiddenSettingsLabels([
  ...visibleSettingsCopyValues(),
  preferences.title,
  preferences.body,
]);

export default function NotificationPreferencesScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  return (
    <EthenaGround>
<SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AccountScreenHeader
        family="desk"
        title={preferences.title}
        onBack={() => goBackOr(BACK_FALLBACK.notificationsHub)}
        backAccessibilityLabel={copy.v1.back}
        testID="profile-notification-preferences-header"
      />

      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <CorsoText style={styles.bodyText}>{preferences.body}</CorsoText>
        </ScrollView>
        <ScrollEdgeFade top={scrollFade.top} color={ethena.groundStops[0][1]} />
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
    paddingBottom: 32 * 2,
  },
  bodyText: {
    marginTop: 16,
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
  },
});
