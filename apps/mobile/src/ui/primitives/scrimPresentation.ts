import { SCRIM_OPACITY } from '@/src/motion/motionTokens.js';
import { resolveTransparencyTreatment } from '@/src/motion/resolveMotion.js';
import { colors } from '@/src/ui/tokens';

export const SCRIM_WIDTH = 393;
export const SCRIM_HEIGHT = 852;
export const SCRIM_TOP = 0;
export const SCRIM_LEFT = 0;
export const SCRIM_RIGHT = 0;
export const SCRIM_BOTTOM = 0;

export const SCRIM_OPACITY_PCT_DEFAULT = 65;
export const SCRIM_OPACITY_PCT_REDUCE_TRANSPARENCY = 90;

export type ScrimPresentationInput = {
  reduceTransparency: boolean;
};

export type ScrimPresentation = {
  position: 'absolute';
  top: number;
  left: number;
  right: number;
  bottom: number;
  backgroundColor: string;
  opacity: number;
  pointerEvents: 'none';
  accessibilityElementsHidden: true;
  importantForAccessibility: 'no-hide-descendants';
};

export function resolveScrimPresentation(
  input: ScrimPresentationInput,
): ScrimPresentation {
  const { opacity } = resolveTransparencyTreatment({
    treatment: 'sheetScrim',
    reduceTransparency: input.reduceTransparency,
  });

  return {
    position: 'absolute',
    top: SCRIM_TOP,
    left: SCRIM_LEFT,
    right: SCRIM_RIGHT,
    bottom: SCRIM_BOTTOM,
    backgroundColor: colors.scrim,
    opacity,
    pointerEvents: 'none',
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  };
}

export const SCRIM_OPACITY_LITERAL_DEFAULT = SCRIM_OPACITY.default;
export const SCRIM_OPACITY_LITERAL_REDUCE_TRANSPARENCY =
  SCRIM_OPACITY.reduceTransparency;
