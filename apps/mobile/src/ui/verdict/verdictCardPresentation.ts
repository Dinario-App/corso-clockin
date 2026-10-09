import type { TextStyle } from 'react-native';
import { colors, kitType, kitWeight, radii } from '@/src/ui/tokens';
import { resolveDisabledPaint } from '@/src/ui/controls/disabledPresentation';
import { resolveCorsoGlass } from '@/src/ui/glass/corsoGlassRecipe';
import { READ_RING_INK } from './readRingPresentation';

/* ─── Tone — the verdict's own hue ────────────────────────────────────────── */

export type VerdictTone = 'buy' | 'caution' | 'avoid' | 'unread';

export const VERDICT_TONE_COLOR: Readonly<Record<VerdictTone, string>> =
  Object.freeze({
    buy: colors.priceUp,
    caution: colors.riskDanger,
    avoid: colors.priceDown,
    unread: READ_RING_INK,
  });

export type VerdictTonePresentation = {
  dotColor: string;
  wordColor: string;
  /** `unread` draws the dot as an outline: nothing was read, so nothing fills. */
  dotHollow: boolean;
};

export function resolveVerdictTone(tone: VerdictTone): VerdictTonePresentation {
  return {
    dotColor: VERDICT_TONE_COLOR[tone],
    wordColor: colors.ink,
    dotHollow: tone === 'unread',
  };
}

export type VerdictChipTone = 'ok' | 'warn' | 'danger' | 'neutral';

export const VERDICT_CHIP_GLYPH_COLOR: Readonly<
  Record<VerdictChipTone, string>
> = Object.freeze({
  ok: READ_RING_INK,
  warn: colors.riskDanger,
  danger: colors.priceDown,
  neutral: colors.inkTertiary,
});

export function resolveVerdictChipGlyphColor(
  tone: VerdictChipTone | undefined,
): string {
  return VERDICT_CHIP_GLYPH_COLOR[tone ?? 'neutral'];
}

export const EVIDENCE_ROW = Object.freeze({
  height: 44,
  labelLines: undefined,
  valueLines: 1,
  lineHeight: 20,
  dot: 8,
  labelSize: 16,
  labelWeight: '400' as const,
  valueSize: 16,
});

export const EVIDENCE_VIEWPORT_MAX_HEIGHT = EVIDENCE_ROW.height * 3;

/** Keeps the final warning clear of the card-colour scroll affordance. */
export const EVIDENCE_SCROLL_FADE_DEPTH = 12;

export function resolveEvidenceRowText(
  label: string,
  value: string | undefined,
): { label: string; value: string | null } {
  const l = label.trim();
  const v = (value ?? '').trim();
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
  if (v.length === 0 || norm(l) === norm(v)) {
    return { label: l, value: null };
  }
  return { label: l, value: v };
}

export type EvidenceRowMarkShape = 'dot' | 'triangle' | 'octagon';

const EVIDENCE_MARK_SHAPE: Readonly<
  Record<VerdictChipTone, EvidenceRowMarkShape>
> = Object.freeze({
  danger: 'octagon',
  warn: 'triangle',
  ok: 'dot',
  neutral: 'dot',
});

export function resolveEvidenceRowMarker(fact: { tone?: VerdictChipTone }): {
  shape: EvidenceRowMarkShape;
  color: string;
} {
  const tone = fact.tone ?? 'neutral';
  return {
    shape: EVIDENCE_MARK_SHAPE[tone],
    color: resolveVerdictChipGlyphColor(tone),
  };
}

export type VerdictCtaTone = {
  /** The armed paint — a CorsoGlass material, never a colour. */
  material: 'icy-cta';
  fillDisabled: string;
  label: string;
  labelDisabled: string;
  pressTranslateY: number;
};

export function resolveVerdictCtaTone(): VerdictCtaTone {
  const disabled = resolveDisabledPaint('cta');
  return {
    material: 'icy-cta',
    fillDisabled: disabled.fill,
    label: resolveCorsoGlass('icy-cta').label,
    labelDisabled: disabled.label,
    pressTranslateY: 1,
  };
}

/** `-.022em` at 22pt — RN letter-spacing is px, not em. */
function em(size: number, emValue: number): number {
  return Math.round(size * emValue * 100) / 100;
}

