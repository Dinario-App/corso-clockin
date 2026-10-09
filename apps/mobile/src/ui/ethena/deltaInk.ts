import { colors } from '@/constants/theme';
import { ethena } from '@/constants/theme.ethena';

export type DeltaDirection = 'up' | 'down' | 'flat' | null | undefined;

/** Exactly zero and unknown both read in this ink. */
export const DELTA_NEUTRAL_INK = ethena.ink.secondary;

export function resolveDeltaInk(direction: DeltaDirection): string {
  if (direction === 'up') return colors.priceUp;
  if (direction === 'down') return colors.priceDown;
  return DELTA_NEUTRAL_INK;
}
