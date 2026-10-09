import { Pressable, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { colors, spacing } from '@/src/ui/tokens';
import type { BotView } from '../types';

/** Ordinary paused-state disclosure; Revoke is an optional owner action. */
export function SuspensionNotice({ bot, busy, onCancel, onRevoke }: {
  bot: BotView; busy: boolean; onCancel: () => void; onRevoke: () => void;
}) {
  const reason = bot.suspendedBy ?? (bot.pausedByCorso ? 'global_pause' : null);
  if (!reason || bot.status !== 'paused' || !bot.key.standing || bot.revokeRequired) return null;
  const words = copy.automation.suspension;
  return <View testID={`suspension-notice-${bot.id}`} style={{ padding: spacing.md, gap: spacing.sm }}>
    <CorsoText style={{ color: colors.muted }}>{words.standing}</CorsoText>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel}><CorsoText>{words.cancel}</CorsoText></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onRevoke}><CorsoText>{words.revoke}</CorsoText></Pressable>
  </View>;
}
