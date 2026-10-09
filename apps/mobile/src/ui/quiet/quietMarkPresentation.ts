import { CORSO_MARK_DRAWN } from '@/src/ui/brand/corsoBrandLockupPresentation';

export const QUIET_ARTBOARD = { width: 390, height: 844 } as const;

export const QUIET_VOID = '#060606';
/** Ink — type and the mark chevron. Same value as the theme ink. */
export const QUIET_INK = '#F4F1EC';
/** Quiet copy: secondary labels, field text, captions. */
export const QUIET_MUTE = '#A9B3C2';
/** Type on icy glass. */
export const QUIET_ON_ICY = '#0A0F17';

/** Ethena icy ramp — the only blue this module owns. */
export const ICY_HIGHLIGHT = '#D1E5FF';
export const ICY = '#A9C9F9';
export const ICY_DEEP = '#7F96BA';
/** Bloom core tint (the lit centre of the weather). */
export const ICY_BLOOM = '#C8DCFF';

/** Ethena navy well under the void: a radial from the well's corner. */
export const QUIET_WELL_STOPS = [
  { offset: 0, color: '#0A1018' },
  { offset: 0.55, color: '#080C12' },
  { offset: 1, color: QUIET_VOID },
] as const;

export type QuietCircle = { x: number; y: number; size: number };
export type QuietBloom = QuietCircle & {
  /** Opacity of the lit core; `resolveBloomGlow` derives the falloff. */
  peak: number;
  blur: number;
};

export type QuietCanvasVariant = 'splash' | 'getStarted' | 'onboarding' | 'note';

export type QuietCanvasPresentation = {
  well: QuietCircle;
  blooms: readonly QuietBloom[];
};

const SPLASH_WELL: QuietCircle = { x: -290.3, y: -103.3, size: 970.6 };
const ONBOARDING_WELL: QuietCircle = { x: -45, y: -40, size: 480 };

const CANVAS: Record<QuietCanvasVariant, QuietCanvasPresentation> = {
  splash: {
    well: SPLASH_WELL,
    blooms: [
      { x: -45, y: 174, size: 480, peak: 0.5, blur: 50 },
      { x: 45, y: 264, size: 300, peak: 0.7, blur: 27.5 },
      { x: 120, y: 339, size: 150, peak: 0.95, blur: 11 },
    ],
  },
  getStarted: {
    well: SPLASH_WELL,
    blooms: [
      { x: -7.56, y: -30.77, size: 405.12, peak: 0.24, blur: 50 },
      { x: 64.5, y: 41.29, size: 261, peak: 0.336, blur: 27.5 },
      { x: 127.8, y: 104.59, size: 134.4, peak: 0.456, blur: 11 },
    ],
  },
  /** 02–04 — navy well only. No bloom: the mark is not on these screens. */
  onboarding: {
    well: ONBOARDING_WELL,
    blooms: [],
  },
  note: {
    well: SPLASH_WELL,
    blooms: [],
  },
};

export function resolveQuietCanvas(
  variant: QuietCanvasVariant,
): QuietCanvasPresentation {
  return CANVAS[variant];
}

/** Share of the rim the lit spot sits up and left of centre (Frame 0 read). */
export const BLOOM_LIFT = 0.2;

export function resolveBloomGlow(bloom: QuietBloom) {
  const rim = bloom.size / 2;
  const sigma = bloom.blur;
  const r = rim + sigma * 2;
  const at = (d: number) => Number((Math.min(d, r) / r).toFixed(4));
  const level = (share: number) => Number((bloom.peak * share).toFixed(4));
  const lift = Number((rim * BLOOM_LIFT).toFixed(4));
  return {
    cx: bloom.x + rim,
    cy: bloom.y + rim,
    /** Gradient centre: the lit spot, lifted up-left of the circle centre. */
    gx: bloom.x + rim - lift,
    gy: bloom.y + rim - lift,
    r,
    /** Drawn circle radius: covers the gradient wherever its centre sits. */
    extent: r + Math.SQRT2 * lift,
    stops: [
      { offset: 0, color: ICY_BLOOM, opacity: level(1) },
      { offset: at(rim * 0.4), color: ICY, opacity: level(0.5) },
      { offset: at(rim), color: ICY, opacity: level(0.12) },
      { offset: at(rim + sigma), color: ICY_DEEP, opacity: level(0.03) },
      { offset: 1, color: ICY_DEEP, opacity: 0 },
    ],
  };
}

