import { copy } from '@/constants/copy';

export type FaceIdPath = 'import' | 'sign-in';

export type FaceIdStep = {
  path: FaceIdPath;
  title: string;
  body: string;
  primaryLabel: string;
  passcodeLabel: string;
  /** Import path: false. Nothing in the UI may override this. */
  canSkip: boolean;
  skipLabel: string | null;
};

export type BiometricSetupResult = Readonly<{
  success: boolean;
  error?: string;
}>;

export type BiometricSetupOutcome =
  | { action: 'advance_to_passcode' }
  | { action: 'stay_silent' }
  | { action: 'show_error' };

/**
 * Expo can resolve without drawing native chrome when no biometric is enrolled.
 * Setup owns the Corso passcode fallback, so only an explicit user cancellation
 * is silent; every other refusal either advances safely or paints an error.
 */
export function resolveBiometricSetupOutcome(
  result: BiometricSetupResult,
): BiometricSetupOutcome {
  if (result.success === true) return { action: 'advance_to_passcode' };
  if (
    result.error === 'not_enrolled' ||
    result.error === 'not_available' ||
    result.error === 'passcode_not_set' ||
    result.error === 'no_space'
  ) {
    return { action: 'advance_to_passcode' };
  }
  if (result.error === 'user_cancel') return { action: 'stay_silent' };
  return { action: 'show_error' };
}

/**
 * Only an explicitly recognised recoverable session type earns a skip.
 * Unknown, absent, or malformed session types fail closed to the import path.
 */
export function resolveFaceIdPath(sessionType: unknown): FaceIdPath {
  return sessionType === 'privy_embedded' || sessionType === 'connected_external'
    ? 'sign-in'
    : 'import';
}

export function canSkipBiometricSetup(sessionType: unknown): boolean {
  if (sessionType === 'connected_external') return false;
  return resolveFaceIdPath(sessionType) === 'sign-in';
}

export function resolveFaceIdStep(input: {
  sessionType: unknown;
  biometricLabel: string;
}): FaceIdStep {
  const path = resolveFaceIdPath(input.sessionType);
  const canSkip = canSkipBiometricSetup(input.sessionType);
  return {
    path,
    title: copy.v1Onboarding.useBiometric(input.biometricLabel),
    body: copy.v1Onboarding.everyTimeMoneyMoves(input.biometricLabel),
    primaryLabel: copy.v1Onboarding.turnOnBiometric(input.biometricLabel),
    passcodeLabel: copy.v1Onboarding.usePasscode,
    canSkip,
    skipLabel: canSkip ? copy.v1Onboarding.notNow : null,
  };
}
