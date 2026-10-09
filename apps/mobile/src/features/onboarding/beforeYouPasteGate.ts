import { copy } from '@/constants/copy';

/** Non-negotiable. Do not lower this. */
export const BEFORE_YOU_PASTE_COOLDOWN_MS = 14_000;

export const BEFORE_YOU_PASTE_CHECK_IDS = [
  'nobody-asked',
  'my-words',
  'no-way-back',
] as const;

export type BeforeYouPasteCheckId = (typeof BEFORE_YOU_PASTE_CHECK_IDS)[number];

export type BeforeYouPasteCheck = {
  id: BeforeYouPasteCheckId;
  label: string;
  checked: boolean;
};

export type BeforeYouPasteGate = {
  title: string;
  body: string;
  checks: BeforeYouPasteCheck[];
  /** Whole seconds still on the clock, floored at 0. */
  remainingSeconds: number;
  cooldownDone: boolean;
  allChecked: boolean;
  canContinue: boolean;
  ctaLabel: string;
  ctaDisabled: boolean;
};

function labelFor(id: BeforeYouPasteCheckId): string {
  switch (id) {
    case 'nobody-asked':
      return copy.v1Onboarding.beforeYouPasteCheckNobodyAsked;
    case 'my-words':
      return copy.v1Onboarding.beforeYouPasteCheckMyWords;
    case 'no-way-back':
      return copy.v1Onboarding.beforeYouPasteCheckNoWayBack;
  }
}

function isCheckId(value: unknown): value is BeforeYouPasteCheckId {
  return (
    typeof value === 'string' &&
    (BEFORE_YOU_PASTE_CHECK_IDS as readonly string[]).includes(value)
  );
}

/** Seconds still to wait. Non-finite or negative elapsed reads as zero elapsed. */
export function beforeYouPasteRemainingSeconds(elapsedMs: unknown): number {
  const elapsed =
    typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) && elapsedMs > 0
      ? elapsedMs
      : 0;
  const remaining = BEFORE_YOU_PASTE_COOLDOWN_MS - elapsed;
  return remaining <= 0 ? 0 : Math.ceil(remaining / 1000);
}

export function resolveBeforeYouPasteGate(input: {
  checked: readonly unknown[];
  elapsedMs: unknown;
}): BeforeYouPasteGate {
  const checkedSet = new Set(input.checked.filter(isCheckId));
  const checks = BEFORE_YOU_PASTE_CHECK_IDS.map((id) => ({
    id,
    label: labelFor(id),
    checked: checkedSet.has(id),
  }));
  const allChecked = checks.every((check) => check.checked);
  const remainingSeconds = beforeYouPasteRemainingSeconds(input.elapsedMs);
  const cooldownDone = remainingSeconds === 0;
  const canContinue = allChecked && cooldownDone;
  return {
    title: copy.v1Onboarding.beforeYouPasteTitle,
    body: copy.v1Onboarding.beforeYouPasteBody,
    checks,
    remainingSeconds,
    cooldownDone,
    allChecked,
    canContinue,
    ctaLabel: cooldownDone
      ? copy.v1.continue
      : copy.v1Onboarding.beforeYouPasteWait(remainingSeconds),
    ctaDisabled: !canContinue,
  };
}

/**
 * The only way past the gate. Every caller must route through this — a screen
 * that reads `canContinue` off its own state is one refactor away from a
 * bypass.
 */
export function canLeaveBeforeYouPaste(input: {
  checked: readonly unknown[];
  elapsedMs: unknown;
}): boolean {
  return resolveBeforeYouPasteGate(input).canContinue;
}

export function toggleBeforeYouPasteCheck(
  checked: readonly unknown[],
  id: unknown,
): BeforeYouPasteCheckId[] {
  if (!isCheckId(id)) {
    return checked.filter(isCheckId);
  }
  const current = checked.filter(isCheckId);
  return current.includes(id)
    ? current.filter((entry) => entry !== id)
    : [...current, id];
}