export const VERDICT_CARD_GEOMETRY = Object.freeze({
  radius: radii.verdict,
  padding: 16,

  topRowGap: 10,
  topRowMarginBottom: 4,

  dotSize: 10,
  dotGlow: null,

  wordSize: kitType.title,
  wordWeight: kitWeight.semibold,
  wordLetterSpacing: em(kitType.title, -0.022),

  /** The reason, 15/400 `grey1`. */
  subSize: kitType.sub,
  subWeight: kitWeight.regular,
  subMarginBottom: 12,

  /** Dot → label, read off the still (`stills/04-token-detail.png`). */
  evidenceDotGap: 10,
  /**
   * The mark's slot. Fixed, so a triangle or octagon row's label starts where
   * a dot row's does; the drawn marks keep the old glyph's 11pt box.
   */
  evidenceMarkerWidth: 12,
  evidenceMarkSize: 11,
  /** Label → value, the least a truncated label may come to the value. */
  evidenceValueGap: 12,
  /** Centres the one-line 16pt label in the 44pt row. */
  evidencePaddingVertical: 11,
  /**
   * The content → CTA gap. `ASSEMBLY_CTA_MARGIN_TOP` (15) mirrors it, so the
   * rhythm above the standalone door matches the card's.
   */
  evidenceMarginBottom: 15,

  ctaHeight: 52,
  ctaRadius: radii.cta,
  ctaLabelSize: kitType.headline,
  ctaLabelWeight: kitWeight.semibold,
});

export function canonWeight(weight: string): TextStyle['fontWeight'] {
  return weight as TextStyle['fontWeight'];
}

export type VerdictAssemblyStep =
  | 'dot'
  | 'ring'
  | 'word'
  | 'sub'
  | 'chips'
  | 'cta';

export const VERDICT_ASSEMBLY_ORDER: readonly VerdictAssemblyStep[] =
  Object.freeze(['dot', 'ring', 'word', 'sub', 'chips', 'cta']);

export const VERDICT_ASSEMBLY_DELAY_MS: Readonly<
  Record<VerdictAssemblyStep, number>
> = Object.freeze({
  dot: 0,
  /** 🔴 The ring arrives WITH the dot, and draws itself once (`ReadRing`). */
  ring: 0,
  word: 140,
  sub: 560,
  chips: 680,
  cta: 1100,
});

export const VERDICT_ASSEMBLY_STEP_MS = 350;

export function resolveVerdictCtaArmDelayMs(plan: {
  animated: boolean;
  delayMs: Readonly<Record<VerdictAssemblyStep, number>>;
  stepDurationMs: number;
}): number {
  if (!plan.animated) return 0;
  return plan.delayMs.cta + plan.stepDurationMs;
}
export const VERDICT_ASSEMBLY_RISE_PX = 5;
/** The dot alone scales in: `.4 → 1`. */
export const VERDICT_DOT_SCALE_FROM = 0.4;
export const VERDICT_CHIP_STAGGER_MS = 90;
export const VERDICT_EASING_BEZIER = Object.freeze([0.3, 0.8, 0.3, 1] as const);

export type VerdictAssemblyPlan = {
  animated: boolean;
  delayMs: Readonly<Record<VerdictAssemblyStep, number>>;
  stepDurationMs: number;
  risePx: number;
  dotScaleFrom: number;
  chipStaggerMs: number;
  easing: readonly number[];
};

const RESOLVED_DELAY: Readonly<Record<VerdictAssemblyStep, number>> =
  Object.freeze({
    dot: 0,
    ring: 0,
    word: 0,
    sub: 0,
    chips: 0,
    cta: 0,
  });

export function resolveVerdictAssembly(input: {
  reduceMotion: boolean;
}): VerdictAssemblyPlan {
  if (input.reduceMotion) {
    return {
      animated: false,
      delayMs: RESOLVED_DELAY,
      stepDurationMs: 0,
      risePx: 0,
      dotScaleFrom: 1,
      chipStaggerMs: 0,
      easing: VERDICT_EASING_BEZIER,
    };
  }
  return {
    animated: true,
    delayMs: VERDICT_ASSEMBLY_DELAY_MS,
    stepDurationMs: VERDICT_ASSEMBLY_STEP_MS,
    risePx: VERDICT_ASSEMBLY_RISE_PX,
    dotScaleFrom: VERDICT_DOT_SCALE_FROM,
    chipStaggerMs: VERDICT_CHIP_STAGGER_MS,
    easing: VERDICT_EASING_BEZIER,
  };
}

export function resolveChipDelayMs(
  index: number,
  plan: VerdictAssemblyPlan,
): number {
  return plan.delayMs.chips + Math.max(0, index) * plan.chipStaggerMs;
}

