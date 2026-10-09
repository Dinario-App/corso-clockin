import { useCallback, useState } from 'react';
import { PriceAlertNotifications } from '@/src/features/priceAlerts/PriceAlertNotifications';
import { useHeadsUpData } from '@/src/features/skills/directory/useHeadsUpData';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CorsoText } from '@/src/theme/CorsoText';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround, EthenaPill } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { copy } from '@/constants/copy';
import { AccountScreenHeader } from '@/src/features/account/ui/AccountScreenHeader';
import {
  assertNoForbiddenSettingsLabels,
  assertNoUnreachableSettingsHref,
  resolveNotificationPreferencesPresentation,
  resolveNotificationsPresentation,
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

const preferences = resolveNotificationPreferencesPresentation();

assertNoForbiddenSettingsLabels([
  ...visibleSettingsCopyValues(),
  preferences.body,
]);
assertNoUnreachableSettingsHref([resolveNotificationsPresentation({}).preferencesHref]);

export default function NotificationsScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const data = useHeadsUpData('inbox');
  const [alertRefreshKey, setAlertRefreshKey] = useState(0);
  const [alertState, setAlertState] = useState({ loading: false, count: 0 });
  const onAlertState = useCallback((next: { loading: boolean; count: number }) => setAlertState(previous => previous.loading === next.loading && previous.count === next.count ? previous : next), []);
  const notifications = resolveNotificationsPresentation({ events: data.events });
  return (
    <EthenaGround>
<SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AccountScreenHeader
        family="desk"
        title={notifications.title}
        onBack={() => goBackOr(BACK_FALLBACK.settingsHub)}
        backAccessibilityLabel={copy.v1.back}
        testID="profile-notifications-header"
      />

      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          style={styles.scroll}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={data.status === 'loading' || alertState.loading}
              onRefresh={() => { void data.refresh(); setAlertRefreshKey(value => value + 1); }}
              tintColor={ethena.ink.primary}
              colors={[ethena.ink.primary]}
              progressBackgroundColor={ethena.crest}
            />
          }
        >
          {/* The status lines, as one block that ends clear of the first card
              (frames 37, 38: the line ended 3 px above it). */}
          <View style={styles.status} testID="notifications-status">
            <CorsoText style={styles.empty}>{copy.skills.test.windowDays(30)}</CorsoText>
            {data.loadFailed ? <CorsoText style={styles.empty}>{copy.profile.notificationsLoadFailed}</CorsoText> : null}
            {data.status === 'error' ? (
              // A solid ground pill: Retry re-reads and commits nothing. The
              // row gives the pill its width; the pill is its own 48 dp target.
              <View style={styles.retryRow}>
                <EthenaPill
                  testID="notifications-retry"
                  label={copy.skills.test.retry}
                  plane="ground"
                  onPress={() => void data.refresh()}
                />
              </View>
            ) : null}
            {notifications.empty && data.status === 'ready' && !alertState.loading && !alertState.count ? (
              <CorsoText style={styles.empty}>{notifications.emptyCopy}</CorsoText>
            ) : null}
          </View>
          <PriceAlertNotifications refreshKey={alertRefreshKey} onState={onAlertState} />
          {notifications.items.map(event => <SettingsCard key={event.id} contentStyle={styles.cardContent}>
            <CorsoText style={styles.empty}>{copy.skills.template.heads_up.name} · {event.mint.slice(0, 6)}…{event.mint.slice(-4)}</CorsoText>
            <CorsoText style={styles.empty}>{copy.skills.test.confluence.timeframe(event.timeframe)}</CorsoText>
            <CorsoText style={styles.empty}>{copy.skills.test.confluence.side[event.fromSide]} → {copy.skills.test.confluence.side[event.toSide]}</CorsoText>
            <CorsoText style={styles.empty}>{new Date(event.observedAt).toLocaleString()}</CorsoText>
            {/* Heads-Up Remove stops future alerts; past events stay inactive until 30-day expiry; no Heads-Up copy may say or imply Remove deletes history. */}
            {event.active ? <Pressable accessibilityRole="button" accessibilityLabel={`${copy.ai.remove} ${event.mint} ${event.timeframe}`} disabled={!!data.removing || data.status === 'loading'} onPress={() => void data.remove(event.watchId)} style={{ minHeight: 44, justifyContent: 'center' }} testID={`heads-up-inbox-remove-${event.watchId}`}>
              {data.removing === event.watchId ? <ActivityIndicator color={ethena.ink.primary} /> : <CorsoText style={styles.empty}>{copy.ai.remove}</CorsoText>}
            </Pressable> : null}
          </SettingsCard>)}
          <SettingsCard contentStyle={styles.cardContent}>
            <SettingsRow
              accessory="chevron"
              glyph="bell"
              last
              label={notifications.preferencesLabel}
              onPress={() => router.push(notifications.preferencesHref)}
              accessibilityRole="button"
              accessibilityLabel={notifications.preferencesLabel}
            />
          </SettingsCard>
        </ScrollView>
        <ScrollEdgeFade top={scrollFade.top} color={ethena.groundStops[0][1]} />
        <StepUpSheet {...data.stepUpSheet} />
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
  /** The status block: 16 clear above the first card. */
  status: {
    marginBottom: 16,
  },
  retryRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 16,
  },
  empty: {
    marginTop: 16,
    ...ETHENA_TYPE.body,
    color: ethena.ink.primary,
  },
  /** `.rows{padding:4px 8px}` — the pane's inset; the row adds its own 6. */
  cardContent: {
    paddingHorizontal: ACCOUNT_CARD_PADDING_HORIZONTAL,
    paddingVertical: ACCOUNT_CARD_PADDING_VERTICAL,
  },
});
