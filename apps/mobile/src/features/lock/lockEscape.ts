import type { AppLockPreference } from '@/src/features/security/appLock';

/**
 * Preferences that wrote something `unlockSession` / `unlockWithPasscode` can
 * actually verify. `'skipped'` and `null` wrote nothing.
 */
export function hasUnlockCredential(
  lockPreference: AppLockPreference,
): boolean {
  return lockPreference === 'biometric' || lockPreference === 'passcode';
}

export type LockEscape = 'lock-setup' | null;

/**
 * The non-destructive way out of a locked session, or `null` when the lock has
 * a door of its own. Pure: the screen decides nothing.
 */
export function resolveLockEscape(input: {
  locked: boolean;
  lockPreference: AppLockPreference;
}): LockEscape {
  if (!input.locked) return null;
  return hasUnlockCredential(input.lockPreference) ? null : 'lock-setup';
}

export function shouldAllowLockSetup(input: {
  needsLockSetup: boolean;
  locked: boolean;
  lockPreference: AppLockPreference;
}): boolean {
  if (input.needsLockSetup) return true;
  return (
    resolveLockEscape({
      locked: input.locked,
      lockPreference: input.lockPreference,
    }) === 'lock-setup'
  );
}
