import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { presentVerdictSourcesSubLine } from '@/src/features/tokenVitals/verdictSurface';
import { CorsoText } from '@/src/theme/CorsoText';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { Material } from '@/src/ui/glass/Material';
import { MATERIAL_WEIGHTS } from '@/src/ui/glass/materialTokens';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { colors, typography } from '@/src/ui/tokens';
import { EvidenceRow } from './EvidenceRow';
import { ReadRing } from './ReadRing';
import { ReadRingSection } from './ReadRingSection';
import { VerdictCta, type VerdictCtaAction } from './VerdictCta';
import { READ_RING_CARD as R } from './readRingPresentation';
import type { ReadRingView } from '@/src/features/tokenVitals/readRingCatalog';
import {
  EVIDENCE_SCROLL_FADE_DEPTH,
  EVIDENCE_VIEWPORT_MAX_HEIGHT,
  VERDICT_ASSEMBLY_ORDER,
  VERDICT_CARD_GEOMETRY as G,
  canonWeight,
  resolveChipDelayMs,
  resolveVerdictAssembly,
  resolveVerdictCtaArmDelayMs,
  resolveVerdictTone,
  type VerdictAssemblyPlan,
  type VerdictAssemblyStep,
  type VerdictChipTone,
  type VerdictTone,
} from './verdictCardPresentation';

/** One fact. The name is the callers' — the card paints it as a row. */
export type VerdictEvidenceChip = {
  key: string;
  tone?: VerdictChipTone;
  /** "LP locked", "Mint authority" — the fact, 16/400 white, wrapping whole. */
  label: string;
  value?: string | null;
};

/**
 * The card's door is the shared door (`VerdictCta`) — same type, same paint,
 * so the ask assembly's standalone Review and this one cannot drift.
 */
export type VerdictCardAction = VerdictCtaAction;

