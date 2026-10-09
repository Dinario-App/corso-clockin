import {
  ETHENA_ACCESSIBLE_RIM,
  ethenaInk,
  ethenaMaterial,
} from '@/constants/theme.ethena';
import type { MaterialWeightName } from '@/src/ui/glass/materialTokens';

export const COMPOSER_CARD_WEIGHT = 'float' satisfies MaterialWeightName;

/** The field's hint, and the "Ask is off" hint. One rung under typed text. */
export const COMPOSER_PLACEHOLDER_INK = ethenaInk.secondary;

/** The quiet ink a control on the float carries: a badge monogram, a chevron. */
export const COMPOSER_CONTROL_QUIET_INK = ethenaInk.secondary;

/** A control on the composer's float, and a badge well in its picker. */
export const COMPOSER_CONTROL_FILL = ethenaMaterial.v2;

export type ComposerControlPaint = {
  fill: string;
  rimWidth: number;
  rimColor: string | null;
};

/**
 * A control on the composer's float. Under Increase Contrast it takes the 3:1
 * rim the card takes, drawn inside its own box so the control does not grow.
 */
export function resolveComposerControlPaint(input: {
  increaseContrast: boolean;
}): ComposerControlPaint {
  return {
    fill: COMPOSER_CONTROL_FILL,
    rimWidth: input.increaseContrast ? 1 : 0,
    rimColor: input.increaseContrast ? ETHENA_ACCESSIBLE_RIM : null,
  };
}
