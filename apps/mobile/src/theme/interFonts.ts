export const INTER_FAMILY = 'Inter' as const;

export const INTER_VARIABLE_FAMILY = 'InterVariable' as const;

export const INTER_BLACK_FAMILY = 'Inter-Black' as const;

export const INTER_WEIGHTS = {
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
  black: 900,
} as const;

export const INTER_VARIABLE_WEIGHT_RANGE = { min: 100, max: 900 } as const;

export const VARIABLE_FONT_MIN_IOS_MAJOR = 16;
export const VARIABLE_FONT_MIN_ANDROID_API = 26;

export function supportsVariableFontWeights(
  os: string,
  version: string | number | null | undefined,
): boolean {
  const major =
    typeof version === 'number'
      ? Math.floor(version)
      : Number.parseInt(String(version ?? ''), 10);
  if (!Number.isFinite(major)) return false;
  if (os === 'ios') return major >= VARIABLE_FONT_MIN_IOS_MAJOR;
  if (os === 'android') return major >= VARIABLE_FONT_MIN_ANDROID_API;
  return false;
}

/**
 * Static TTF files shipped under assets/fonts.
 * Paths are relative to apps/mobile (Expo project root).
 */
export const INTER_FONT_ASSETS = [
  {
    file: 'InterVariable.ttf',
    path: './assets/fonts/InterVariable.ttf',
    weight: INTER_WEIGHTS.regular,
    mapKey: 'InterVariable',
    /** The one variable face. Its `weight` above is only the default instance. */
    variable: true,
  },
  {
    file: 'Inter-Regular.ttf',
    path: './assets/fonts/Inter-Regular.ttf',
    weight: INTER_WEIGHTS.regular,
    mapKey: 'Inter',
    variable: false,
  },
  {
    file: 'Inter-Medium.ttf',
    path: './assets/fonts/Inter-Medium.ttf',
    weight: INTER_WEIGHTS.medium,
    mapKey: 'Inter-Medium',
    variable: false,
  },
  {
    file: 'Inter-SemiBold.ttf',
    path: './assets/fonts/Inter-SemiBold.ttf',
    weight: INTER_WEIGHTS.semiBold,
    mapKey: 'Inter-SemiBold',
    variable: false,
  },
  {
    file: 'Inter-Bold.ttf',
    path: './assets/fonts/Inter-Bold.ttf',
    weight: INTER_WEIGHTS.bold,
    mapKey: 'Inter-Bold',
    variable: false,
  },
  {
    file: 'Inter-Black.ttf',
    path: './assets/fonts/Inter-Black.ttf',
    weight: INTER_WEIGHTS.black,
    mapKey: 'Inter-Black',
    variable: false,
  },
] as const;

/** The four static faces — the fallback ladder, in ascending weight order. */
export const INTER_STATIC_FALLBACK_ASSETS = INTER_FONT_ASSETS.filter(
  (a) => !a.variable && a.weight <= INTER_WEIGHTS.bold,
);

/** Keys registered with useFonts / loadAsync (see interFontMap.ts). */
export const INTER_FONT_MAP_KEYS = INTER_FONT_ASSETS.map((a) => a.mapKey);
