import { SuspensionNotice } from '@/src/features/bots/ui/SuspensionNotice';
import { useCorsoPausedFleet } from '@/src/features/bots/useCorsoPausedFleet';
import { RevokePrompt } from '@/src/features/bots/ui/RevokePrompt';
import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { copy } from '@/constants/copy';
import { BOT_SUSPENSION_REASONS } from '@/src/features/bots/types';
import { CorsoText } from '@/src/theme/CorsoText';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import {
  fillLine,
  fireOutcomeLabel,
  formatAmount,
  formatClock,
  formatDay,
  scopeCardModel,
} from '@/src/features/bots/botPresentation';
import { useBotsConfig } from '@/src/features/bots/botsGuard';
import { BotCard } from '@/src/features/bots/ui/BotCard';
import { BotsScreen } from '@/src/features/bots/ui/BotsScreen';
import { fireFeeLabel } from '@/src/features/bots/feePresentation';
import { FireReceiptCard } from '@/src/features/bots/ui/FireReceiptCard';
import { ScopeCard } from '@/src/features/bots/ui/ScopeCard';
import {
  inputUnitFor,
  outputUnitFor,
  usdcMintFor,
} from '@/src/features/bots/units';
import { useBotFleet } from '@/src/features/bots/useBotFleet';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import {
  CANON_TYPE_SIZES,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { Banner } from '@/src/ui/feedback/Banner';
import { colors, spacing, typography } from '@/src/ui/tokens';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function BotDetailScreen() {
  const raw = useLocalSearchParams<{ botId?: string }>();
  const botId =
    typeof raw.botId === 'string' && UUID.test(raw.botId) ? raw.botId : null;
  const gate = useBotsConfig();
  const fleet = useCorsoPausedFleet(useBotFleet({ enabled: gate.enabled }));
  const fiat = useFiatTotal(fleet.walletAddress ?? undefined);
  const lines = fiat.holdings?.lines ?? [];
  const usdcMint = useMemo(
    () => usdcMintFor(gate.config?.network),
    [gate.config?.network],
  );
  const bot = fleet.bots.find((entry) => entry.id === botId) ?? null;

  const inputUnit = bot ? inputUnitFor(bot, lines, usdcMint) : null;
  const outputUnit = bot ? outputUnitFor(bot, lines, usdcMint) : null;

  const scope = useMemo(() => {
    if (!bot) return null;
    return scopeCardModel({
      ruleKind: bot.rule.kind,
      targetSymbol: bot.scope.can.swap.target.symbol,
      input: {
        mint: bot.scope.can.swap.inputMint,
        symbol: inputUnit?.symbol ?? 'input',
        decimals: inputUnit?.decimals ?? 0,
      },
      output: {
        mint: bot.scope.can.swap.outputMint,
        symbol: outputUnit?.symbol ?? bot.scope.can.swap.target.symbol,
        decimals: outputUnit?.decimals ?? 0,
      },
      perFireMaxBaseUnits: bot.scope.can.perFireMaxBaseUnits,
      perDayMaxBaseUnits: bot.scope.can.perDayMaxBaseUnits,
      until: bot.scope.can.until,
      canNever: bot.scope.canNever,
    });
  }, [bot, inputUnit, outputUnit]);

  const onRefresh = useCallback(() => {
    void fleet.refresh();
  }, [fleet]);
  const off = gate.status === 'ready' && !gate.enabled;

  return (
    <>
      <BotsScreen
        title={
          bot
            ? copy.automation.rule[bot.rule.kind].title
            : copy.automation.title
        }
        onBackPress={() => goBackOr(BACK_FALLBACK.botsList)}
        backAccessibilityLabel={copy.automation.back}
        testID="bot-detail-header"
        refreshControl={
          off ? undefined : (
            <RefreshControl
              refreshing={fleet.status === 'loading'}
              onRefresh={onRefresh}
              tintColor={colors.inkTertiary}
            />
          )
        }
      >
        {bot ? (
          <RevokePrompt
            bot={bot}
            busy={fleet.busyId !== null}
            onRevoke={() => {
              void fleet.revoke(bot);
            }}
          />
        ) : null}
        {bot ? <SuspensionNotice bot={bot} busy={fleet.busyId !== null}
          onCancel={() => { void fleet.cancel(bot); }} onRevoke={() => { void fleet.revoke(bot); }} /> : null}
        {bot === null ? <Pressable accessibilityRole="button" onPress={() => { if (bot === null) void fleet.refresh(); }}><CorsoText>{copy.automation.checkPermissions}</CorsoText></Pressable> : null}
        {off ? (
          <View style={styles.offBody} testID="bot-detail-off">
            <CorsoText style={styles.muted}>{copy.automation.off}</CorsoText>
          </View>
        ) : (
          <>
            {fleet.error ? (
              <Banner
                message={fleet.error}
                tone="warning"
                testID="bot-detail-error"
              />
            ) : null}
            {bot === null ? (
              <CorsoText style={styles.muted}>
                {fleet.status === 'loading' || gate.status === 'loading'
                  ? copy.automation.loading
                  : copy.automation.error.list}
              </CorsoText>
            ) : (
              <>
                {bot.suspensionReason && !(BOT_SUSPENSION_REASONS as readonly string[]).includes(bot.suspensionReason) ? <Banner message={bot.suspensionReason} tone="warning" testID="bot-suspension-reason" /> : null}
                <BotCard
                  bot={bot}
                  inputUnit={inputUnit}
                  outputUnit={outputUnit}
                  busy={fleet.busyId === bot.id}
                  onPause={() => {
                    void fleet.pause(bot);
                  }}
                  onKill={() => {
                    void fleet.kill(bot);
                  }}
                  testID={`bot-detail-${bot.id}`}
                />
                {scope ? (
                  <ScopeCard model={scope} testID="bot-detail-scope" />
                ) : null}

                <CorsoText style={styles.sect}>
                  {copy.automation.fires.heading}
                </CorsoText>
                {bot.fires.length === 0 ? (
                  <CorsoText style={styles.muted}>
                    {copy.automation.fires.none}
                  </CorsoText>
                ) : (
                  bot.fires.map((fire) => (
                    <FireReceiptCard
                      bot={bot}
                      onRevoke={() => { void fleet.revoke(bot); }}
                      onCancel={() => { void fleet.cancel(bot); }}
                      key={fire.id}
                      mark={inputUnit?.symbol ?? '·'}
                      amount={formatAmount(fire.fireSizeBaseUnits, inputUnit)}
                      meta={`${fireOutcomeLabel(fire.outcome)} · ${formatDay(fire.at)} ${formatClock(fire.at)}`}
                      fill={
                        fire.fill
                          ? fillLine(fire.fill, inputUnit, outputUnit)
                          : null
                      }
                      fee={fireFeeLabel(fire, outputUnit)}
                      skipped={fire.outcome === 'skipped'}
                      testID={`bot-fire-${fire.id}`}
                    />
                  ))
                )}
              </>
            )}
          </>
        )}
      </BotsScreen>
      <StepUpSheet {...fleet.stepUpSheet} />
    </>
  );
}

const styles = StyleSheet.create({
  offBody: { paddingTop: spacing.sm },
  muted: {
    color: colors.muted,
    fontSize: CANON_TYPE_SIZES.rowLabel,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  sect: {
    color: colors.inkTertiary,
    fontSize: 15,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    marginTop: 28,
    marginBottom: 2,
  },
});
