import { colors } from '@/constants/theme.js';
import { ethenaInk } from '@/constants/theme.ethena';

export const INK_TERTIARY = colors.inkTertiary;
/** Tertiary under Increase Contrast — grey1, one rung up. */
export const INK_TERTIARY_HIGH_CONTRAST = colors.inkSecondary;
/** Quaternary at rest — grey3. Structure and decoration. */
export const INK_QUATERNARY = colors.inkQuaternary;
/** Quaternary under Increase Contrast — grey2, the WCAG 1.4.11 3:1 floor, not AA. */
export const INK_QUATERNARY_HIGH_CONTRAST = colors.inkTertiary;

/** Ethena tertiary at rest (`INK_3`). */
export const ETHENA_INK_TERTIARY = ethenaInk.tertiary;
/** Ethena tertiary under Increase Contrast — Ethena secondary, one rung up. */
export const ETHENA_INK_TERTIARY_HIGH_CONTRAST = ethenaInk.secondary;

export type InkPalette = {
  readonly inkTertiary: string;
  readonly inkQuaternary: string;
};

const RESTING: InkPalette = Object.freeze({
  inkTertiary: INK_TERTIARY,
  inkQuaternary: INK_QUATERNARY,
});

const LIFTED: InkPalette = Object.freeze({
  inkTertiary: INK_TERTIARY_HIGH_CONTRAST,
  inkQuaternary: INK_QUATERNARY_HIGH_CONTRAST,
});

/**
 * The two ink tokens at the requested contrast level.
 *
 * Both objects are module constants, so a consumer can compare by reference and
 * a `false` read costs nothing — which is the property that lets the resting
 * path in `CorsoText` be a literal identity function.
 */
export function resolveInkPalette(increaseContrast: boolean): InkPalette {
  return increaseContrast ? LIFTED : RESTING;
}

export function liftInkColor(
  color: string | undefined,
  increaseContrast: boolean,
): string | undefined {
  if (!increaseContrast || color === undefined) return color;
  if (color === RESTING.inkTertiary) return LIFTED.inkTertiary;
  if (color === RESTING.inkQuaternary) return LIFTED.inkQuaternary;
  return liftEthenaInk(color);
}

/** The Ethena ladder's one lift: tertiary to secondary. Every other colour is returned unchanged. */
function liftEthenaInk(color: string): string {
  if (color === ETHENA_INK_TERTIARY) return ETHENA_INK_TERTIARY_HIGH_CONTRAST;
  return color;
}

export function resolveSheetInkColor(
  color: string | undefined,
  increaseContrast: boolean,
): string | undefined {
  if (color === undefined) return color;
  return liftInkColor(liftEthenaInk(color), increaseContrast);
}
