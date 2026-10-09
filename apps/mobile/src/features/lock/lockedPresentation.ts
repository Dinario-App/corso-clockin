import { copy } from '@/constants/copy';
import type { AppLockPreference } from '@/src/features/security/appLock';

export function resolveLockedPresentation(input: {
  lockPreference: AppLockPreference;
  biometricLabel: string;
}) {
  const biometricEligible =
    input.lockPreference === 'biometric' &&
    (input.biometricLabel === 'Fingerprint' ||
      input.biometricLabel === 'Face ID');

  return {
    unlockLabel: biometricEligible
      ? copy.lock.unlockWith(input.biometricLabel)
      : copy.lock.passcodeTitle,
    unlockMethod: biometricEligible
      ? ('biometric' as const)
      : ('passcode' as const),
    showPasscodeFallback: biometricEligible,
  };
}
