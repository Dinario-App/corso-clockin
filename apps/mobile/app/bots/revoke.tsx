import { useCorsoPausedFleet } from '@/src/features/bots/useCorsoPausedFleet';
import { useBotsConfig } from '@/src/features/bots/botsGuard';
import { SuspensionNotice } from '@/src/features/bots/ui/SuspensionNotice';
import { Pressable } from 'react-native';
import { useBotFleet } from '@/src/features/bots/useBotFleet';
import { RevokePrompt } from '@/src/features/bots/ui/RevokePrompt';
import { BotsScreen } from '@/src/features/bots/ui/BotsScreen';
import { Banner } from '@/src/ui/feedback/Banner';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import { copy } from '@/constants/copy';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { CorsoText } from '@/src/theme/CorsoText';

/** Safety-only surface survives all bots/autopilot flag settings. */
export default function RevokeScreen() {
  const gate = useBotsConfig();
  const fleet = useCorsoPausedFleet(useBotFleet({ enabled: gate.enabled }));
  return (
    <>
      <BotsScreen
        title={copy.automation.checkPermissions}
        onBackPress={() => goBackOr(BACK_FALLBACK.shell)}
        testID="revoke-safety-header"
        backAccessibilityLabel={copy.automation.back}
      >
        <Pressable accessibilityRole="button" onPress={() => { void fleet.refresh(); }} testID="revoke-discover">
          <CorsoText>{copy.automation.checkPermissions}</CorsoText>
        </Pressable>
        {fleet.error ? <Banner tone="warning" message={fleet.error} /> : null}
        {fleet.status === 'loading' ? (
          <CorsoText>{copy.automation.loading}</CorsoText>
        ) : null}
        {fleet.status === 'ready' &&
        !fleet.bots.some((bot) => bot.revokeRequired === true || (bot.status === 'paused' && bot.key.standing)) ? (
          <CorsoText>{copy.automation.revokeNone}</CorsoText>
        ) : null}
        {fleet.bots.map(bot => <SuspensionNotice key={`suspension-${bot.id}`} bot={bot} busy={fleet.busyId !== null}
          onCancel={() => { void fleet.cancel(bot); }} onRevoke={() => { void fleet.revoke(bot); }} />)}
        {fleet.bots.map((bot) => (
          <RevokePrompt
            key={bot.id}
            bot={bot}
            busy={fleet.busyId !== null}
            onRevoke={() => {
              void fleet.revoke(bot);
            }}
          />
        ))}
      </BotsScreen>
      <StepUpSheet {...fleet.stepUpSheet} />
    </>
  );
}
