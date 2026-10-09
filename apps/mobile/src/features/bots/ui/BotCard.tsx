import { Pressable, StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType';
import { Material } from '@/src/ui/glass/Material';
import { ONGLASS, ONGLASS_HI } from '@/src/ui/glass/materialTokens';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';
import {
  capBar,
  cardActions,
  describeBot,
  expiryLine,
  killPresentation,
  ruleTitle,
  statusLabel,
  type InputUnit,
} from '../botPresentation';
import { dotToneFor } from '../liveDotPresentation';
import type { BotView } from '../types';
import { BotLiveDot } from './BotLiveDot';

type Props = {
  bot: BotView;
  /** The unit the rule spends in (input mint); null renders base units honestly. */
  inputUnit: InputUnit | null;
  outputUnit: InputUnit | null;
  busy: boolean;
  onPause: () => void;
  onResume?: () => void;
  resumeLabel?: string;
  onKill: () => void;
  onRenew?: () => void;
  onOpen?: () => void;
  /** Detail screen renders the fires list itself; the fleet card stays compact. */
  compact?: boolean;
  testID?: string;
};

function BotAction(props: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={{ disabled: props.disabled, busy: props.disabled }}
      style={({ pressed }) => [
        styles.bact,
        pressed && !props.disabled ? styles.bactPressed : null,
        props.disabled ? styles.bactDisabled : null,
      ]}
      testID={props.testID}
    >
      <CorsoText
        style={[styles.bactLabel, props.destructive ? styles.bactKill : null]}
      >
        {props.label}
      </CorsoText>
    </Pressable>
  );
}

