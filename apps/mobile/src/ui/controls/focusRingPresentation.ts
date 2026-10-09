import type { ViewStyle } from 'react-native';
import { colors } from '@/src/ui/tokens';
import { withAlpha } from '@/src/ui/controls/colorAlpha.js';

export const FOCUS_RING_WIDTH = 1.5;
export const FOCUS_RING_OFFSET = 2;
export const FOCUS_RING_RADIUS = 8;
export const FOCUS_RING_COLOR = withAlpha(colors.ink, 0.4);

export type FocusRingPresentation = {
  /** Whether the ring paints at all. */
  visible: boolean;
  /**
   * Absolute style for the ring sibling. Spread onto a `pointerEvents="none"`
   * `View` that is the LAST child of the control's own box.
   */
  ringStyle: ViewStyle;
};

export function resolveFocusRingPresentation(input: {
  /** The control has focus (`onFocus` fired, `onBlur` has not). */
  focused: boolean;
  /** The control is being pressed — a touch, which is not focus-visible. */
  pressed?: boolean;
  /** The control is not operable, so there is nothing to ring. */
  disabled?: boolean;
  radius?: number;
}): FocusRingPresentation {
  const visible =
    input.focused === true &&
    input.disabled !== true &&
    input.pressed !== true;

  return {
    visible,
    ringStyle: {
      position: 'absolute',
      top: -FOCUS_RING_OFFSET,
      left: -FOCUS_RING_OFFSET,
      right: -FOCUS_RING_OFFSET,
      bottom: -FOCUS_RING_OFFSET,
      borderWidth: FOCUS_RING_WIDTH,
      borderColor: FOCUS_RING_COLOR,
      borderRadius: resolveFocusRingRadius(input.radius),
    },
  };
}

/**
 * A ring `FOCUS_RING_OFFSET` outside a box of radius `r` is concentric with it
 * at `r + FOCUS_RING_OFFSET`. A pill (999) stays a pill.
 */
export function resolveFocusRingRadius(controlRadius?: number): number {
  if (controlRadius === undefined || !Number.isFinite(controlRadius)) {
    return FOCUS_RING_RADIUS;
  }
  if (controlRadius >= 999) return controlRadius;
  return Math.max(0, controlRadius) + FOCUS_RING_OFFSET;
}
