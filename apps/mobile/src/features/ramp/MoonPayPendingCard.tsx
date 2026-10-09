import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { presentRampPending, type RampStatusItem } from './rampStatusClient';

export function MoonPayPendingCard({
  items,
}: {
  items: readonly RampStatusItem[];
}) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const trayPaint = useTrayPaint();
  const pending = presentRampPending(items).filter(
    (item) => !dismissedIds.has(item.id),
  );
  if (pending.length === 0) return null;
  return (
    <View
      style={[styles.card, trayPaint]}
      testID="moonpay-pending-card"
      accessibilityLiveRegion="polite"
    >
      <CorsoText style={styles.title}>{copy.buy.pendingTitle}</CorsoText>
      <CorsoText style={styles.body}>{copy.buy.pendingBody}</CorsoText>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          setDismissedIds(
            (previous) =>
              new Set([...previous, ...pending.map((item) => item.id)]),
          )
        }
        style={styles.dismiss}
      >
        <CorsoText style={styles.body}>{copy.buy.dismissPending}</CorsoText>
      </Pressable>
    </View>
  );
}
/** Pending Activity entries share the existing card paint and approved words. */
export function RampPendingRows({
  items,
}: {
  items: readonly RampStatusItem[];
}) {
  const trayPaint = useTrayPaint();
  return (
    <>
      {presentRampPending(items).map((item) => (
        <View
          key={item.id}
          testID={`ramp-pending-${item.id}`}
          style={[styles.card, trayPaint]}
          accessibilityLiveRegion="polite"
        >
          <CorsoText style={styles.title}>{copy.buy.pendingTitle}</CorsoText>
          <CorsoText style={styles.body}>
            {item.asset} · {copy.activity.statusPending}
          </CorsoText>
        </View>
      ))}
    </>
  );
}

function useTrayPaint() {
  const tray = useEthenaMaterial('ground');
  return {
    backgroundColor: tray.fill as string,
    borderWidth: tray.borderWidth,
    borderColor: tray.borderColor ?? undefined,
  };
}
const styles = StyleSheet.create({
  card: {
    borderRadius: ethenaGeometry.radiusBox,
    padding: ethenaGeometry.pad,
    marginBottom: 16,
  },
  dismiss: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { ...ETHENA_TYPE.keyValue, color: ethena.ink.primary },
  body: { ...ETHENA_TYPE.rowSub, color: ethena.ink.secondary, marginTop: 6 },
});
