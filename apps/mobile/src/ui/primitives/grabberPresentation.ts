import { colors } from '@/src/ui/tokens';

export const GRABBER = Object.freeze({
  width: 36,
  height: 5,
  radius: 2.5,
  color: colors.grabber,
});

export const GRABBER_WIDTH = GRABBER.width;
export const GRABBER_HEIGHT = GRABBER.height;
export const GRABBER_BORDER_RADIUS = GRABBER.radius;

export type GrabberPresentation = {
  width: number;
  height: number;
  borderRadius: number;
  backgroundColor: string;
  accessibilityElementsHidden: true;
  importantForAccessibility: 'no-hide-descendants';
};

/**
 * Pure presentation for the Tier-1 Grabber primitive.
 * Decorative sheet chrome — hosts own drag/dismiss semantics.
 */
export function resolveGrabberPresentation(): GrabberPresentation {
  return {
    width: GRABBER_WIDTH,
    height: GRABBER_HEIGHT,
    borderRadius: GRABBER_BORDER_RADIUS,
    backgroundColor: GRABBER.color,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  };
}
