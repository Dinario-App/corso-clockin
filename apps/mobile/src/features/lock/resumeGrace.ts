import type { AppLockPreference } from '@/src/features/security/appLock';
import { shouldLockForAppState } from '@/src/features/session/sessionGate';

export const RESUME_GRACE_MS = 60_000;

/** Both clocks, read together at one instant. */
export type ClockReading = { monotonicMs: number; wallMs: number };

/**
 * When the app left the foreground. `null` while foreground, or when nothing
 * is owed (no lock method, or a verified unlock reset the window).
 */
export type AwayMark = { leftAt: ClockReading } | null;

export type ResumeGraceStep = {
  /** The mark to hold until the next transition. */
  away: AwayMark;
  /** Close the gate now. There is deliberately no way to open it. */
  lock: boolean;
};

export type ClockSource = {
  monotonicNow?: () => number;
  wallNow: () => number;
};

function defaultClockSource(): ClockSource {
  const performance = (globalThis as { performance?: { now?: () => number } })
    .performance;
  return {
    monotonicNow:
      typeof performance?.now === 'function'
        ? () => performance.now!()
        : undefined,
    wallNow: () => Date.now(),
  };
}

/**
 * Read both clocks. A missing monotonic source reads as `NaN`, which
 * `isWithinResumeGrace` treats as outside the window: fail closed.
 */
export function readResumeClock(
  source: ClockSource = defaultClockSource(),
): ClockReading {
  return {
    monotonicMs: source.monotonicNow ? source.monotonicNow() : Number.NaN,
    wallMs: source.wallNow(),
  };
}

function isUsableGrace(graceMs: number): boolean {
  return Number.isFinite(graceMs) && graceMs > 0;
}

/**
 * Is `now` still inside the window that opened at `leftAt`?
 *
 * The longer of the two elapsed times decides, so neither a rewound wall clock
 * nor a monotonic clock paused in device sleep can hold the window open. The
 * boundary belongs to the lock: exactly `graceMs` away is outside.
 */
export function isWithinResumeGrace(input: {
  leftAt: ClockReading;
  now: ClockReading;
  graceMs?: number;
}): boolean {
  const graceMs = input.graceMs ?? RESUME_GRACE_MS;
  if (!isUsableGrace(graceMs)) return false;
  const monotonicElapsed = input.now.monotonicMs - input.leftAt.monotonicMs;
  const wallElapsed = input.now.wallMs - input.leftAt.wallMs;
  if (!Number.isFinite(monotonicElapsed) || !Number.isFinite(wallElapsed)) {
    return false;
  }
  if (monotonicElapsed < 0 || wallElapsed < 0) return false;
  return Math.max(monotonicElapsed, wallElapsed) < graceMs;
}

export function stepResumeGrace(input: {
  away: AwayMark;
  nextState: string;
  lockPreference: AppLockPreference;
  now: ClockReading;
  graceMs?: number;
}): ResumeGraceStep {
  const graceMs = input.graceMs ?? RESUME_GRACE_MS;
  if (input.nextState !== 'active') {
    if (
      !shouldLockForAppState({
        nextState: input.nextState,
        lockPreference: input.lockPreference,
      })
    ) {
      return { away: input.away, lock: false };
    }
    return {
      away: input.away ?? { leftAt: input.now },
      lock: !isUsableGrace(graceMs),
    };
  }
  if (input.away === null) return { away: null, lock: false };
  return {
    away: null,
    lock: !isWithinResumeGrace({
      leftAt: input.away.leftAt,
      now: input.now,
      graceMs,
    }),
  };
}

/**
 * Away from the foreground the app draws the canvas over itself.
 *
 * Before the window existed the lock committed on leave, and the lock screen
 * is what the iOS app switcher captured. Deferring the lock would otherwise
 * hand the switcher a live balance, and a return past the window would show
 * the live session for a frame before the gate closed. The cover closes both,
 * for exactly the installs that have a lock.
 */
export function shouldConcealForAppState(input: {
  nextState: string;
  lockPreference: AppLockPreference;
}): boolean {
  return shouldLockForAppState(input);
}