export type QuietMarkTarget = { cx: number; cy: number; drawnWidth: number };
export const QUIET_MARK_SPLASH: QuietMarkTarget = {
  cx: 195,
  cy: 414,
  drawnWidth: 110.6,
};
export const QUIET_MARK_GET_STARTED: QuietMarkTarget = {
  cx: 195,
  cy: 174.77,
  drawnWidth: 88.48,
};
export const QUIET_HEADLINE_TOP = 232;

/** Button column: 28 in from each edge, 334 on the artboard. */
export const QUIET_GUTTER = 28;

export type IcyCtaSize = 'hero' | 'step' | 'door';

export const ICY_CTA = {
  hero: { height: 58, radius: 29, labelSize: 17 },
  step: { height: 56, radius: 28, labelSize: 16 },
  door: { height: 52, radius: 26, labelSize: 17 },
} as const;

/** Quiet secondary — dark glass, mute label. Never icy, never azure. */
export const QUIET_SECONDARY = {
  height: 52,
  radius: 26,
  fill: 'rgba(20, 24, 32, 0.42)',
  edge: 'rgba(169, 179, 194, 0.16)',
  labelSize: 15,
} as const;

/** Onboarding surfaces (02 field + chips, 03 rows, 04 cash card). */
export const QUIET_FIELD = {
  height: 56,
  radius: 16,
  fill: 'rgba(20, 24, 32, 0.55)',
  edge: 'rgba(169, 201, 249, 0.28)',
} as const;
export const QUIET_CHIP = {
  radius: 16,
  fill: 'rgba(20, 24, 32, 0.55)',
  edge: 'rgba(169, 179, 194, 0.14)',
} as const;
export const QUIET_ROW = {
  height: 72,
  radius: 16,
  fill: 'rgba(20, 24, 32, 0.45)',
  edge: 'rgba(255, 255, 255, 0.06)',
  gap: 16,
} as const;
export const QUIET_CASH_CARD = {
  height: 120,
  radius: 20,
  fill: 'rgba(20, 24, 32, 0.5)',
  edge: 'rgba(169, 201, 249, 0.18)',
} as const;
/** 03 row disc: icy 35% → deep 15%, top to bottom. */
export const QUIET_ROW_DISC = {
  size: 36,
  from: { color: ICY, opacity: 0.35 },
  to: { color: ICY_DEEP, opacity: 0.15 },
} as const;

/**
 * Fit the 390 × 844 artboard to a device window the way `slice` would: one
 * uniform scale that covers the window, centred. The canvas and the mark both
 * go through this, so the bloom stays under the mark on any aspect ratio.
 */
export function resolveQuietFrameTransform(input: {
  width: number;
  height: number;
}): { scale: number; dx: number; dy: number } {
  const { width, height } = input;
  if (!(width > 0) || !(height > 0)) return { scale: 1, dx: 0, dy: 0 };
  const scale = Math.max(
    width / QUIET_ARTBOARD.width,
    height / QUIET_ARTBOARD.height,
  );
  return {
    scale,
    dx: (width - QUIET_ARTBOARD.width * scale) / 2,
    dy: (height - QUIET_ARTBOARD.height * scale) / 2,
  };
}

/**
 * The brand mark placed on the device window: the box size that makes its
 * drawing `drawnWidth` wide, positioned so the drawing's centre is the target.
 */
export function placeQuietMark(
  target: QuietMarkTarget,
  frame: { scale: number; dx: number; dy: number },
): { size: number; left: number; top: number } {
  const drawn = CORSO_MARK_DRAWN;
  const size =
    ((target.drawnWidth * frame.scale) / (drawn.right - drawn.left)) * 100;
  const k = size / 100;
  return {
    size,
    left:
      frame.dx + target.cx * frame.scale - ((drawn.left + drawn.right) / 2) * k,
    top:
      frame.dy + target.cy * frame.scale - ((drawn.top + drawn.bottom) / 2) * k,
  };
}
