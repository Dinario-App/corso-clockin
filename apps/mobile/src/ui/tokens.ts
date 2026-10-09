import {
  accent as themeAccent,
  colors as themeColors,
  radii as themeRadii,
  safetyPalette as themeSafetyPalette,
  spacing as themeSpacing,
  typography as themeTypography,
} from '../../constants/theme.js';

export const colors = themeColors;
export const safetyPalette = themeSafetyPalette;
/** Signal azure + compose-send — see `constants/theme.ts` for the three homes. */
export const accent = themeAccent;
export const radii = themeRadii;
export const spacing = themeSpacing;

export type TypographyWeight = '400' | '500' | '600' | '700';

/** Registered Inter face keys (see interFonts / interFontMap). */
export type TypographyFace =
  | 'InterVariable'
  | 'Inter'
  | 'Inter-Medium'
  | 'Inter-SemiBold'
  | 'Inter-Bold'
  | 'Inter-Black'
  | 'SpaceMono';

let variableFaceEnabled = true;

export function setVariableFaceEnabled(enabled: boolean): void {
  variableFaceEnabled = enabled;
}

export function isVariableFaceEnabled(): boolean {
  return variableFaceEnabled;
}

/**
 * Map a weight → a registered Inter face (interFontMap keys).
 *
 * Keep `fontWeight` alongside `fontFamily` at the call site: on the variable
 * branch the weight IS the instruction, and on the static branch iOS still
 * needs it to apply weight semantics.
 */
export function face(
  weight: TypographyWeight | string | number,
): TypographyFace {
  const normalized = String(weight);
  if (normalized === '900' || normalized === 'black') return 'Inter-Black';
  if (variableFaceEnabled) return 'InterVariable';
  switch (normalized) {
    case '500':
    case 'medium':
      return 'Inter-Medium';
    case '600':
    case 'semibold':
    case 'semi-bold':
      return 'Inter-SemiBold';
    case '700':
    case 'bold':
      return 'Inter-Bold';
    case '400':
    case 'normal':
    case 'regular':
    default:
      return 'Inter';
  }
}

export function staticFace(
  weight: TypographyWeight | string | number,
): TypographyFace {
  const previous = variableFaceEnabled;
  variableFaceEnabled = false;
  try {
    return face(weight);
  } finally {
    variableFaceEnabled = previous;
  }
}

export function mono(): TypographyFace {
  return 'SpaceMono';
}

export { kitType, kitWeight } from '../../constants/theme.js';

export const typography = {
  ...themeTypography,
  face,
  staticFace,
} as const;

export {
  ELEVATION_SOFT_BLUR_RADIUS,
  ELEVATION_SOFT_BOX_SHADOW,
  ELEVATION_SOFT_COLOR,
  ELEVATION_SOFT_CONSUMER_CLASSES,
  ELEVATION_SOFT_OFFSET_X,
  ELEVATION_SOFT_OFFSET_Y,
  ELEVATION_SOFT_SPREAD_DISTANCE,
  elevationSoftViewStyle,
  type ElevationSoftConsumerClass,
} from './tokens/elevationSoft.js';
