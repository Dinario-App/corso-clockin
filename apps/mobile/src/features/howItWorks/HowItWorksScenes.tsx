import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BotCard } from '@/src/features/bots/ui/BotCard';
import type { ModelMenuPresentation } from '@/src/features/aiConnect/ui/modelMenuPresentation';
import { CorsoText } from '@/src/theme/CorsoText';
import { Composer } from '@/src/ui/composer/Composer';
import { SlideToConfirm } from '@/src/ui/controls/SlideToConfirm';
import { resolvePillPresentation } from '@/src/ui/controls/pillPresentation';
import { Material } from '@/src/ui/glass/Material';
import { ChartSeedCard } from '@/src/ui/home/ChartSeedCard';
import { resolveChartSeedEntryDelayMs } from '@/src/ui/home/chartSeedCardPresentation';
import { VerdictCard } from '@/src/ui/verdict/VerdictCard';
import { colors, kitType, kitWeight, radii, spacing, typography } from '@/src/ui/tokens';
import {
  HOW_IT_WORKS_ASK,
  HOW_IT_WORKS_BOT,
  HOW_IT_WORKS_CHART,
  HOW_IT_WORKS_CHART_HISTORY,
  HOW_IT_WORKS_INERT,
  resolveHowItWorksReview,
  HOW_IT_WORKS_VERDICT,
  resolveHowItWorksChartPresentation,
  resolveHowItWorksTypedAsk,
} from './howItWorksFixtures';
import type { HowItWorksBeatId } from './howItWorksPresentation';
import {
  HOW_IT_WORKS_RISE_PX,
  HOW_IT_WORKS_SPRING_DAMPING,
  scheduleHowItWorksCues,
  type HowItWorksBeatTimeline,
  type HowItWorksCue,
} from './howItWorksTimeline';

const EASE_OUT = Easing.out(Easing.cubic);

const CHANNELS = [
  'headline',
  'body',
  'scene',
  'cta',
  'composer',
  'echo',
  'review',
  'pill',
  'rule',
  'menu',
] as const;
type Channel = (typeof CHANNELS)[number];

function isChannel(id: string): id is Channel {
  return (CHANNELS as readonly string[]).includes(id);
}

export type HowItWorksCueState = Readonly<{
  channels: Readonly<Record<Channel, SharedValue<number>>>;
  /** Beat 1: letters of the scripted ask on screen. */
  typedCount: number;
  /** Beat 2: when the verdict card mounted, on the JS clock. */
  cardMountedAtMs: number | null;
  /** Beat 2: when the chart seed mounted, on the JS clock. */
  seedMountedAtMs: number | null;
  /** Beat 5: the picker is drawn open. */
  menuShown: boolean;
  /** The last beat's CTA is fully drawn and may take a tap. */
  ctaArmed: boolean;
}>;

function animate(value: SharedValue<number>, cue: HowItWorksCue) {
  if (cue.durationMs <= 0) {
    value.value = 1;
    return;
  }
  value.value =
    cue.kind === 'spring'
      ? withSpring(1, {
          duration: cue.durationMs,
          dampingRatio: HOW_IT_WORKS_SPRING_DAMPING,
        })
      : withTiming(1, { duration: cue.durationMs, easing: EASE_OUT });
}

/**
 * Runs one beat's timeline: resets every channel, then fires each cue at its
 * time (a Reduce Motion timeline fires everything at 0, so the page mounts in
 * its final state). A new timeline, a page change or an unmount cancels the
 * cues still pending.
 */
export function useHowItWorksCues(
  timeline: HowItWorksBeatTimeline | null,
): HowItWorksCueState {
  const headline = useSharedValue(0);
  const body = useSharedValue(0);
  const scene = useSharedValue(0);
  const cta = useSharedValue(0);
  const composer = useSharedValue(0);
  const echo = useSharedValue(0);
  const review = useSharedValue(0);
  const pill = useSharedValue(0);
  const rule = useSharedValue(0);
  const menu = useSharedValue(0);
  const channels = useMemo(
    () => ({ headline, body, scene, cta, composer, echo, review, pill, rule, menu }),
    [headline, body, scene, cta, composer, echo, review, pill, rule, menu],
  );
  const [typedCount, setTypedCount] = useState(0);
  const [cardMountedAtMs, setCardMountedAtMs] = useState<number | null>(null);
  const [seedMountedAtMs, setSeedMountedAtMs] = useState<number | null>(null);
  const [menuShown, setMenuShown] = useState(false);
  const [ctaArmed, setCtaArmed] = useState(false);

  useEffect(() => {
    for (const channel of CHANNELS) channels[channel].value = 0;
    setTypedCount(0);
    setCardMountedAtMs(null);
    setSeedMountedAtMs(null);
    setMenuShown(false);
    setCtaArmed(false);
    if (!timeline) return;
    return scheduleHowItWorksCues(timeline.cues, (cue) => {
      switch (cue.id) {
        case 'type':
          setTypedCount((cue.index ?? 0) + 1);
          return;
        case 'card':
          setCardMountedAtMs(Date.now());
          return;
        case 'seed':
          setSeedMountedAtMs(Date.now());
          return;
        case 'ctaArm':
          setCtaArmed(true);
          return;
        case 'menu':
          setMenuShown(true);
          animate(channels.menu, cue);
          return;
        default:
          if (isChannel(cue.id)) animate(channels[cue.id], cue);
      }
    });
  }, [timeline, channels]);

  return { channels, typedCount, cardMountedAtMs, seedMountedAtMs, menuShown, ctaArmed };
}

