import { ScrollView, StyleSheet, View } from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  assertNoForbiddenSettingsLabels,
  resolvePreferencesPresentation,
  visibleSettingsCopyValues,
} from '@/src/features/profile/settingsRoutePresentation';
import { SettingsRow } from '@/src/ui/rows/SettingsRow';
import {
  ACCOUNT_CARD_PADDING_HORIZONTAL,
  ACCOUNT_CARD_PADDING_VERTICAL,
} from '@/src/ui/rows/accountRowPresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { useHideBalancesSetting } from '@/src/features/balances/hideBalancesPreference';

const preferences = resolvePreferencesPresentation();

assertNoForbiddenSettingsLabels([
  ...visibleSettingsCopyValues(),
  preferences.title,
  ...preferences.rows.map((row) => row.label),
]);

export default function PreferencesScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const hideBalances = useHideBalancesSetting();
  return (
    <EthenaGround>
<SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AccountScreenHeader
        family="desk"
        title={preferences.title}
        onBack={() => goBackOr(BACK_FALLBACK.settingsHub)}
        backAccessibilityLabel={copy.v1.back}
        testID="profile-preferences-header"
      />

      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <SettingsCard contentStyle={styles.cardContent}>
            {preferences.rows.map((row, index) => {
              const last = index === preferences.rows.length - 1;
              if (row.id === 'currency') {
                return (
                  <SettingsRow
                    key={row.id}
                    accessory="value"
                    glyph={row.glyph}
                    label={row.label}
                    value={row.value}
                    family="desk"
                    last={last}
                    accessibilityLabel={row.label}
                  />
                );
              }

              return (
                <SettingsRow
                  key={row.id}
                  accessory="switch"
                  glyph={row.glyph}
                  label={row.label}
                  family="desk"
                  last={last}
                  checked={hideBalances.hidden}
                  switchDisabled={!hideBalances.hydrated}
                  onValueChange={hideBalances.setHidden}
                  accessibilityLabel={row.label}
                  testID="profile-preferences-hide-balances"
                />
              );
            })}
          </SettingsCard>
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
  /** `.rows{padding:4px 8px}` — the pane's inset; the row adds its own 6. */
  cardContent: {
    paddingHorizontal: ACCOUNT_CARD_PADDING_HORIZONTAL,
    paddingVertical: ACCOUNT_CARD_PADDING_VERTICAL,
  },
});
