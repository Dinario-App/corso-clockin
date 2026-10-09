import type { BoxShadowValue, ViewStyle } from 'react-native';
import { IOS_GLASS_STROKE_ALPHA } from '@/constants/theme.js';
import { ethena, ethenaMaterial } from '@/constants/theme.ethena';
import {
  FLOAT_GLASS_BLUR,
  FLOAT_GLASS_DROP,
  FLOAT_GLASS_TINTS,
} from './corsoGlassRecipe';

/* ─── Weights ─────────────────────────────────────────────────────────────── */

export type MaterialWeightName =
  | 'pill'
  | 'card'
  | 'chip'
  | 'group'
  | 'composer'
  | 'menu'
  | 'frost'
  | 'float';

/**
 * `rest` is the resting surface. `hi` is the one lifted read a weight owns —
 * the user's bubble on `pill`, the pressed/current card. Weights without a
 * lifted read resolve `hi` to `rest`.
 */
export type MaterialState = 'rest' | 'hi';

export type MaterialFillLayer = {
  readonly angle: number;
  readonly colors: readonly string[];
  /** 0–1 positions, one per colour, ascending. */
  readonly locations: readonly number[];
};

/**
 * One drop shadow. RN 0.86 `boxShadow` entry, minus the always-zero offsetX.
 * Colours are `#RRGGBBAA`, the repo's convention for a shadow.
 */
export type MaterialDrop = {
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly spreadDistance: number;
  readonly color: string;
};

/**
 * SwiftUI / `UIBlurEffect` material for the iOS 26+ build. Only the two glass
 * weights have one; a flat weight is `null`. `blurTint` is the `expo-blur` name
 * for the same material, so the flip needs no lookup table.
 */
export type MaterialIosMap = {
  readonly swiftui:
    | '.ultraThinMaterial'
    | '.regularMaterial'
    | '.thickMaterial';
  readonly blurTint:
    | 'systemUltraThinMaterialDark'
    | 'systemMaterialDark'
    | 'systemThickMaterialDark';
};

export type MaterialWeight = {
  /** `expo-blur` intensity. 0 on every flow weight. */
  readonly blurIntensity: number;
  readonly saturate: number;
  readonly brightness: number;
  /** The paint: opaque on flow weights, translucent over a live blur on glass. */
  readonly fill: string;
  /** What the weight paints when it cannot blur (Reduce Transparency, no target). */
  readonly opaqueFill: string;
  readonly fillStops: readonly MaterialFillLayer[];
  readonly edgeTopColor: string;
  /** Hairline rim — `KIT_RIM` on dark controls and cards on black, else none. */
  readonly rimColor: string;
  readonly innerWashColor: string | null;
  readonly innerWashHeight: number;
  /** Soft drop shadow(s) — floating objects only. */
  readonly shadow: readonly MaterialDrop[];
  readonly ios: MaterialIosMap | null;
  readonly radius: number;
  /** The lifted read. `undefined` where the weight has only one. */
  readonly hi?: {
    readonly fill: string;
    readonly fillStops: readonly MaterialFillLayer[];
    readonly edgeTopColor: string;
    readonly rimColor: string;
    readonly innerWashColor: string | null;
    readonly innerWashHeight: number;
    readonly shadow: readonly MaterialDrop[];
  };
};

const NONE = 'transparent';
const NO_STOPS: readonly MaterialFillLayer[] = Object.freeze([]);
export const KIT_RIM = 'rgba(255,255,255,0.10)';
export const KIT_RIM_HI = 'rgba(255,255,255,0.16)';
const DROP_FLOAT: readonly MaterialDrop[] = Object.freeze(
  FLOAT_GLASS_DROP.map((drop) =>
    Object.freeze({
      offsetY: Number(drop.offsetY ?? 0),
      blurRadius: Number(drop.blurRadius ?? 0),
      spreadDistance: Number(drop.spreadDistance ?? 0),
      color: String(drop.color),
    }),
  ),
);
const FLAT = {
  blurIntensity: 0,
  saturate: 1,
  brightness: 1,
  fillStops: NO_STOPS,
  innerWashColor: null,
  innerWashHeight: 0,
  ios: null,
} as const;

