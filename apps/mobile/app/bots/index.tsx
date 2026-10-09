import { SuspensionNotice } from '@/src/features/bots/ui/SuspensionNotice';
import { useCorsoPausedFleet } from '@/src/features/bots/useCorsoPausedFleet';
import { RevokePrompt } from '@/src/features/bots/ui/RevokePrompt';
import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { fleetSummary } from '@/src/features/bots/botPresentation';
import { useBotsConfig } from '@/src/features/bots/botsGuard';
import type { BotView } from '@/src/features/bots/types';
import { BotCard } from '@/src/features/bots/ui/BotCard';
import { BotsScreen } from '@/src/features/bots/ui/BotsScreen';
import {
  inputUnitFor,
  outputUnitFor,
  usdcMintFor,
} from '@/src/features/bots/units';
import { useBotFleet } from '@/src/features/bots/useBotFleet';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { Banner } from '@/src/ui/feedback/Banner';
import { ONGLASS } from '@/src/ui/glass/materialTokens';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export default function BotsHubScreen() {
  const gate = useBotsConfig();
  const fleet = useCorsoPausedFleet(useBotFleet({ enabled: gate.enabled }));
  const fiat = useFiatTotal(fleet.walletAddress ?? undefined);
  const lines = fiat.holdings?.lines ?? [];
  const usdcMint = useMemo(
    () => usdcMintFor(gate.config?.network),
    [gate.config?.network],
  );

  const inputUnit = useCallback(
    (bot: BotView) => inputUnitFor(bot, lines, usdcMint),
    [lines, usdcMint],
  );
  const outputUnit = useCallback(
    (bot: BotView) => outputUnitFor(bot, lines, usdcMint),
    [lines, usdcMint],
  );

  const off = gate.status === 'ready' && !gate.enabled;

  return (
    <>
      <BotsScreen
        title={copy.automation.title}
        onBackPress={() => goBackOr(BACK_FALLBACK.shell)}
        backAccessibilityLabel={copy.automation.back}
        testID="bots-header"
        refreshControl={
          off ? undefined : (
            <RefreshControl
              refreshing={fleet.status === 'loading' && fleet.bots.length > 0}
              onRefresh={() => {
                void fleet.refresh();
              }}
              tintColor={colors.inkTertiary}
            />
          )
        }
      >
        <Pressable accessibilityRole="button" onPress={() => { void fleet.refresh(); }}><CorsoText>{copy.automation.checkPermissions}</CorsoText></Pressable>
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
        {fleet.bots.map(bot => <SuspensionNotice key={`suspension-${bot.id}`} bot={bot} busy={fleet.busyId !== null}
          onCancel={() => { void fleet.cancel(bot); }} onRevoke={() => { void fleet.revoke(bot); }} />)}
        {off ? (
          <View style={styles.offBody} testID="bots-off">
            <CorsoText style={styles.muted}>{copy.automation.off}</CorsoText>
          </View>
        ) : (
          <>
            {fleet.error ? (
              <Banner
                message={fleet.error}
                tone="warning"
                testID="bots-error"
              />
            ) : null}
            {gate.status === 'loading' ||
            (fleet.status === 'loading' && fleet.bots.length === 0) ? (
              <CorsoText style={styles.muted}>
                {copy.automation.loading}
              </CorsoText>
            ) : null}

            {gate.enabled && fleet.bots.length > 0 ? (
              <View testID="bots-fleet">
                <CorsoText style={styles.summary}>
                  {fleetSummary(fleet.bots, inputUnit)}
                </CorsoText>
                {fleet.bots.map((bot) => (
                  <BotCard
                    key={bot.id}
                    bot={bot}
                    inputUnit={inputUnit(bot)}
                    outputUnit={outputUnit(bot)}
                    busy={fleet.busyId === bot.id}
                    onPause={() => {
                      void fleet.pause(bot);
                    }}
                    onKill={() => {
                      void fleet.kill(bot);
                    }}
                    onOpen={() => router.push(`/bots/${bot.id}`)}
                    compact
                    testID={`bot-card-${bot.id}`}
                  />
                ))}
                <CorsoText style={styles.trust}>
                  {copy.automation.trustNote}
                </CorsoText>
              </View>
            ) : null}
          </>
        )}
      </BotsScreen>
      <StepUpSheet {...fleet.stepUpSheet} />
    </>
  );
}

const styles = StyleSheet.create({
  offBody: { gap: spacing.sm, paddingTop: spacing.sm },
  muted: {
    color: colors.muted,
    fontSize: CANON_TYPE_SIZES.rowLabel,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  mutedSmall: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 17,
  },
  hero: { paddingTop: 10 },
  heroTitle: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.askTitle,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
    lineHeight: Math.round(CANON_TYPE_SIZES.askTitle * 1.16),
  },
  heroDim: { color: colors.inkQuaternary },
  lede: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  entry: { marginTop: spacing.md },
  sect: {
    color: colors.inkTertiary,
    fontSize: 15,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    marginTop: 28,
    marginBottom: spacing.smd,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  ruleRowLast: { borderBottomWidth: 0 },
  ruleWell: {
    width: 30,
    height: 30,
    borderRadius: radii.iconWell,
    backgroundColor: ONGLASS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleTitle: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  ruleWhat: {
    marginLeft: 'auto',
    flexShrink: 1,
    textAlign: 'right',
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  trust: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.footnote,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 16,
    marginTop: 20,
  },
  summary: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    marginBottom: spacing.smd,
  },
  add: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
