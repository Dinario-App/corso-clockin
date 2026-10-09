import { Pressable, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { resolveRevokePrompt } from '../revokePresentation';
import type { BotView } from '../types';
import { colors, spacing } from '@/src/ui/tokens';

export function RevokePrompt({
  bot,
  onRevoke,
  busy,
}: {
  bot: BotView;
  onRevoke: () => void;
  busy: boolean;
}) {
  const prompt = resolveRevokePrompt(bot);
  if (!prompt) return null;
  return (
    <View
      style={{ padding: spacing.md, gap: spacing.sm }}
      testID={`revoke-prompt-${bot.id}`}
    >
      <CorsoText style={{ color: colors.ink }}>{prompt.message}</CorsoText>
      <CorsoText style={{ color: colors.muted }}>{prompt.fee}</CorsoText>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onRevoke}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <CorsoText style={{ color: colors.ink }}>{prompt.action}</CorsoText>
      </Pressable>
    </View>
  );
}
