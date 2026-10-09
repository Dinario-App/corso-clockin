import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device-scoped. Names no person. */
export const PENDING_SIGN_OUT_CLEAR_KEY = 'corso.signOutPendingClear.v1';

const MARKER_VALUE = String(1);

/** Bounded. The last entry repeats so a stuck clear does not spin faster. */
export const INCOMING_CLEAR_RETRY_DELAYS_MS = [500, 1000, 2000, 4000] as const;

let inflight: Promise<void> | null = null;
let drainFlight: Promise<void> | null = null;
/**
 * Same-process projection of the marker. False until the write that stores
 * the marker, and again when a read shows the marker is gone.
 */
let markerArmed = false;

export function __resetPendingSignOutClearForTests(): void {
  inflight = null;
  drainFlight = null;
  markerArmed = false;
}

export function isPendingSignOutClearArmed(): boolean {
  return markerArmed;
}

/** Render-time gate. Closed unless this process still projects a stored marker. */
export function shouldDrainArmedIncomingClear(
  stepped: PendingClearStep,
): boolean {
  return stepped.drain && isPendingSignOutClearArmed();
}

export async function armPendingSignOutClear(): Promise<void> {
  await AsyncStorage.setItem(PENDING_SIGN_OUT_CLEAR_KEY, MARKER_VALUE);
  markerArmed = true;
}

export async function finishPendingSignOutClear(outcome: {
  unfinished: readonly string[];
}): Promise<void> {
  if (outcome.unfinished.length > 0) return;
  await AsyncStorage.removeItem(PENDING_SIGN_OUT_CLEAR_KEY);
  markerArmed = false;
}

async function runPendingSignOutClear(): Promise<void> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(PENDING_SIGN_OUT_CLEAR_KEY);
  } catch {
    return;
  }
  if (raw !== MARKER_VALUE) {
    markerArmed = false;
    return;
  }
  // The read is the record. A failed clear leaves the projection armed.
  markerArmed = true;
  try {
    const { clearPerUserLocalStores } = await import('./localClearRegistry');
    const outcome = await clearPerUserLocalStores('sign-out');
    await finishPendingSignOutClear(outcome);
  } catch {
    // Marker stays. The next attempt tries the clear again.
  }
}

async function drainPendingSignOutClear(): Promise<void> {
  if (drainFlight) return drainFlight;
  const run = runPendingSignOutClear().finally(() => {
    if (drainFlight === run) drainFlight = null;
  });
  drainFlight = run;
  return run;
}

/** Shared by boot and by the gate that mounts per-user readers. */
export function pendingSignOutClearBeforePerUserReads(): Promise<void> {
  if (!inflight) {
    inflight = runPendingSignOutClear().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/**
 * Boot. True only when this attempt left no pending marker. A failed clear,
 * or a read that cannot see storage, stays closed so the provider can retry.
 */
export async function bootPerUserReadsMayOpen(): Promise<boolean> {
  await pendingSignOutClearBeforePerUserReads();
  try {
    const raw = await AsyncStorage.getItem(PENDING_SIGN_OUT_CLEAR_KEY);
    return raw !== MARKER_VALUE;
  } catch {
    return false;
  }
}

export async function openPerUserReadsAfterPendingClear<T>(
  read: () => Promise<T> | T,
): Promise<T> {
  await pendingSignOutClearBeforePerUserReads();
  return read();
}

/**
 * Same-process sign-in. Does not join the boot drain: that one may already
 * have observed an empty marker. True only when the marker is gone. A failed
 * read or a marker that remains stays closed.
 */
export async function releasePerUserReadsForIncomingSession(): Promise<boolean> {
  await drainPendingSignOutClear();
  try {
    const raw = await AsyncStorage.getItem(PENDING_SIGN_OUT_CLEAR_KEY);
    return raw !== MARKER_VALUE;
  } catch {
    return false;
  }
}

function incomingClearRetryDelay(attempt: number): number {
  const last = INCOMING_CLEAR_RETRY_DELAYS_MS.length - 1;
  const index = attempt < last ? attempt : last;
  return (
    INCOMING_CLEAR_RETRY_DELAYS_MS[index] ??
    INCOMING_CLEAR_RETRY_DELAYS_MS[last]
  );
}

/**
 * Same-process drain that returned closed. Tries again on a bounded delay
 * and when the subscriber reports the foreground. Opens only when the
 * release reports the marker is gone.
 */
export function retryIncomingClearWhileClosed(args: {
  onOpen: () => void;
  subscribeAppState: (onForeground: () => Promise<void> | void) => () => void;
  schedule: (run: () => Promise<void>, delayMs: number) => () => void;
  release?: () => Promise<boolean>;
}): () => void {
  const release = args.release ?? releasePerUserReadsForIncomingSession;
  let cancelled = false;
  let opened = false;
  let running = false;
  let attempt = 0;
  let cancelTimer: (() => void) | null = null;

  const clearTimer = (): void => {
    cancelTimer?.();
    cancelTimer = null;
  };

  const armTimer = (): void => {
    clearTimer();
    const delayMs = incomingClearRetryDelay(attempt);
    attempt += 1;
    cancelTimer = args.schedule(() => attemptOnce(), delayMs);
  };

  const attemptOnce = (): Promise<void> => {
    if (cancelled || opened || running) return Promise.resolve();
    running = true;
    return release().then(
      (open) => {
        running = false;
        if (cancelled || opened) return;
        if (open) {
          opened = true;
          clearTimer();
          args.onOpen();
          return;
        }
        armTimer();
      },
      () => {
        running = false;
        if (cancelled || opened) return;
        armTimer();
      },
    );
  };

  const unsubscribe = args.subscribeAppState(() => attemptOnce());
  armTimer();
  return () => {
    cancelled = true;
    clearTimer();
    unsubscribe();
  };
}

export type PerUserSessionSnapshot = {
  readonly privyUserId: string | null;
  readonly sessionType: string | null;
  readonly sessionAddress: string | null;
};

export type PendingClearStep = {
  readonly sawSignOut: boolean;
  readonly drain: boolean;
};

/**
 * `previous === null` is the first observation after boot, not a sign-in.
 * A drain is a session that appears after this process saw no Privy user
 * and no session, or a different person replacing the session. A Privy user
 * who stays present while the wallet address disappears is the resume gap.
 */
export function stepPendingClearTransition(args: {
  sawSignOut: boolean;
  previous: PerUserSessionSnapshot | null;
  next: PerUserSessionSnapshot;
}): PendingClearStep {
  if (args.previous === null) {
    return { sawSignOut: false, drain: false };
  }
  const wasSignedOut =
    args.previous.privyUserId === null && args.previous.sessionAddress === null;
  const nowSignedOut =
    args.next.privyUserId === null && args.next.sessionAddress === null;
  let sawSignOut = args.sawSignOut;
  if (!wasSignedOut && nowSignedOut) sawSignOut = true;

  const hadSession = args.previous.sessionAddress !== null;
  const hasSession = args.next.sessionAddress !== null;
  const samePrivy =
    args.previous.privyUserId !== null &&
    args.previous.privyUserId === args.next.privyUserId;
  const rising = !hadSession && hasSession && sawSignOut;
  const switchedPerson =
    hadSession &&
    hasSession &&
    !samePrivy &&
    (args.previous.sessionAddress !== args.next.sessionAddress ||
      args.previous.sessionType !== args.next.sessionType);
  if (rising || switchedPerson) {
    return { sawSignOut: false, drain: true };
  }
  return { sawSignOut, drain: false };
}
