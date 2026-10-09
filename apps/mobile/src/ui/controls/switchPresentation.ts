import {
  ETHENA_ACCESSIBLE_RIM,
  VOID,
  ethenaInk,
  ethenaMaterial,
} from '@/constants/theme.ethena';
import { resolveDisabledPaint } from '@/src/ui/controls/disabledPresentation';

export const SWITCH_TRACK = Object.freeze({ width: 62, height: 28 });
export const SWITCH_THUMB = Object.freeze({ width: 38, height: 24 });
export const SWITCH_PAD = 2;
/**
 * The OFF track's boundary. Its fill is ~1.2:1 on the ground, so the rim is
 * what carries the edge. Drawn inside the 2pt inset in both states (the track's
 * own colour when ON), so the thumb never moves.
 */
export const SWITCH_RIM_WIDTH = 1;
export const SWITCH_TRAVEL = SWITCH_TRACK.width - SWITCH_THUMB.width - 2 * SWITCH_PAD;
export const SWITCH_TRACK_RADIUS = SWITCH_TRACK.height / 2;
export const SWITCH_THUMB_RADIUS = SWITCH_THUMB.height / 2;
export const SWITCH_THUMB_DURATION_MS = 180;
/** 28 + 8 + 8 = 44pt tall hit area. */
export const SWITCH_HIT_SLOP = Object.freeze({ top: 8, bottom: 8 });
/** The OFF thumb's lift. The ON thumb is dark on light and takes none. */
export const SWITCH_THUMB_SHADOW = Object.freeze([
  Object.freeze({ offsetX: 0, offsetY: 1, blurRadius: 3, spreadDistance: 0, color: '#00000040' }),
]);

const NO_THUMB_SHADOW: readonly [] = Object.freeze([]);

export type SwitchSemanticState =
  | 'checked-enabled'
  | 'checked-disabled'
  | 'unchecked-enabled'
  | 'unchecked-disabled';

export type SwitchAccessibilityState = {
  checked: boolean;
  disabled: boolean;
};

export type SwitchPresentation = {
  value: boolean;
  disabled: boolean;
  semanticState: SwitchSemanticState;
  accessibilityRole: 'switch';
  accessibilityState: SwitchAccessibilityState;
  trackColor: string;
  /** ON takes the track's own colour: no rim shows. */
  trackRimColor: string;
  thumbColor: string;
  thumbShadow: typeof SWITCH_THUMB_SHADOW | readonly [];
  thumbOffset: number;
  opacity: number;
};

export function normalizeSwitchBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export function resolveSwitchSemanticState(input: {
  checked: boolean;
  disabled: boolean;
}): SwitchSemanticState {
  if (input.checked) {
    return input.disabled ? 'checked-disabled' : 'checked-enabled';
  }

  return input.disabled ? 'unchecked-disabled' : 'unchecked-enabled';
}

export function resolveSwitchPresentation(input: {
  checked: unknown;
  disabled: unknown;
}): SwitchPresentation | null {
  const checked = normalizeSwitchBoolean(input.checked);
  const disabled = normalizeSwitchBoolean(input.disabled);

  if (checked === null || disabled === null) {
    return null;
  }

  return {
    value: checked,
    disabled,
    semanticState: resolveSwitchSemanticState({ checked, disabled }),
    accessibilityRole: 'switch',
    accessibilityState: {
      checked,
      disabled,
    },
    trackColor: checked ? ethenaInk.primary : ethenaMaterial.v2,
    trackRimColor: checked ? ethenaInk.primary : ETHENA_ACCESSIBLE_RIM,
    thumbColor: checked ? VOID : ethenaInk.secondary,
    thumbShadow: checked ? NO_THUMB_SHADOW : SWITCH_THUMB_SHADOW,
    thumbOffset: checked ? SWITCH_TRAVEL : 0,
    // A disabled UISwitch keeps its state colours at the system 50%.
    opacity: disabled ? resolveDisabledPaint('toggle').opacity : 1,
  };
}
