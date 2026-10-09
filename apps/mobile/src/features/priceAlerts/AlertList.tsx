import { typography } from '@/src/ui/tokens';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { CorsoText } from '@/src/theme/CorsoText';
import { SettingsCard } from '@/src/ui/cards/SettingsCard';
import {
  ACCOUNT_CARD_PADDING_HORIZONTAL,
  ACCOUNT_CARD_PADDING_VERTICAL,
} from '@/src/ui/rows/accountRowPresentation';
import { ALERT_COPY, alertLine, safeAlertSymbol } from './alertCopy';
import type { useAlertList } from './useAlertList';
export function AlertList({ data }: { data: ReturnType<typeof useAlertList> }) {
  if (!data.armed) return null;
  const token = (id: string, mint: string) =>
    safeAlertSymbol(
      data.presets[id]?.mint === mint
        ? data.presets[id]!.symbol
        : data.symbols?.[mint],
    );
  return (
    <View testID="price-alert-list">
      {data.failed && !data.unavailable && data.alerts.length === 0 ? (
        <CorsoText style={styles.text}>
          {copy.profile.notificationsLoadFailed}
        </CorsoText>
      ) : null}
      {data.unavailable ? (
        <CorsoText style={styles.text}>{ALERT_COPY.off}</CorsoText>
      ) : null}
      {data.alerts.map((alert) => (
        <SettingsCard key={alert.id} contentStyle={styles.card}>
          <CorsoText style={styles.text}>
            {token(alert.id, alert.mint)
              ? alertLine(
                  'row',
                  token(alert.id, alert.mint)!,
                  alert.direction,
                  alert.thresholdPrice,
                )
              : ALERT_COPY.off}
          </CorsoText>
          <CorsoText style={styles.state}>{ALERT_COPY[alert.state]}</CorsoText>
          <Pressable
            testID={`price-alert-remove-${alert.id}`}
            accessibilityRole="button"
            accessibilityLabel={
              token(alert.id, alert.mint)
                ? `${copy.ai.remove} ${alertLine('row', token(alert.id, alert.mint)!, alert.direction, alert.thresholdPrice)}`
                : copy.ai.remove
            }
            disabled={!!data.removing || data.loading}
            onPress={() => void data.remove(alert.id)}
            style={styles.remove}
          >
            {data.removing === alert.id ? (
              <ActivityIndicator color={ethena.ink.primary} />
            ) : (
              <CorsoText style={styles.text}>{copy.ai.remove}</CorsoText>
            )}
          </Pressable>
        </SettingsCard>
      ))}
      {data.events.map((event) => (
        <SettingsCard key={event.id} contentStyle={styles.card}>
          <CorsoText
            testID={`price-alert-fired-${event.alertId}`}
            style={styles.text}
          >
            {token(event.alertId, event.mint)
              ? alertLine(
                  'fired',
                  token(event.alertId, event.mint)!,
                  event.direction,
                  event.thresholdPrice,
                  new Date(event.firedAtMs).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }),
                )
              : ALERT_COPY.off}
          </CorsoText>
        </SettingsCard>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  text: { ...ETHENA_TYPE.body, color: ethena.ink.primary },
  state: { ...ETHENA_TYPE.body, color: ethena.ink.tertiary },
  card: {
    paddingHorizontal: ACCOUNT_CARD_PADDING_HORIZONTAL,
    paddingVertical: ACCOUNT_CARD_PADDING_VERTICAL,
  },
  remove: { minHeight: typography.control, justifyContent: 'center' },
});