export const MATERIAL_WEIGHTS: Readonly<Record<MaterialWeightName, MaterialWeight>> = Object.freeze({
  pill: Object.freeze({ ...FLAT, fill: '#111111', opaqueFill: '#111111', edgeTopColor: NONE, rimColor: KIT_RIM, shadow: [], radius: 999,
    hi: Object.freeze({ fill: '#242424', fillStops: NO_STOPS, edgeTopColor: NONE, rimColor: NONE, innerWashColor: null, innerWashHeight: 0, shadow: [] }) }),
  card: Object.freeze({ ...FLAT, fill: '#111111', opaqueFill: '#111111', edgeTopColor: NONE, rimColor: KIT_RIM, shadow: [], radius: 22,
    hi: Object.freeze({ fill: '#181818', fillStops: NO_STOPS, edgeTopColor: NONE, rimColor: KIT_RIM, innerWashColor: null, innerWashHeight: 0, shadow: [] }) }),
  chip: Object.freeze({ ...FLAT, fill: '#171717', opaqueFill: '#171717', edgeTopColor: NONE, rimColor: NONE, shadow: [], radius: 16 }),
  group: Object.freeze({ ...FLAT, fill: '#242424', opaqueFill: '#242424', edgeTopColor: NONE, rimColor: NONE, shadow: [], radius: 18 }),
  composer: Object.freeze({ ...FLAT, fill: '#1F1F1F', opaqueFill: '#1F1F1F', edgeTopColor: KIT_RIM_HI, rimColor: KIT_RIM, shadow: [], radius: 28 }),
  frost: Object.freeze({ blurIntensity: FLOAT_GLASS_BLUR, saturate: 1, brightness: 1, fillStops: NO_STOPS, innerWashColor: null, innerWashHeight: 0,
    fill: FLOAT_GLASS_TINTS.frost, opaqueFill: ethena.void, edgeTopColor: NONE, rimColor: ethenaMaterial.rim, shadow: DROP_FLOAT, radius: 38,
    ios: Object.freeze({ swiftui: '.regularMaterial', blurTint: 'systemMaterialDark' }) }),
  /** Anchored menus and the composer popovers — float-glass, footprint only. */
  menu: Object.freeze({ blurIntensity: FLOAT_GLASS_BLUR, saturate: 1, brightness: 1, fillStops: NO_STOPS, innerWashColor: null, innerWashHeight: 0,
    fill: FLOAT_GLASS_TINTS.float, opaqueFill: ethena.void, edgeTopColor: NONE, rimColor: ethenaMaterial.rim, shadow: DROP_FLOAT, radius: 22,
    ios: Object.freeze({ swiftui: '.regularMaterial', blurTint: 'systemMaterialDark' }) }),
  float: Object.freeze({ blurIntensity: FLOAT_GLASS_BLUR, saturate: 1, brightness: 1, fillStops: NO_STOPS, innerWashColor: null, innerWashHeight: 0,
    fill: FLOAT_GLASS_TINTS.float, opaqueFill: ethena.void, edgeTopColor: NONE, rimColor: ethenaMaterial.rim, shadow: DROP_FLOAT, radius: 999,
    ios: Object.freeze({ swiftui: '.regularMaterial', blurTint: 'systemMaterialDark' }) }),
});

export const ONGLASS = '#242424';
export const ONGLASS_MID = '#242424';
export const ONGLASS_HI = '#2C2C2C';

export const ACCESSIBLE_RIM = `rgba(255, 255, 255, ${IOS_GLASS_STROKE_ALPHA})`;
/** Legacy name for the importers that still read it. */
export const INTERACTIVE_RIM = ACCESSIBLE_RIM;

export const MATERIAL_RIM_WIDTH = 1;

export function resolveMaterialRim(input: {
  weight: MaterialWeightName;
  state?: MaterialState;
  /** One of the four WCAG cases: unlabelled control, slide track, placeholder-less input. */
  essentialBoundary?: boolean;
  increaseContrast?: boolean;
}): string {
  if (input.essentialBoundary === true || input.increaseContrast === true) return ACCESSIBLE_RIM;
  return resolveWeightState(input.weight, input.state).rimColor;
}

/* ─── Resolvers ───────────────────────────────────────────────────────────── */