export function BotCard(props: Props) {
  const { bot, inputUnit, outputUnit, busy } = props;
  const actions = cardActions(bot);
  const kill = killPresentation(bot, inputUnit, outputUnit);
  const bar = capBar(
    bot.spentToday.baseUnits,
    bot.scope.can.perDayMaxBaseUnits,
    inputUnit,
  );
  const name = ruleTitle(bot.rule.kind);
  const status = statusLabel(bot.status);
  const dead = kill.state !== 'none';

  const body = (
    <>
      <View style={styles.topline}>
        <BotLiveDot tone={dotToneFor(bot.status)} />
        <CorsoText style={[styles.name, dead ? styles.nameDead : null]}>
          {name}
        </CorsoText>
        <CorsoText
          style={[styles.state, dead ? styles.stateDead : null]}
          accessible
          accessibilityLabel={status}
        >
          {`· ${status}`}
        </CorsoText>
        <View
          style={styles.fired}
          accessible
          accessibilityLabel={`${copy.automation.fired} ${bot.fired}`}
        >
          <CorsoText style={styles.firedLabel} accessible={false}>
            {copy.automation.fired}
          </CorsoText>
          <CorsoText style={styles.firedCount} accessible={false}>
            {copy.automation.firedCount(bot.fired)}
          </CorsoText>
        </View>
      </View>

      <CorsoText style={[styles.summary, dead ? styles.summaryDead : null]}>
        {describeBot(bot, inputUnit)}
      </CorsoText>

      {kill.state === 'none' ? (
        <>
          <View style={styles.caps}>
            <View
              style={styles.barTrack}
              accessible
              accessibilityLabel={bar.text}
            >
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.round(bar.ratio * 100)}%` },
                ]}
              />
            </View>
            <CorsoText style={styles.capNum} accessible={false}>
              {bar.text}
            </CorsoText>
          </View>
          <CorsoText
            style={[styles.meta, bot.expiry.nudge ? styles.metaWarn : null]}
          >
            {expiryLine(bot)}
          </CorsoText>
          <View style={styles.actions}>
            {actions.pause ? (
              <BotAction
                label={copy.automation.pause}
                onPress={props.onPause}
                disabled={busy}
                testID={props.testID ? `${props.testID}-pause` : undefined}
              />
            ) : null}
            {actions.resume && props.onResume ? (
              <BotAction
                label={props.resumeLabel ?? copy.automation.resume}
                onPress={props.onResume}
                disabled={busy}
                testID={props.testID ? `${props.testID}-resume` : undefined}
              />
            ) : null}
            {actions.kill ? (
              <BotAction
                label={copy.automation.kill}
                onPress={props.onKill}
                disabled={busy}
                destructive
                accessibilityLabel={copy.automation.killA11y(name)}
                testID={props.testID ? `${props.testID}-kill` : undefined}
              />
            ) : null}
            {actions.renew && props.onRenew ? (
              <BotAction
                label={copy.automation.expiry.renew}
                onPress={props.onRenew}
                disabled={busy}
                testID={props.testID ? `${props.testID}-renew` : undefined}
              />
            ) : null}
          </View>
        </>
      ) : (
        <View
          style={styles.killBlock}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${kill.title}. ${kill.body}${kill.broadcast.count > 0 ? ` ${kill.broadcast.heading}` : ''}`}
          testID={props.testID ? `${props.testID}-kill-state` : undefined}
        >
          <CorsoText style={styles.killLine} accessible={false}>
            <CorsoText style={styles.killWord}>{kill.title}</CorsoText>
            {` · ${kill.body}`}
          </CorsoText>
          {kill.broadcast.count > 0 ? (
            <View style={styles.broadcast}>
              <CorsoText style={styles.broadcastHeading} accessible={false}>
                {kill.broadcast.heading}
              </CorsoText>
              {kill.broadcast.rows.map((row) => (
                <View key={row.id} style={styles.broadcastRow}>
                  <CorsoText style={styles.broadcastFill} accessible={false}>
                    {row.fill}
                  </CorsoText>
                  <CorsoText
                    style={styles.broadcastMeta}
                    accessible={false}
                    numberOfLines={1}
                  >
                    {`${row.outcome} · ${row.signature}`}
                  </CorsoText>
                </View>
              ))}
            </View>
          ) : null}
          {actions.kill ? (
            <View style={styles.actions}>
              <BotAction
                label={copy.automation.kill}
                onPress={props.onKill}
                disabled={busy}
                destructive
                accessibilityLabel={copy.automation.killA11y(name)}
                testID={props.testID ? `${props.testID}-kill` : undefined}
              />
            </View>
          ) : null}
          {actions.renew && props.onRenew ? (
            <View style={styles.actions}>
              <BotAction
                label={copy.automation.expiry.renew}
                onPress={props.onRenew}
                disabled={busy}
                testID={props.testID ? `${props.testID}-renew` : undefined}
              />
            </View>
          ) : null}
        </View>
      )}
    </>
  );

  return (
    <Material
      weight="card"
      radius={radii.verdict}
      style={styles.card}
      contentStyle={styles.content}
      testID={props.testID}
    >
      {props.onOpen ? (
        <Pressable
          onPress={props.onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${status}. Open`}
          style={styles.openHit}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
    </Material>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.smd },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 14,
  },
  openHit: { width: '100%' },
  topline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.cardTitle,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
    letterSpacing: canonTracking(CANON_TYPE_SIZES.cardTitle, -0.01),
  },
  nameDead: { color: colors.inkTertiary },
  state: {
    flexShrink: 1,
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  stateDead: { color: colors.priceDown },
  fired: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  firedLabel: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  firedCount: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  summary: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 18,
    marginTop: 5,
  },
  /** `describeBot()` when the bot is dead — still the sentence explaining it. */
  summaryDead: { color: colors.inkTertiary },
  caps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 11,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: ONGLASS,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.inkTertiary,
  },
  capNum: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  /** `expiryLine(bot)` — when a rule expires. The warn variant already lifts. */
  meta: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.micro,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    marginTop: 6,
  },
  metaWarn: { color: colors.riskDanger },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 13,
    flexWrap: 'wrap',
  },
  bact: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 96,
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: ONGLASS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.smd,
  },
  bactPressed: { backgroundColor: ONGLASS_HI },
  bactDisabled: { opacity: 0.5 },
  bactLabel: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  bactKill: {
    color: colors.priceDown,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  killBlock: { marginTop: 11 },
  killLine: {
    color: colors.inkTertiary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 18,
  },
  killWord: {
    color: colors.priceDown,
    fontFamily: typography.face('600'),
    fontWeight: canonWeight('600'),
  },
  broadcast: {
    marginTop: 9,
    paddingTop: 9,
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  broadcastHeading: {
    color: colors.inkSecondary,
    fontSize: CANON_TYPE_SIZES.meta,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
    lineHeight: 18,
  },
  broadcastRow: { gap: 1 },
  broadcastFill: {
    color: colors.ink,
    fontSize: CANON_TYPE_SIZES.body,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
  broadcastMeta: {
    color: colors.inkQuaternary,
    fontSize: CANON_TYPE_SIZES.footnote,
    fontFamily: typography.face('500'),
    fontWeight: canonWeight('500'),
  },
});
