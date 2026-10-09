import { RampPendingRows } from '@/src/features/ramp/MoonPayPendingCard';
import { ImportedStatusAccess } from '@/src/features/ramp/ImportedStatusAccess';
import { useRampStatus } from '@/src/features/ramp/useRampStatus';
import { presentRampPending } from '@/src/features/ramp/rampStatusClient';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import {
  ACTIVITY_FEED_ROW_SPACING,
  ACTIVITY_FEED_SECTION_PADDING_BOTTOM,
  ACTIVITY_FEED_SECTION_PADDING_TOP,
  ACTIVITY_EMPTY_GLYPH,
  resolveActivityFeedChrome,
  resolveActivityFeedGroups,
} from '@/src/features/activity/activityFeedPresentation';
import { useWalletActivity } from '@/src/features/activity/useWalletActivity';
import { useActivityRowLabels } from '@/src/features/activity/useActivityRowLabels';
import { maskActivityFeedRow } from '@/src/features/balances/hideBalances';
import { useHideBalances } from '@/src/features/balances/hideBalancesPreference';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { CorsoText } from '@/src/theme/CorsoText';
import { ActivityFeedRow } from '@/src/ui/activity/ActivityFeedRow';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { resolveTabBarPresentation } from '@/src/ui/navigation/tabBarPresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import {
  SCROLL_FADE_BOTTOM,
  resolveDockedListEdge,
} from '@/src/ui/primitives/scrollEdgeFadePresentation';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { EthenaGround, EthenaPill } from '@/src/ui/ethena/EthenaPrimitives';
import {
  ACCOUNT_RECEIVE_HREF,
  ACCOUNT_SWAP_HREF,
} from '@/src/features/account/accountRootPresentation';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';

/** The empty well is content on the ground: solid ground-tray, never a wash. */
const EMPTY_WELL = 56;
const DOCK_CLEARANCE = 24;

