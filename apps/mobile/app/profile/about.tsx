import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import { resolveDeleteEntryPresentation } from '@/src/features/account/deleteEntryPresentation';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { PROFILE_LEGAL_ROW_LABELS } from '@/src/features/profile/profileRoutePresentation';
import {
  PROFILE_PRIVACY_HREF,
  assertNoForbiddenSettingsLabels,
  assertNoUnreachableSettingsHref,
  resolveAboutPresentation,
  visibleSettingsCopyValues,
} from '@/src/features/profile/settingsRoutePresentation';
import { LEGAL_URLS } from '@/src/lib/legalUrls';
import { SettingsRow } from '@/src/ui/rows/SettingsRow';
import {
  ACCOUNT_CARD_PADDING_HORIZONTAL,
  ACCOUNT_CARD_PADDING_VERTICAL,
} from '@/src/ui/rows/accountRowPresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

const LEGAL_ROWS = [
  {
    label: copy.profile.aboutSupport,
    url: LEGAL_URLS.support,
    glyph: 'help',
  },
  {
    label: copy.profile.aboutPrivacy,
    href: PROFILE_PRIVACY_HREF,
    glyph: 'lock',
  },
  {
    label: copy.profile.aboutTerms,
    url: LEGAL_URLS.terms,
    glyph: 'copy',
  },
  {
    label: copy.profile.aboutEmailSupport,
    url: LEGAL_URLS.supportEmail,
    glyph: 'mail',
  },
] as const;

const about = resolveAboutPresentation({
  version: Constants.expoConfig?.version,
  legalRows: LEGAL_ROWS,
});

assertNoForbiddenSettingsLabels([
  ...visibleSettingsCopyValues(),
  about.title,
  about.versionLabel,
  about.versionValue,
  ...about.legalRows.map((row) => row.label),
  ...PROFILE_LEGAL_ROW_LABELS,
]);
assertNoUnreachableSettingsHref([
  ...about.legalRows.map((row) => row.href ?? row.url),
]);

export default function AboutScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const { user, isReady } = usePrivy();
  const { hasImportedWalletOnPhone, connectedStatus } = useCorsoSession();
  const deleteEntry = resolveDeleteEntryPresentation({
    hasCorsoServerAccount: isReady ? Boolean(user) : null,
    hasImportedWalletOnPhone,
    hasConnectedWalletOnPhone: connectedStatus !== 'none',
  });

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AccountScreenHeader
          family="desk"
          title={about.title}
          onBack={() => goBackOr(BACK_FALLBACK.settingsHub)}
          backAccessibilityLabel={copy.v1.back}
          testID="profile-about-header"
        />

        <View style={styles.scrollWrap}>
          <ScrollView
            {...scrollFade.scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <SettingsCard contentStyle={styles.cardContent}>
              <SettingsRow
                accessory="value"
                glyph="more"
                label={about.versionLabel}
                value={about.versionValue}
                family="desk"
                accessibilityLabel={about.versionLabel}
              />
              {about.legalRows.map((row) => (
                <SettingsRow
                  key={row.label}
                  accessory="chevron"
                  glyph={row.glyph ?? 'mail'}
                  label={row.label}
                  onPress={() => {
                    if (row.href) {
                      router.push(row.href as never);
                      return;
                    }
                    if (row.url) void Linking.openURL(row.url);
                  }}
                  accessibilityRole={row.href ? 'button' : 'link'}
                  accessibilityLabel={row.label}
                />
              ))}
              <SettingsRow
                accessory="chevron"
                glyph="copy"
                label={copy.profile.aboutDisclosures}
                onPress={() => router.push('/profile/disclosures')}
                accessibilityRole="button"
                accessibilityLabel={copy.profile.aboutDisclosures}
              />
              <SettingsRow
                accessory="chevron"
                glyph="warning"
                last
                label={deleteEntry.aboutLabel}
                onPress={() => router.push('/profile/delete')}
                accessibilityRole="button"
                accessibilityLabel={deleteEntry.aboutAccessibilityLabel}
              />
            </SettingsCard>
            <Text style={styles.apiAttribution}>
              {copy.moving.header(copy.moving.label, copy.moving.attribution)}
            </Text>
            <Text style={styles.poweredBy}>
              {copy.swap.routeProviderPoweredBy}
            </Text>
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
  scrollWrap: { flex: 1, position: 'relative' },
  safe: {
    flex: 1,
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
  apiAttribution: {
    marginTop: 24,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: '500',
    color: ethena.ink.secondary,
  },
  poweredBy: {
    marginTop: 8,
    fontSize: ETHENA_TYPE.rowName.fontSize,
    fontWeight: '500',
    color: ethena.ink.secondary,
  },
});
