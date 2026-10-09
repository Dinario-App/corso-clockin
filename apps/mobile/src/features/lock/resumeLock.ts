import type { LockEscape } from '@/src/features/lock/lockEscape';

/** What `SessionContext.unlockSession` can answer, plus a thrown attempt. */
export type UnlockAttemptResult = 'unlocked' | 'passcode_required' | 'error';

export type UnlockAttemptAction = {
  /**
   * Positively re-close the gate. `true` on every outcome that is not a
   * verified unlock, so a cancel is a decision to stay locked rather than the
   * absence of a decision to open.
   */
  relock: boolean;
  navigate: 'app' | null;
  door: 'passcode' | 'lock-setup' | null;
};

/**
 * The resume-cancel state machine, whole. Pure: the screen decides nothing.
 *
 * Fail-closed by construction — every branch that is not a verified `'unlocked'`
 * relocks and stays on the lock route. A future third outcome added to
 * `UnlockAttemptResult` therefore inherits the safe answer rather than falling
 * through to the live session.
 */
export function resolveUnlockAttempt(input: {
  result: UnlockAttemptResult;
  lockEscape: LockEscape;
}): UnlockAttemptAction {
  if (input.result === 'unlocked') {
    return { relock: false, navigate: 'app', door: null };
  }
  return {
    relock: true,
    navigate: null,
    door: input.lockEscape === 'lock-setup' ? 'lock-setup' : 'passcode',
  };
}

/**
 * May this prompt's resolution act at all?
 *
 * `promptAppUnlock()` cannot be cancelled, so a resolution can arrive after the
 * screen that raised it has unmounted or after a newer attempt superseded it.
 * Only the live attempt on a mounted screen may move the session — otherwise an
 * orphan from a previous foreground could open the app in this one.
 */
export function shouldApplyUnlockAttempt(input: {
  attemptId: number;
  liveAttemptId: number;
  mounted: boolean;
}): boolean {
  if (!input.mounted) return false;
  return input.attemptId === input.liveAttemptId;
}

/**
 * May the lock screen hand the person back to `/(app)`?
 *
 * Only when the gate is genuinely open AND no prompt of ours is still standing.
 * The second clause is the whole of defect (2): without it a transient
 * `locked → false` navigates out from under a live system prompt, and the
 * cancel that follows lands in the session instead of on the lock.
 */
export function shouldLeaveLockRoute(input: {
  locked: boolean;
  promptInFlight: boolean;
}): boolean {
  return !input.locked && !input.promptInFlight;
}
