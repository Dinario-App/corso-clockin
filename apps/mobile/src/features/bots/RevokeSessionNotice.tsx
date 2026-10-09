import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useDelegationMarker } from './useDelegationMarker';
import { readBots, subscribeBots } from './botsStore';
import { resolveAutopilotSuspensionReason } from '@/src/lib/apiConfig';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import type { BotSuspensionReason } from './types';
import { colors, spacing } from '@/src/ui/tokens';
const EMPTY: ReturnType<typeof readBots> = [];
/** No signer/fleet controller is mounted here. Signed discovery follows a tap. */
export function RevokeSessionNotice({
  walletAddress,
}: {
  walletAddress: string | null;
}) {
  const marker = useDelegationMarker(walletAddress);
  const bots = useSyncExternalStore(subscribeBots, () =>
    walletAddress ? readBots(walletAddress) : EMPTY,
  );
  const [reason, setReason] = useState<BotSuspensionReason | null>(null);
  useEffect(() => {
    if (!marker) return;
    let canceled = false;
    const read = () => {
      void resolveAutopilotSuspensionReason()
        .then((value) => {
          if (!canceled) setReason(value);
        })
        .catch(() => {});
    };
    read();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      canceled = true;
      subscription.remove();
    };
  }, [marker, walletAddress]);
  if (!marker) return null;
  const standing = bots.some((bot) => bot.key.standing);
  const pending = bots.some((bot) => bot.revokeRequired === true);
  const suspendedBy = pending && !bots.some(bot => bot.key.standing && !bot.revokeRequired)
    ? null : reason ?? bots.find(bot => bot.suspendedBy)?.suspendedBy ?? null;
  const paused = !!suspendedBy;
  return (
    <View style={{ padding: spacing.md, backgroundColor: colors.canvas }}>
      <Pressable
        onPress={() => router.push('/bots/revoke')}
        accessibilityRole="button"
        style={{ minHeight: 44 }}
        testID="session-revoke-notice"
      >
        {!paused ? (
          <CorsoText style={{ color: colors.ink }}>
            {pending ? copy.automation.revokeNeeded : copy.automation.checkPermissions}
          </CorsoText>
        ) : null}
        {paused ? (
          <CorsoText style={{ color: colors.ink }}>
            {standing
              ? copy.automation.pauseApproval
              : copy.automation.pauseApprovalUnknown}
          </CorsoText>
        ) : null}
        <CorsoText style={{ color: colors.ink }}>
          {paused
            ? `${copy.automation.suspension.cancel} · ${copy.automation.suspension.revoke}`
            : copy.automation.checkPermissions}
        </CorsoText>
      </Pressable>
    </View>
  );
}