export type VerdictCardProps = {
  /** The verdict itself. Drives the dot and the word, and nothing else. */
  tone: VerdictTone;
  /** "Buy" / "Caution" / "Avoid" — the caller's copy, in the caller's voice. */
  word: string;
  ring?: ReadRingView | null;
  /**
   * `'none'` on token detail, where the ring already wraps the token's face in
   * the identity row and a second one on the card would be the same mark twice.
   */
  ringPlacement?: 'card' | 'none';
  stampText?: string | null;
  /** The reason — one sentence, 15/400 `grey1`. */
  subLine?: string | null;
  evidence?: readonly VerdictEvidenceChip[];
  action?: VerdictCardAction | null;
  accessibilityLabel?: string;
  /**
   * Change this and the card assembles again — a new answer, a new token.
   * Leave it stable and the card stays where it is.
   */
  assemblyKey?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function VerdictCard({
  tone,
  word,
  ring = null,
  ringPlacement = 'card',
  stampText = null,
  subLine = null,
  evidence = [],
  action = null,
  accessibilityLabel,
  assemblyKey,
  style,
  testID,
}: VerdictCardProps) {
  const { reduceMotion } = useAccessibilityPreference();
  /** Memoised: the plan is the assembly's identity, and a fresh object every
   * render would restart the animation on every render. */
  const plan = useMemo(
    () => resolveVerdictAssembly({ reduceMotion }),
    [reduceMotion],
  );
  const toneStyle = resolveVerdictTone(tone);

  const steps = useAssemblySteps(plan, evidence.length, assemblyKey);
  const sourcesSub = presentVerdictSourcesSubLine(subLine);

  return (
    <Material
      weight="card"
      radius={G.radius}
      style={style}
      contentStyle={styles.body}
      testID={testID}
    >
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.topRow}>
          {ring === null || ringPlacement === 'none' ? null : (
            <Animated.View style={steps.style.ring}>
              <ReadRing
                cells={ring.cells}
                verdict={ring.verdict}
                placement="card"
                drawKey={assemblyKey}
                accessibilityLabel={ring.accessibilityLabel}
                testID={testID ? `${testID}-ring` : 'verdict-read-ring'}
              />
            </Animated.View>
          )}
          <Animated.View
            style={[
              styles.dot,
              toneStyle.dotHollow
                ? { borderColor: toneStyle.dotColor, borderWidth: 1.4 }
                : { backgroundColor: toneStyle.dotColor },
              steps.dotStyle,
            ]}
          />
          <Animated.View style={[styles.wordSlot, steps.style.word]}>
            <CorsoText style={[styles.word, { color: toneStyle.wordColor }]}>
              {word}
            </CorsoText>
          </Animated.View>
          {stampText == null || stampText === '' ? null : (
            <Animated.View style={[styles.stamp, steps.style.word]}>
              <CorsoText style={styles.stampText}>{stampText}</CorsoText>
            </Animated.View>
          )}
        </View>

        {subLine == null || subLine === '' ? null : (
          <Animated.View style={steps.style.sub}>
            <CorsoText
              style={styles.sub}
              numberOfLines={sourcesSub.lines}
              maxFontSizeMultiplier={sourcesSub.maxFontSizeMultiplier}
              accessibilityLabel={sourcesSub.accessibilityLabel ?? undefined}
            >
              {subLine}
            </CorsoText>
          </Animated.View>
        )}

        {ring === null || ring.notRunRows.length === 0 ? null : (
          <View style={styles.notRun}>
            {ring.notRunRows.map((row, index) => (
              <EvidenceRow
                key={row.key}
                label={row.label}
                value={row.value}
                tone="neutral"
                isLast={index === ring.notRunRows.length - 1}
              />
            ))}
          </View>
        )}
        {ring === null || ring.caption == null ? null : (
          <CorsoText style={styles.caption}>{ring.caption}</CorsoText>
        )}

        <ReadRingSection ring={ring} />

        {ring !== null || evidence.length === 0 ? null : (
          <View style={styles.evidenceViewport}>
            <ScrollView
              style={styles.evidenceScroll}
              contentContainerStyle={styles.evidence}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {evidence.map((fact, index) => (
                <Animated.View key={fact.key} style={steps.chipStyle(index)}>
                  <EvidenceRow
                    label={fact.label}
                    value={fact.value}
                    tone={fact.tone}
                    isLast={index === evidence.length - 1}
                  />
                </Animated.View>
              ))}
            </ScrollView>
            <ScrollEdgeFade
              top={0}
              bottom={EVIDENCE_SCROLL_FADE_DEPTH}
              color={MATERIAL_WEIGHTS.card.opaqueFill}
              testID="verdict-evidence-scroll-fade"
            />
          </View>
        )}
      </View>

      {/*
        🔴 The door is NOT hit-testable until it is visible. `steps.ctaArmed`
        flips when the CTA's own fade completes; before that the wrapper takes
        no touches and the control itself refuses them
        (`resolveVerdictCtaArmDelayMs`, `VerdictCta`).
      */}
      {action === null ? null : (
        <Animated.View
          style={steps.style.cta}
          pointerEvents={steps.ctaArmed ? 'auto' : 'none'}
        >
          <VerdictCta action={action} pressable={steps.ctaArmed} />
        </Animated.View>
      )}
    </Material>
  );
}

/* ─── Assembly ────────────────────────────────────────────────────────────── */

/** A style whose values may be `Animated.Value`s. */
type AnimatedStyle = Animated.WithAnimatedValue<ViewStyle>;

type AssemblySteps = {
  /**
   * One style per element. `chips` is absent on purpose: the chips stagger
   * individually, so each chip owns its own value and the group owns none.
   */
  style: Record<Exclude<VerdictAssemblyStep, 'chips'>, AnimatedStyle>;
  /** The dot fades AND scales `.4 → 1`; every other element rises 5px. */
  dotStyle: AnimatedStyle;
  chipStyle: (index: number) => AnimatedStyle;
  ctaArmed: boolean;
};

