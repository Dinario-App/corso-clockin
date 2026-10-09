import type { BoxShadowValue } from 'react-native';
import {
  ethena,
  ethenaFloatSurface,
  ethenaMaterial,
} from '@/constants/theme.ethena';
import { resolveGlassBackdrop } from '@/src/ui/primitives/platformGlassPresentation';

export const CORSO_GLASS_MATERIALS = [
  'float-glass',
  'icy-cta',
  'summon-ring',
  'ground-tray',
] as const;

export type CorsoGlassMaterial = (typeof CORSO_GLASS_MATERIALS)[number];

export const FLOAT_GLASS_BLUR = ethenaMaterial.frostBlur;

export type FloatGlassTint = 'float' | 'float2' | 'frost';

export const FLOAT_GLASS_TINTS: Readonly<Record<FloatGlassTint, string>> =
  Object.freeze({
    float: ethenaMaterial.float,
    float2: ethenaMaterial.float2,
    frost: ethenaMaterial.frost,
  });

export const FLOAT_GLASS_DROP: readonly BoxShadowValue[] = Object.freeze([
  Object.freeze({
    offsetX: 0,
    offsetY: 8,
    blurRadius: 24,
    spreadDistance: 0,
    color: '#00000080',
  }),
]);

/**
 * The icy CTA's soft inner edge — a 1dp top highlight, the value the Quiet
 * step CTA already drew. Inner light, never a backdrop blur.
 */
export const ICY_CTA_INNER: readonly BoxShadowValue[] = Object.freeze([
  Object.freeze({
    offsetX: 0,
    offsetY: 1,
    blurRadius: 2,
    color: ethenaMaterial.icyInner,
    inset: true,
  }),
]);

export type CorsoGlassRecipe = {
  readonly material: CorsoGlassMaterial;
  /** `expo-blur` intensity / the liquid-glass gate. `0` = never refracts. */
  readonly blur: number;
  /** One solid fill, or the two stops of the icy gradient (top → bottom). */
  readonly fill: string | readonly [string, string];
  readonly rimColor: string | null;
  readonly rimWidth: number;
  /** Outer shadow. */
  readonly drop: readonly BoxShadowValue[];
  /** Inner (inset) light. Only `icy-cta` carries one. */
  readonly inner: readonly BoxShadowValue[];
  /** The label colour that reads on this material. */
  readonly label: string;
};

export function resolveCorsoGlass(
  material: CorsoGlassMaterial,
  tint: FloatGlassTint = material === 'summon-ring' ? 'float2' : 'float',
): CorsoGlassRecipe {
  switch (material) {
    case 'float-glass':
      return {
        material,
        blur: FLOAT_GLASS_BLUR,
        fill: FLOAT_GLASS_TINTS[tint],
        rimColor: ethenaMaterial.rim,
        rimWidth: 1,
        drop: FLOAT_GLASS_DROP,
        inner: [],
        label: ethena.ink.primary,
      };
    case 'summon-ring':
      // float-glass, plus the cool ring that names the Ask family. The ring
      // REPLACES the rim — one stroke, never two.
      return {
        ...resolveCorsoGlass('float-glass', tint),
        material,
        rimColor: ethenaMaterial.summonRing,
      };
    case 'icy-cta':
      return {
        material,
        blur: 0,
        fill: [ethena.icy1, ethena.icy2],
        rimColor: null,
        rimWidth: 0,
        drop: FLOAT_GLASS_DROP,
        inner: ICY_CTA_INNER,
        label: ethena.ink.onIcy,
      };
    case 'ground-tray':
      return {
        material,
        blur: 0,
        fill: ethena.tray,
        rimColor: ethenaMaterial.rimHair,
        rimWidth: 1,
        drop: [],
        inner: [],
        label: ethena.ink.primary,
      };
  }
}

/* ─── The icy disc — icy-cta's round form on Home ─────────────────────────── */

export type IcyCtaForm = 'disc';

export type IcyDiscRecipe = Omit<CorsoGlassRecipe, 'fill' | 'rimColor'> & {
  /** `ICY_1` at 26%, laid over `underlay`. */
  readonly fill: string;
  /** The opaque colour under the fill, so the disc reads the same anywhere. */
  readonly underlay: string;
  readonly rimColor: string;
  /** Laid over the fill while the disc is pressed. */
  readonly pressedVeil: string;
};

export function resolveIcyDisc(): IcyDiscRecipe {
  return {
    material: 'icy-cta',
    blur: 0,
    fill: ethenaMaterial.icyGlass,
    underlay: ethena.void,
    rimColor: ethena.icy2,
    rimWidth: 1,
    drop: FLOAT_GLASS_DROP,
    inner: ICY_CTA_INNER,
    label: ethena.ink.primary,
    pressedVeil: ethenaMaterial.v2,
  };
}

export function isGlassMaterial(material: CorsoGlassMaterial): boolean {
  return resolveCorsoGlass(material).blur > 0;
}

/* ─── What a float surface looks like where nothing refracts ──────────────── */

export function resolveFloatGlassSurface(
  tint: FloatGlassTint = 'float',
): string {
  return ethenaFloatSurface(tint);
}

/* ─── Which engine draws the glass, here, now ─────────────────────────────── */

export type CorsoGlassEngine = 'liquid-glass' | 'blur' | 'solid' | 'none';

export function resolveCorsoGlassEngine(input: {
  material: CorsoGlassMaterial;
  platformOS: unknown;
  /** `Platform.Version` — a string like `'26.0'` on iOS, the API level on Android. */
  platformVersion: unknown;
  liquidGlassAvailable: boolean;
  hasBlurTarget: boolean;
  reduceTransparency: boolean;
  nested: boolean;
}): CorsoGlassEngine {
  if (!isGlassMaterial(input.material)) return 'none';
  if (input.nested || input.reduceTransparency) return 'solid';
  if (
    input.platformOS === 'ios' &&
    iosMajor(input.platformVersion) >= 26 &&
    input.liquidGlassAvailable
  ) {
    return 'liquid-glass';
  }
  const backdrop = resolveGlassBackdrop({
    platformOS: input.platformOS,
    apiLevel:
      typeof input.platformVersion === 'number' ? input.platformVersion : 0,
    hasBlurTarget: input.hasBlurTarget,
    reduceTransparency: input.reduceTransparency,
  });
  return backdrop === 'blur' ? 'blur' : 'solid';
}

function iosMajor(version: unknown): number {
  if (typeof version === 'number') return version;
  if (typeof version !== 'string') return 0;
  const major = Number.parseInt(version, 10);
  return Number.isFinite(major) ? major : 0;
}