/** Opacity only: the headline, the body, the scene, the CTA. */
export function useHowItWorksFade(value: SharedValue<number>) {
  return useAnimatedStyle(() => ({ opacity: value.value }));
}

/** Opacity and a short rise: a card, a bubble, the pill. */
function useRise(value: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    opacity: value.value,
    transform: [{ translateY: (1 - value.value) * HOW_IT_WORKS_RISE_PX }],
  }));
}

export type HowItWorksSceneProps = Readonly<{
  beat: HowItWorksBeatId;
  cues: HowItWorksCueState;
  reduceMotion: boolean;
  /** Beat 5's picker, chosen from the live sign-in switches. */
  picker: ModelMenuPresentation;
  feeBps: number | null;
}>;

export function HowItWorksScene({ beat, cues, reduceMotion, picker, feeBps }: HowItWorksSceneProps) {
  switch (beat) {
    case 'ask':
      return <AskScene cues={cues} />;
    case 'verdict':
      return <VerdictScene cues={cues} reduceMotion={reduceMotion} />;
    case 'sign':
      return <SignScene cues={cues} feeBps={feeBps} />;
    case 'bots':
      return <BotsScene cues={cues} />;
    case 'ai':
      return <AiScene cues={cues} picker={picker} />;
  }
}

/** Beat 1: the real composer types `is WIF safe?`; Speak turns into send. */
function AskScene({ cues }: { cues: HowItWorksCueState }) {
  const rise = useRise(cues.channels.composer);
  return (
    <Reanimated.View
      style={rise}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Composer
        value={resolveHowItWorksTypedAsk(cues.typedCount)}
        onChangeText={HOW_IT_WORKS_INERT}
        onSend={HOW_IT_WORKS_INERT}
        onSpeak={HOW_IT_WORKS_INERT}
        onDictate={HOW_IT_WORKS_INERT}
        busy={false}
        askEnabled
        testID="how-it-works-composer"
      />
    </Reanimated.View>
  );
}

function VerdictScene({
  cues,
  reduceMotion,
}: {
  cues: HowItWorksCueState;
  reduceMotion: boolean;
}) {
  const echo = useRise(cues.channels.echo);
  const echoPill = resolvePillPresentation({ variant: 'queryEcho' });
  const chartPresentation = useMemo(resolveHowItWorksChartPresentation, []);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Reanimated.View style={[styles.echoRow, echo]}>
        <Material
          weight="pill"
          state={echoPill.state}
          radius={echoPill.radius}
          contentStyle={echoPill.containerStyle}
          hug
        >
          {echoPill.leading === null ? null : (
            <View
              style={{
                width: echoPill.leading.size,
                height: echoPill.leading.size,
                borderRadius: echoPill.radius,
                backgroundColor: echoPill.leading.color,
              }}
            />
          )}
          <CorsoText style={echoPill.labelStyle} numberOfLines={2}>
            {HOW_IT_WORKS_ASK}
          </CorsoText>
        </Material>
      </Reanimated.View>
      {cues.cardMountedAtMs === null ? null : (
        <VerdictCard
          tone={HOW_IT_WORKS_VERDICT.tone}
          word={HOW_IT_WORKS_VERDICT.word}
          ring={HOW_IT_WORKS_VERDICT.ring}
          subLine={HOW_IT_WORKS_VERDICT.subLine}
          evidence={HOW_IT_WORKS_VERDICT.evidence}
          action={null}
          assemblyKey={HOW_IT_WORKS_ASK}
          testID="how-it-works-verdict"
        />
      )}
      {cues.seedMountedAtMs === null ? null : (
        <ChartSeedCard
          chart={HOW_IT_WORKS_CHART}
          history={HOW_IT_WORKS_CHART_HISTORY}
          presentation={chartPresentation}
          verdictMountedAtMs={
            cues.seedMountedAtMs - resolveChartSeedEntryDelayMs({ reduceMotion })
          }
          newest={false}
          testID="how-it-works-chart-seed"
        />
      )}
    </View>
  );
}

