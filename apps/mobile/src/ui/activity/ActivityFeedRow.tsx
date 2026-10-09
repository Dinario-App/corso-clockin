import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ACTIVITY_FEED_ASIDE_GAP,
  ACTIVITY_FEED_PENDING_CHIP_PADDING_HORIZONTAL,
  ACTIVITY_FEED_PENDING_CHIP_PADDING_VERTICAL,
  ACTIVITY_FEED_PENDING_DOT,
  ACTIVITY_FEED_PENDING_PULSE_MIN_OPACITY,
  ACTIVITY_FEED_PENDING_PULSE_MS,
  ACTIVITY_FEED_ROW_GAP,
  ACTIVITY_FEED_ROW_PADDING_VERTICAL,
  ACTIVITY_FEED_STATUS_DOT,
  ACTIVITY_FEED_STATUS_GAP,
  statusDotColor,
  statusToneColor,
  type ActivityFeedRowView,
} from '@/src/features/activity/activityFeedPresentation';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { CorsoText } from '@/src/theme/CorsoText';
import { activityKindIconName } from '@/src/ui/icons/corsoIconNames';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { activityAmountInk } from '@/src/ui/activity/activityRowInk';
import { EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';

/**
 * The Asset Row disc: `ethenaGeometry.rowHeight` is "36px disc + 2x20px
 * padding", so the disc is what is left of the row once its padding is taken.
 */
const ROW_DISC = ethenaGeometry.rowHeight - 2 * 20;

/** Content on the ground: the row tray, the pending chip. Never glass. */

export type ActivityFeedRowProps = {
  view: ActivityFeedRowView;
  onPress: () => void;
  testID?: string;
};

export function ActivityFeedRow({
  view,
  onPress,
  testID,
}: ActivityFeedRowProps) {
  const isPending = view.statusKind === 'pending';
  // Paint state only: which of the two tray paints below is drawn.
  const [held, setHeld] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setHeld(true)}
      onPressOut={() => setHeld(false)}
      accessibilityRole="button"
      accessibilityLabel={view.accessibilityLabel}
      testID={testID}
    >
      <EthenaTray
        testID={`${testID ?? 'activity-row'}-tray`}
        style={held ? styles.rowHeld : styles.row}
      >
        <View style={styles.disc} pointerEvents="none">
          <CorsoIcon
            name={activityKindIconName(view.kind)}
            size={16}
            color={ethena.ink.secondary}
          />
        </View>

        <View style={styles.body} accessible={false}>
          <CorsoText style={styles.title} numberOfLines={1} accessible={false}>
            {view.title}
          </CorsoText>
          <CorsoText style={styles.sub} numberOfLines={1} accessible={false}>
            {view.subLine}
          </CorsoText>
        </View>

        <View style={styles.aside} accessible={false}>
          <CorsoText
            style={[styles.amount, { color: activityAmountInk(view) }]}
            numberOfLines={1}
            accessible={false}
          >
            {view.amountText}
          </CorsoText>
          {/* 🔴 Rendered only when the data path supplies a price it actually
              read. Today that is never — see `fiatText` in the presentation. */}
          {view.fiatText === null ? null : (
            <CorsoText style={styles.fiat} numberOfLines={1} accessible={false}>
              {view.fiatText}
            </CorsoText>
          )}
          {isPending ? (
            <PendingChip label={view.statusLabel} />
          ) : (
            <View style={styles.status} accessible={false}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: statusDotColor(view.statusTone) },
                ]}
              />
              <CorsoText
                style={[
                  styles.statusWord,
                  {
                    color:
                      view.statusTone === 'down'
                        ? statusToneColor(view.statusTone)
                        : ROW_QUIET_INK,
                  },
                ]}
                numberOfLines={1}
                accessible={false}
              >
                {view.statusLabel}
              </CorsoText>
            </View>
          )}
        </View>
      </EthenaTray>
    </Pressable>
  );
}

function PendingChip({ label }: { label: string }) {
  const ground = useEthenaMaterial('ground');
  const { reduceMotion } = useAccessibilityPreference();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }
    const half = ACTIVITY_FEED_PENDING_PULSE_MS / 2;
    opacity.value = withRepeat(
      withSequence(
        withTiming(ACTIVITY_FEED_PENDING_PULSE_MIN_OPACITY, {
          duration: half,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, { duration: half, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity, reduceMotion]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={[styles.pendingChip, { backgroundColor: ground.fill as string, borderWidth: ground.borderWidth, borderColor: ground.borderColor ?? undefined }]} pointerEvents="none">
      <Animated.View style={[styles.pendingDot, dotStyle]} />
      <CorsoText
        style={styles.pendingWord}
        numberOfLines={1}
        accessible={false}
      >
        {label}
      </CorsoText>
    </View>
  );
}

const ROW_QUIET_INK = ethena.ink.secondary;

/** The Asset Row: 76 tall at rest, and free to grow with the font scale. */
const ROW = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: ACTIVITY_FEED_ROW_GAP,
  minHeight: ethenaGeometry.rowHeight,
  paddingVertical: ACTIVITY_FEED_ROW_PADDING_VERTICAL,
} as const;

const styles = StyleSheet.create({
  row: ROW,
  rowHeld: { ...ROW, backgroundColor: 'transparent' },
  disc: {
    width: ROW_DISC,
    height: ROW_DISC,
    borderRadius: ROW_DISC / 2,
    backgroundColor: ethena.crest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: {
    color: ethena.ink.primary,
    fontSize: CANON_TYPE_SIZES.cardTitle,
    lineHeight: 19,
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.cardTitle, -0.01),
  },
  sub: {
    color: ethena.ink.secondary,
    fontSize: CANON_TYPE_SIZES.meta,
    lineHeight: 17,
    fontWeight: canonWeight('500'),
  },
  aside: {
    alignItems: 'flex-end',
    gap: ACTIVITY_FEED_ASIDE_GAP,
    maxWidth: 140,
  },
  amount: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(14, -0.01),
    textAlign: 'right',
  },
  fiat: {
    color: ROW_QUIET_INK,
    fontSize: CANON_TYPE_SIZES.sub,
    lineHeight: 16,
    fontWeight: canonWeight('500'),
    textAlign: 'right',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_FEED_STATUS_GAP,
  },
  dot: {
    width: ACTIVITY_FEED_STATUS_DOT,
    height: ACTIVITY_FEED_STATUS_DOT,
    borderRadius: ACTIVITY_FEED_STATUS_DOT / 2,
  },
  statusWord: {
    fontSize: CANON_TYPE_SIZES.meta,
    lineHeight: 17,
    fontWeight: canonWeight('600'),
  },
  /** Solid ground-tray pill, not a wash. */
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ACTIVITY_FEED_STATUS_GAP,
    paddingVertical: ACTIVITY_FEED_PENDING_CHIP_PADDING_VERTICAL,
    paddingHorizontal: ACTIVITY_FEED_PENDING_CHIP_PADDING_HORIZONTAL,
    borderRadius: ethenaGeometry.pillHeight,
  },
  pendingDot: {
    width: ACTIVITY_FEED_PENDING_DOT,
    height: ACTIVITY_FEED_PENDING_DOT,
    borderRadius: ACTIVITY_FEED_PENDING_DOT / 2,
    backgroundColor: ethena.ink.tertiary,
  },
  pendingWord: {
    color: ROW_QUIET_INK,
    fontSize: CANON_TYPE_SIZES.sub,
    lineHeight: 16,
    fontWeight: canonWeight('500'),
  },
});
