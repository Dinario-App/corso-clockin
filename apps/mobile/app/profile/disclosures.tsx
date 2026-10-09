import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
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
import { useDisclosures } from '@/src/features/disclosures/useDisclosures';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';

export default function DisclosuresScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const { disclosuresReady, set, loading } = useDisclosures();

  return (
    <EthenaGround>
<SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AccountScreenHeader
        family="desk"
        title={copy.profile.disclosuresTitle}
        onBack={() => goBackOr(BACK_FALLBACK.about)}
        backAccessibilityLabel={copy.v1.back}
        testID="profile-disclosures-header"
      />

      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          style={styles.scroll}
          contentContainerStyle={styles.body}
        >
          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={ethena.ink.primary} />
              <CorsoText style={styles.stateText}>
                {copy.profile.disclosuresLoading}
              </CorsoText>
            </View>
          ) : null}

          {!loading && !disclosuresReady ? (
            <View style={styles.stateWrap}>
              <CorsoText style={styles.stateText}>
                {copy.profile.disclosuresUnavailable}
              </CorsoText>
            </View>
          ) : null}

          {disclosuresReady && set ? (
            <>
              {/* The not-registered disclaimer leads, ahead of the nine. */}
              <SettingsCard
                style={styles.disclaimerCard}
                contentStyle={styles.disclaimerCardContent}
              >
                <CorsoText style={styles.disclaimer}>{set.disclaimer}</CorsoText>
              </SettingsCard>
              {set.disclosures.map((disclosure) => (
                <SettingsCard
                  key={disclosure.id}
                  style={styles.card}
                  contentStyle={styles.cardContent}
                >
                  <CorsoText style={styles.cardTitle} accessibilityRole="header">
                    {disclosure.title}
                  </CorsoText>
                  <CorsoText style={styles.cardBody}>{disclosure.body}</CorsoText>
                </SettingsCard>
              ))}
            </>
          ) : null}
        </ScrollView>
        <ScrollEdgeFade top={scrollFade.top} color={ethena.groundStops[0][1]} />
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
    paddingBottom: 32 * 2,
  },
  stateWrap: {
    marginTop: 24,
    gap: 8,
  },
  stateText: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.secondary,
  },
  /** Outer boxes only — the material, radius and clipping are the lens's. */
  disclaimerCard: {
    marginTop: 16,
  },
  disclaimerCardContent: {
    padding: 16,
  },
  disclaimer: {
    ...ETHENA_TYPE.cardHeading,
    color: ethena.ink.primary,
  },
  card: {
    marginTop: 16,
  },
  cardContent: {
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    ...ETHENA_TYPE.cardHeading,
    color: ethena.ink.primary,
  },
  cardBody: {
    ...ETHENA_TYPE.body,
    color: ethena.ink.secondary,
  },
});