function useAssemblySteps(
  plan: VerdictAssemblyPlan,
  chipCount: number,
  assemblyKey: string | undefined,
): AssemblySteps {
  const stepValues = useRef<Record<
    Exclude<VerdictAssemblyStep, 'chips'>,
    Animated.Value
  > | null>(null);
  if (stepValues.current === null) {
    stepValues.current = {
      dot: new Animated.Value(0),
      ring: new Animated.Value(0),
      word: new Animated.Value(0),
      sub: new Animated.Value(0),
      cta: new Animated.Value(0),
    };
  }
  const values = stepValues.current;
  const chipValues = useRef<Animated.Value[]>([]);
  while (chipValues.current.length < chipCount) {
    chipValues.current.push(new Animated.Value(0));
  }
  const chips = chipValues.current;
  const [ctaArmed, setCtaArmed] = useState(!plan.animated);

  useEffect(() => {
    const entering = [
      ...VERDICT_ASSEMBLY_ORDER.filter((step) => step !== 'chips').map(
        (step) => ({ value: values[step], delay: plan.delayMs[step] }),
      ),
      ...chips
        .slice(0, chipCount)
        .map((value, index) => ({
          value,
          delay: resolveChipDelayMs(index, plan),
        })),
    ];

    if (!plan.animated) {
      for (const { value } of entering) value.setValue(1);
      setCtaArmed(true);
      return;
    }

    setCtaArmed(false);
    const easing = Easing.bezier(
      plan.easing[0],
      plan.easing[1],
      plan.easing[2],
      plan.easing[3],
    );
    for (const { value } of entering) value.setValue(0);

    const assembly = Animated.parallel(
      entering.map(({ value, delay }) =>
        Animated.timing(value, {
          toValue: 1,
          delay,
          duration: plan.stepDurationMs,
          easing,
          useNativeDriver: true,
        }),
      ),
    );
    assembly.start();
    /** 🔴 The door opens when it is visible, not when it starts arriving. */
    const arm = setTimeout(
      () => setCtaArmed(true),
      resolveVerdictCtaArmDelayMs(plan),
    );

    return () => {
      assembly.stop();
      clearTimeout(arm);
    };
    // `assemblyKey` is the caller's "this is a new answer" signal.
  }, [plan, chipCount, chips, values, assemblyKey]);

  const rise = (value: Animated.Value): AnimatedStyle => ({
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [plan.risePx, 0],
        }),
      },
    ],
  });

  return {
    style: {
      dot: rise(values.dot),
      /** The ring fades in place and then draws itself once (`ReadRing`). */
      ring: { opacity: values.ring },
      word: rise(values.word),
      sub: rise(values.sub),
      cta: rise(values.cta),
    },
    dotStyle: {
      opacity: values.dot,
      transform: [
        {
          scale: values.dot.interpolate({
            inputRange: [0, 1],
            outputRange: [plan.dotScaleFrom, 1],
          }),
        },
      ],
    },
    chipStyle: (index: number) => {
      const value = chips[index];
      return value === undefined ? {} : rise(value);
    },
    ctaArmed,
  };
}

/* ─── Paint ───────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  body: {
    padding: G.padding,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.topRowGap,
    marginBottom: G.topRowMarginBottom,
  },
  dot: {
    width: G.dotSize,
    height: G.dotSize,
    borderRadius: G.dotSize / 2,
    alignSelf: 'center',
  },
  /**
   * The word never needs to shrink — the sub-line below carries the long copy
   * and wraps, so the word always gets the width it measured.
   */
  wordSlot: { flexShrink: 1, flexGrow: 1, minWidth: 0, gap: 2 },
  word: {
    fontSize: G.wordSize,
    lineHeight: G.wordSize,
    letterSpacing: G.wordLetterSpacing,
    fontFamily: typography.face(G.wordWeight),
    fontWeight: canonWeight(G.wordWeight),
    color: colors.ink,
  },
  stamp: { marginLeft: 'auto', alignSelf: 'flex-start', flexShrink: 0 },
  stampText: {
    fontSize: R.stampSize,
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkTertiary,
  },
  sub: {
    fontSize: G.subSize,
    fontFamily: typography.face(G.subWeight),
    fontWeight: canonWeight(G.subWeight),
    color: colors.inkSecondary,
    marginBottom: G.subMarginBottom,
  },
  notRun: { marginBottom: 4 },
  caption: {
    marginTop: R.captionMarginTop,
    fontSize: R.captionSize,
    fontFamily: typography.face('400'),
    fontWeight: canonWeight('400'),
    color: colors.inkTertiary,
  },
  /**
   * The rows' block opens with the full-width hairline the stills draw under
   * the top row; each row then carries its own divider, inset past its dot.
   */
  evidence: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingBottom: EVIDENCE_SCROLL_FADE_DEPTH,
  },
  evidenceViewport: {
    position: 'relative',
    maxHeight: EVIDENCE_VIEWPORT_MAX_HEIGHT,
    marginBottom: G.evidenceMarginBottom,
  },
  evidenceScroll: { maxHeight: EVIDENCE_VIEWPORT_MAX_HEIGHT },
});
