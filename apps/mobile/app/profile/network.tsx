import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  assertNoForbiddenSettingsLabels,
  assertNoUnreachableSettingsHref,
  resolveNetworkPresentation,
  visibleSettingsCopyValues,
} from '@/src/features/profile/settingsRoutePresentation';
import { resolveCluster } from '@/src/lib/apiConfig';
import { ClusterChip } from '@/src/ui/controls/ClusterChip';
import { resolveClusterChipPresentation } from '@/src/ui/controls/clusterChipPresentation';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { NetworkRow } from '@/src/ui/rows/NetworkRow';
import { SettingsRow } from '@/src/ui/rows/SettingsRow';
import {
  ACCOUNT_CARD_PADDING_HORIZONTAL,
  ACCOUNT_CARD_PADDING_VERTICAL,
} from '@/src/ui/rows/accountRowPresentation';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';

assertNoForbiddenSettingsLabels([
  ...visibleSettingsCopyValues(),
  copy.profile.selectCluster,
]);
assertNoUnreachableSettingsHref([]);

export default function NetworkScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const [cluster, setCluster] = useState<'devnet' | 'mainnet-beta' | null>(
    null,
  );
  const [sheetVisible, setSheetVisible] = useState(false);
  const presentation = resolveNetworkPresentation({
    cluster,
    sheetVisible,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await resolveCluster();
      if (!cancelled) setCluster(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function closeSheet() {
    setSheetVisible(false);
  }

  const chipPresentation = presentation.cluster
    ? resolveClusterChipPresentation({ cluster: presentation.cluster })
    : null;

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <AccountScreenHeader
          family="desk"
          title={presentation.title}
          onBack={() => goBackOr(BACK_FALLBACK.settingsHub)}
          backAccessibilityLabel={copy.v1.back}
          testID="profile-network-header"
        />

        <View style={styles.scrollWrap}>
          <ScrollView
            {...scrollFade.scroller}
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {chipPresentation ? (
              presentation.clusterSwitchEnabled ? (
                <View style={styles.chipWrap}>
                  <ClusterChip
                    cluster={chipPresentation.cluster}
                    onPress={() => setSheetVisible(true)}
                  />
                </View>
              ) : (
                <SettingsCard contentStyle={styles.cardContent}>
                  <SettingsRow
                    accessory="check"
                    glyph="discover"
                    label={chipPresentation.displayLabel}
                    last
                    testID="profile-network-current"
                  />
                </SettingsCard>
              )
            ) : null}
          </ScrollView>
          <ScrollEdgeFade
            top={scrollFade.top}
            color={ethena.groundStops[0][1]}
          />
        </View>

        {presentation.clusterSwitchEnabled ? (
          <BottomSheet
            title={presentation.selectClusterTitle}
            visible={presentation.sheetVisible}
            dismissible
            signing={false}
            onRequestClose={closeSheet}
          >
            {presentation.clusters.map((rowCluster) => (
              <NetworkRow
                key={rowCluster}
                cluster={rowCluster}
                selected={rowCluster === presentation.cluster}
                onPress={closeSheet}
              />
            ))}
          </BottomSheet>
        ) : null}
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
  chipWrap: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  /** Same pane inset as Preferences: `.rows{padding:4px 8px}`. */
  cardContent: {
    paddingHorizontal: ACCOUNT_CARD_PADDING_HORIZONTAL,
    paddingVertical: ACCOUNT_CARD_PADDING_VERTICAL,
  },
});