function SignScene({ cues, feeBps }: { cues: HowItWorksCueState; feeBps: number | null }) {
  const review = useRise(cues.channels.review);
  const pill = useRise(cues.channels.pill);
  const r = resolveHowItWorksReview(feeBps);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Reanimated.View style={review}>
        <Material weight="card" radius={radii.verdict} contentStyle={styles.reviewBody}>
          <CorsoText style={styles.reviewLabel}>{r.receive.label}</CorsoText>
          <CorsoText style={styles.reviewAmount} numberOfLines={1}>
            {r.receive.value}
          </CorsoText>
          {r.rows.map((row) => (
            <View key={row.key} style={styles.reviewRow}>
              <CorsoText style={styles.reviewRowLabel}>{row.label}</CorsoText>
              <CorsoText style={styles.reviewRowValue} numberOfLines={1}>
                {row.value}
              </CorsoText>
            </View>
          ))}
        </Material>
      </Reanimated.View>
      <Reanimated.View style={[styles.pill, pill]}>
        <SlideToConfirm
          label={r.slideLabel}
          onConfirm={HOW_IT_WORKS_INERT}
          testID="how-it-works-slide"
        />
      </Reanimated.View>
    </View>
  );
}

/** Beat 4 (bots on only): the real rule card, a SOL stop loss, with Pause. */
function BotsScene({ cues }: { cues: HowItWorksCueState }) {
  const rise = useRise(cues.channels.rule);
  return (
    <Reanimated.View
      style={rise}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <BotCard
        bot={HOW_IT_WORKS_BOT.bot}
        inputUnit={HOW_IT_WORKS_BOT.inputUnit}
        outputUnit={HOW_IT_WORKS_BOT.outputUnit}
        busy={false}
        onPause={HOW_IT_WORKS_INERT}
        onResume={HOW_IT_WORKS_INERT}
        onKill={HOW_IT_WORKS_INERT}
        compact
        testID="how-it-works-rule"
      />
    </Reanimated.View>
  );
}

function AiScene({
  cues,
  picker,
}: {
  cues: HowItWorksCueState;
  picker: ModelMenuPresentation;
}) {
  const rise = useRise(cues.channels.composer);
  const menu = cues.channels.menu;
  const shown = cues.menuShown;
  const spring = useAnimatedStyle(() => ({
    transform: [{ scale: shown ? 0.97 + 0.03 * menu.value : 1 }],
  }));
  return (
    <Reanimated.View
      style={rise}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Reanimated.View style={[styles.menuOrigin, spring]}>
        <Composer
          value=""
          onChangeText={HOW_IT_WORKS_INERT}
          onSend={HOW_IT_WORKS_INERT}
          onSpeak={HOW_IT_WORKS_INERT}
          onDictate={HOW_IT_WORKS_INERT}
          modelMenu={picker}
          menuOpen={shown ? 'model' : undefined}
          quickActionsVisible={false}
          busy={false}
          askEnabled
          testID="how-it-works-picker"
        />
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  echoRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.smd,
  },
  reviewBody: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  reviewLabel: {
    color: colors.inkSecondary,
    fontSize: kitType.sub,
    fontFamily: typography.face(kitWeight.regular),
  },
  reviewAmount: {
    marginTop: 4,
    marginBottom: spacing.smd,
    color: colors.ink,
    fontSize: kitType.amount,
    lineHeight: Math.round(kitType.amount * 1.15),
    fontFamily: typography.face(kitWeight.semibold),
    fontWeight: kitWeight.semibold,
    fontVariant: [...typography.fontVariantTabular],
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.smd,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  reviewRowLabel: {
    color: colors.inkSecondary,
    fontSize: kitType.sub,
    fontFamily: typography.face(kitWeight.regular),
  },
  reviewRowValue: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: kitType.sub,
    fontFamily: typography.face(kitWeight.regular),
    fontVariant: [...typography.fontVariantTabular],
  },
  pill: { marginTop: spacing.smd },
  menuOrigin: { transformOrigin: 'left bottom' },
});