type MaterialFace = {
  fill: string;
  fillStops: readonly MaterialFillLayer[];
  edgeTopColor: string;
  rimColor: string;
  innerWashColor: string | null;
  innerWashHeight: number;
  shadow: readonly MaterialDrop[];
};

/** The weight's rest face, or its lifted face when one exists. */
export function resolveWeightState(
  weight: MaterialWeightName,
  state: MaterialState = 'rest',
): MaterialFace {
  const spec = MATERIAL_WEIGHTS[weight];
  if (state === 'hi' && spec.hi !== undefined) return spec.hi;
  return {
    fill: spec.fill,
    fillStops: spec.fillStops,
    edgeTopColor: spec.edgeTopColor,
    rimColor: spec.rimColor,
    innerWashColor: spec.innerWashColor,
    innerWashHeight: spec.innerWashHeight,
    shadow: spec.shadow,
  };
}

export function gradientVector(angleDeg: number): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  return {
    start: { x: round4(0.5 - dx / 2), y: round4(0.5 - dy / 2) },
    end: { x: round4(0.5 + dx / 2), y: round4(0.5 + dy / 2) },
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Drop shadows → the RN 0.86 `boxShadow` array form. No legacy `shadow*`. */
export function materialBoxShadow(
  shadow: readonly MaterialDrop[],
): ReadonlyArray<BoxShadowValue> {
  return shadow.map((drop) => ({
    offsetX: 0,
    offsetY: drop.offsetY,
    blurRadius: drop.blurRadius,
    spreadDistance: drop.spreadDistance,
    color: drop.color,
  }));
}

/** What `<Material>` renders. Pure — every branch is testable without React. */
export type MaterialPresentation = {
  /** Real backdrop blur. Only `menu`/`frost`/`float` ever blur. */
  blur: boolean;
  blurIntensity: number;
  /** The opaque paint, when there is no live blur under the surface. */
  opaqueFill: string | null;
  /** The float-glass tint — over the live blur, or over the void. `null` on flow weights. */
  fillColor: string | null;
  fillStops: readonly MaterialFillLayer[];
  edgeTopColor: string;
  rimColor: string;
  innerWashColor: string | null;
  innerWashHeight: number;
  boxShadow: ReadonlyArray<BoxShadowValue>;
  borderRadius: number;
  /** Fill the caller's box, or hug the children. */
  layoutStyle: ViewStyle;
};

export function resolveMaterialPresentation(input: {
  weight: MaterialWeightName;
  state?: MaterialState;
  radius?: number;
  /** One of the four WCAG 1.4.11 cases — takes `ACCESSIBLE_RIM`. */
  essentialBoundary?: boolean;
  increaseContrast?: boolean;
  reduceTransparency?: boolean;
  hug?: boolean;
  /** Whether this platform can actually draw a backdrop blur right here. */
  canBlur: boolean;
}): MaterialPresentation {
  const spec = MATERIAL_WEIGHTS[input.weight];
  const face = resolveWeightState(input.weight, input.state);
  const glass = spec.blurIntensity > 0;
  const blur = glass && input.canBlur && input.reduceTransparency !== true;

  return {
    blur,
    blurIntensity: spec.blurIntensity,
    /**
     * A float-glass weight that cannot refract keeps its tint and lays it
     * over the void (`opaqueFill`), so it reads solid — never the grey plate
     * of a second, flat material.
     */
    opaqueFill: blur
      ? null
      : glass || face.fill === spec.fill
        ? spec.opaqueFill
        : face.fill,
    fillColor: glass ? face.fill : null,
    fillStops: face.fillStops,
    edgeTopColor: face.edgeTopColor,
    rimColor: resolveMaterialRim({
      weight: input.weight,
      state: input.state,
      essentialBoundary: input.essentialBoundary,
      increaseContrast: input.increaseContrast,
    }),
    innerWashColor: face.innerWashColor,
    innerWashHeight: face.innerWashHeight,
    boxShadow: materialBoxShadow(face.shadow),
    borderRadius: input.radius ?? spec.radius,
    layoutStyle:
      input.hug === true ? { flexGrow: 0, flexShrink: 0 } : { flexGrow: 1 },
  };
}
