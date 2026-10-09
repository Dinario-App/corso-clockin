import { copy } from '@/constants/copy';

export const ONE_SECOND_VISIBLE_AFTER_MS = 600;

export function shouldShowOneSecond(input: {
  working: unknown;
  elapsedMs: unknown;
}): boolean {
  if (input.working !== true) {
    return false;
  }
  const elapsed = input.elapsedMs;
  return (
    typeof elapsed === 'number' &&
    Number.isFinite(elapsed) &&
    elapsed >= ONE_SECOND_VISIBLE_AFTER_MS
  );
}

/** The whole screen. One line, and nothing about the machine. */
export function oneSecondHeadline(): string {
  return copy.v1Onboarding.oneSecond;
}