export default function ActivityRoot() {
  const scrollFade = useScrollLinkedFadeTop();
  const ground = useEthenaMaterial('ground');
  const rampItems = useRampStatus();
  const hasRampPending = presentRampPending(rampItems).length > 0;
  const { session } = useCorsoSession();
  const activity = useWalletActivity(session?.address);
  const labelsFor = useActivityRowLabels(activity.items, session?.address);
  const hideBalances = useHideBalances();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreference();
  const [pulledAtMs, setPulledAtMs] = useState(() => Date.now());

  const chrome = resolveActivityFeedChrome({
    status: activity.status,
    itemCount: activity.items.length,
    hasAddress: Boolean(session?.address),
  });
  // Relative times are pinned to the last fetch so the list never re-renders
  // on a clock; a pull re-reads both the rows and "now".
  const groups = useMemo(
    () => resolveActivityFeedGroups(activity.items, pulledAtMs, labelsFor),
    [activity.items, pulledAtMs, labelsFor],
  );
  const reserve = resolveTabBarPresentation({
    hidden: false,
    safeAreaBottom: insets.bottom,
    reduceMotion,
  }).reserve;
  const edge = resolveDockedListEdge({
    bottomReserve: reserve,
    fadeBottom: SCROLL_FADE_BOTTOM,
    clearance: DOCK_CLEARANCE,
  });

  const refresh = () => {
    setPulledAtMs(Date.now());
    void activity.refresh();
  };

  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top']}>
      <CorsoText style={styles.title} accessibilityRole="header">
        {copy.roots.activityTitle}
      </CorsoText>
      <View style={styles.scroller}>
        <ScrollView
          {...scrollFade.scroller}
          style={styles.flex}
          contentContainerStyle={[
            { paddingBottom: edge.paddingBottom },
            chrome.showRows || hasRampPending ? null : styles.canvasCentered,
          ]}
          contentInsetAdjustmentBehavior="never"
          refreshControl={
            <RefreshControl
              refreshing={activity.refreshing}
              onRefresh={refresh}
              tintColor={ethena.ink.primary}
              colors={[ethena.ink.primary]}
              progressBackgroundColor={ethena.crest}
            />
          }
          testID="activity-feed"
        >
          <View style={styles.list}><ImportedStatusAccess /><RampPendingRows items={rampItems} /></View>
          {chrome.state === 'loading' ? (
            <View style={styles.stateBlock} accessibilityRole="progressbar">
              <ActivityIndicator color={ethena.ink.primary} />
              <CorsoText style={styles.stateBody}>{chrome.title}</CorsoText>
            </View>
          ) : null}

          {chrome.state === 'error' ? (
            <View
              style={[
                styles.stateBlock,
                chrome.showRows ? styles.stateBlockAboveRows : null,
              ]}
              accessibilityLiveRegion="polite"
            >
              <CorsoText style={styles.stateTitle}>{chrome.title}</CorsoText>
              <CorsoText style={styles.stateBody}>{chrome.body}</CorsoText>
            </View>
          ) : null}

          {chrome.state === 'empty' && !hasRampPending ? (
            <View style={styles.stateBlock} testID="activity-empty">
              {/* The empty well is solid ground-tray, the same material as a
                  row: an empty Activity is the same ground as a full one. */}
              <View style={[styles.emptyWell, { backgroundColor: ground.fill as string, borderWidth: ground.borderWidth, borderColor: ground.borderColor ?? undefined }]} pointerEvents="none">
                <CorsoIcon
                  name={ACTIVITY_EMPTY_GLYPH}
                  size={18}
                  color={ethena.ink.tertiary}
                />
              </View>
              <CorsoText style={styles.stateTitle}>{chrome.title}</CorsoText>
              <CorsoText style={styles.stateBody}>{chrome.body}</CorsoText>
              <View style={styles.emptyActions} testID="activity-empty-actions">
                <EthenaPill
                  testID="activity-empty-receive"
                  label={copy.v1.receive}
                  plane="ground"
                  onPress={() => router.push(ACCOUNT_RECEIVE_HREF)}
                />
                <EthenaPill
                  testID="activity-empty-swap"
                  label={copy.account.swap}
                  plane="ground"
                  onPress={() => router.push(ACCOUNT_SWAP_HREF)}
                />
              </View>
            </View>
          ) : null}

          {chrome.showRows
            ? groups.map((group) => (
                <View key={group.key}>
                  <View style={styles.section}>
                    <CorsoText
                      style={styles.sectionLabel}
                      accessibilityRole="header"
                    >
                      {group.label}
                    </CorsoText>
                  </View>
                  <View style={styles.list}>
                    {group.rows.map((row) => (
                      <ActivityFeedRow
                        key={row.signature}
                        view={hideBalances ? maskActivityFeedRow(row) : row}
                        onPress={() =>
                          router.push(`/activity/${row.signature}`)
                        }
                        testID={`activity-row-${row.signature}`}
                      />
                    ))}
                  </View>
                </View>
              ))
            : null}
        </ScrollView>
        <ScrollEdgeFade
          top={scrollFade.top}
          bottom={0}
          color={ethena.groundStops[0][1]}
        />
        <ScrollEdgeFade
          top={0}
          bottom={edge.fadeBottom}
          color={ethena.void}
          testID="activity-scroll-fade"
        />
      </View>
    </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  /** Clear: `EthenaGround` behind it is the desk's ground. */
  safe: { flex: 1 },
  flex: { flex: 1 },
  title: {
    color: ethena.ink.primary,
    fontSize: CANON_TYPE_SIZES.askTitle,
    lineHeight: 30,
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
    paddingHorizontal: ethenaGeometry.gutter,
    paddingTop: 20,
    paddingBottom: 2,
  },
  scroller: { flex: 1, position: 'relative' },
  canvasCentered: { flexGrow: 1, justifyContent: 'center' },
  /** The day header band — 28 above, 12 below, in the gutter. */
  section: {
    paddingHorizontal: ethenaGeometry.gutter + ethenaGeometry.pad,
    paddingTop: ACTIVITY_FEED_SECTION_PADDING_TOP,
    paddingBottom: ACTIVITY_FEED_SECTION_PADDING_BOTTOM,
  },
  sectionLabel: {
    ...ETHENA_TYPE.section,
    color: ethena.ink.secondary,
  },
  /** The gutter and the 10pt gap between rows. */
  list: {
    paddingHorizontal: ethenaGeometry.gutter,
    gap: ACTIVITY_FEED_ROW_SPACING,
  },
  stateBlock: {
    alignItems: 'center',
    gap: ETHENA_BODY_MARGIN,
    paddingHorizontal: ethenaGeometry.gutter,
  },
  emptyActions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: ETHENA_BODY_MARGIN,
  },
  stateBlockAboveRows: { paddingTop: ACTIVITY_FEED_SECTION_PADDING_TOP },
  emptyWell: {
    width: EMPTY_WELL,
    height: EMPTY_WELL,
    borderRadius: EMPTY_WELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ETHENA_BODY_MARGIN,
  },
  stateTitle: {
    color: ethena.ink.primary,
    fontSize: CANON_TYPE_SIZES.control,
    lineHeight: 20,
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.control, -0.01),
    textAlign: 'center',
  },
  stateBody: {
    color: ethena.ink.secondary,
    fontSize: CANON_TYPE_SIZES.meta,
    lineHeight: 18,
    fontWeight: canonWeight('500'),
    textAlign: 'center',
  },
});
