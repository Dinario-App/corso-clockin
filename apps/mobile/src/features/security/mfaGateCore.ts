/**
 * MFA step-up gate core — no React Native imports (unit-testable in Node).
 * RN AppState wiring lives in mfaGate.ts.
 *
 * Cache is strictly session-keyed: every lookup/mark requires the active
 * session identity. Missing identity → fail closed (not cached).
 * Mid-verify session switch: re-check active key before mark / allow.
 */
import type { CorsoSession } from '@/src/features/session/types';
import {
  resolveStepUpPolicy,
  type StepUpPolicy,
} from '@/src/lib/apiConfig';
import {
  resolveStepUpPath,
  STEP_UP_VERIFY_TIMEOUT_MS,
  withBoundedTimeout,
} from '@/src/features/security/mfaGateLogic';
import { mayCompleteVerifyForSession } from '@/src/features/security/mfaSessionGuard';

export type StepUpSurface = 'swap' | 'send';

export class StepUpRequiredError extends Error {
  readonly code:
    | 'cancelled'
    | 'unavailable'
    | 'failed'
    | 'timeout'
    | 'no_app_lock'
    | 'blocked_session_type';

  constructor(
    code: StepUpRequiredError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'StepUpRequiredError';
    this.code = code;
  }
}

let verifiedSessionKey: string | null = null;
/** App-lock approval for local/external sessions; never shared with provider MFA. */
let appLockVerifiedSessionKey: string | null = null;
/** Optional provider MFA clear (useMfa().clear) registered from React. */
let providerMfaClear: ProviderMfaClear | null = null;
/** Called when cache clears so RN layer can re-bind listeners if needed. */
let onCacheCleared: (() => void) | null = null;
/** Last active session key observed for switch detection. */
let lastActiveSessionKey: string | null = null;

/**
 * useMfa().clear is async (`clear(): Promise<void>`). It must be typed as such
 * or its rejection is discarded and lands as an unhandled promise rejection.
 */
export type ProviderMfaClear = () => void | PromiseLike<void>;

/**
 * Outcome of the *provider-side* clear only. The local cache is cleared
 * synchronously and unconditionally before the provider is ever called, so
 * neither failure outcome ever means the local gate stayed open.
 *
 * - 'confirmed'   — the provider answered. Its cached MFA token is gone.
 * - 'deferred'    — the provider did not answer, and a foreground retry is
 *                   armed to try again. Divergence exists but is recoverable,
 *                   so this is NOT the anomaly signal and must not be emitted
 *                   as one.
 * - 'unconfirmed' — terminal. The divergence was not repaired: no retry was
 *                   armed, or the retry chain ran out. This is the measured
 *                   event, at most once per background cycle.
 */
export type ProviderMfaClearOutcome = 'confirmed' | 'deferred' | 'unconfirmed';

let providerMfaClearObserver:
  | ((outcome: ProviderMfaClearOutcome) => void)
  | null = null;
/** Count of clears whose provider side never confirmed. Process-lifetime. */
let providerMfaClearUnconfirmed = 0;

/**
 * True when a provider clear has been attempted and has not confirmed, so the
 * provider may still be holding a cached MFA token that Corso believes is gone.
 *
 * This is the whole point of the workstream. Privy's `clear()` is an RPC into
 * the embedded-wallet WebView, and the SDK marks that WebView not-ready in the
 * same AppState frame Corso calls `clear()` in
 * (`a === 'background' ? e.embeddedWallet.onBackground() : ...`), so the call
 * can never be answered and Privy's own 15s timer always wins. The token then
 * survives its full dashboard TTL, which silently reverts Corso from
 * session-scoped MFA to Privy's stock cache default for every operation Corso
 * does not gate itself — principally sub-threshold sends, which aggregate.
 */
let providerStateStale = false;
/**
 * At most one terminal 'unconfirmed' per background cycle. Reset at the
 * background edge, not on the stale transition: a provider that is broken for
 * many cycles running must still emit once per cycle, or the anomaly signal
 * silently under-reports exactly when it matters most.
 */
let terminalDivergenceReported = false;
/** In-flight provider clear, so background / retry / gate never stack calls. */
let providerClearInFlight: Promise<boolean> | null = null;
/** True once an AppState-driven foreground retry exists to catch a failure. */
let foregroundRetryArmed = false;
/** Guards the retry chain against a second AppState listener re-entering it. */
let foregroundRetryRunning = false;

export function sessionCacheKey(session: CorsoSession): string {
  return `${session.type}:${session.address}`;
}

/**
 * Record whether the provider-side clear completed. Observation only — it
 * never changes what is cleared and never rethrows into the clear path.
 */
function reportProviderMfaClear(outcome: ProviderMfaClearOutcome): void {
  if (outcome === 'unconfirmed') {
    providerMfaClearUnconfirmed += 1;
  }
  try {
    providerMfaClearObserver?.(outcome);
  } catch {
    // Observability must never break the clear path.
  }
}

/** Emit the terminal divergence signal at most once per background cycle. */
function reportTerminalDivergence(): void {
  if (terminalDivergenceReported) return;
  terminalDivergenceReported = true;
  reportProviderMfaClear('unconfirmed');
}

/**
 * Run the provider clear once and record whether it answered. Never reports a
 * failure outcome — the caller owns that, because only the caller knows whether
 * another attempt is still coming. Never rejects.
 */
function attemptProviderMfaClear(): Promise<boolean> {
  if (providerClearInFlight) return providerClearInFlight;
  const fn = providerMfaClear;
  if (!fn) return Promise.resolve(false);

  const settle = (confirmed: boolean): boolean => {
    providerClearInFlight = null;
    if (confirmed) {
      providerStateStale = false;
      reportProviderMfaClear('confirmed');
      return true;
    }
    providerStateStale = true;
    return false;
  };

  let result: void | PromiseLike<void>;
  try {
    result = fn();
  } catch {
    // Synchronous throw from the provider clear. Local cache already cleared.
    return Promise.resolve(settle(false));
  }
  if (!isPromiseLike(result)) {
    return Promise.resolve(settle(true));
  }
  // The provider clear is async and can reject long after this frame — most
  // reliably when the app backgrounds, because the provider marks its
  // embedded-wallet transport not-ready at the same moment and the call times
  // out. A synchronous catch cannot see that rejection, so attach a real
  // handler here. Both arms settle, so nothing is left unhandled.
  providerClearInFlight = Promise.resolve(result).then(
    () => settle(true),
    () => settle(false),
  );
  return providerClearInFlight;
}

function clearLocalAndProviderCache(): void {
  verifiedSessionKey = null;
  appLockVerifiedSessionKey = null;
  // Drop bound identity with the verify cache so a later op re-binds cleanly.
  // bindActiveStepUpSession re-sets lastActive after calling clear on switch.
  lastActiveSessionKey = null;
  if (providerMfaClear) {
    // A new background cycle gets its own terminal event budget.
    terminalDivergenceReported = false;
    void attemptProviderMfaClear().then((confirmed) => {
      if (confirmed) return;
      // Armed means an AppState foreground branch will try again once the
      // WebView is answerable, so the divergence is recoverable, not terminal.
      if (foregroundRetryArmed) {
        reportProviderMfaClear('deferred');
        return;
      }
      reportTerminalDivergence();
    });
  }
  try {
    onCacheCleared?.();
  } catch {
    // ignore
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<void>).then === 'function'
  );
}

/** Register Privy useMfa().clear (or equivalent). Pass null on unmount. */
export function registerProviderMfaClear(fn: ProviderMfaClear | null): void {
  providerMfaClear = fn;
}

/**
 * Observe provider-clear outcomes. The callback receives an outcome only —
 * never a session key, address, token, factor or provider error text.
 */
export function registerProviderMfaClearObserver(
  fn: ((outcome: ProviderMfaClearOutcome) => void) | null,
): void {
  providerMfaClearObserver = fn;
}

export function getUnconfirmedProviderMfaClearCount(): number {
  return providerMfaClearUnconfirmed;
}

export function resetUnconfirmedProviderMfaClearCount(): void {
  providerMfaClearUnconfirmed = 0;
  providerStateStale = false;
  terminalDivergenceReported = false;
  providerClearInFlight = null;
  foregroundRetryArmed = false;
  foregroundRetryRunning = false;
}

/**
 * True when the provider may still hold an MFA token Corso already treats as
 * cleared. Read by the RN layer and by the gate interlock below.
 */
export function isProviderMfaStateStale(): boolean {
  return providerStateStale;
}

/**
 * Declare that an AppState foreground branch exists and will call
 * retryProviderMfaClearOnForeground. Armed from the RN layer only, so pure-Node
 * callers with no retry keep reporting a failed clear as terminal.
 */
export function setProviderMfaClearRetryArmed(armed: boolean): void {
  foregroundRetryArmed = armed;
}

export const FOREGROUND_CLEAR_RETRY_DELAYS_MS: readonly number[] = [
  750, 2_500, 6_000,
];

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryProviderMfaClearOnForeground(opts?: {
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Abort the chain if the app left the foreground again mid-retry. */
  isForeground?: () => boolean;
}): Promise<ProviderMfaClearOutcome> {
  if (providerClearInFlight) {
    await providerClearInFlight;
  }
  if (!providerStateStale || !providerMfaClear) return 'confirmed';
  // Both AppState listeners fire — the module-level one is the safety net for
  // when the root listener is unmounted. They are deliberately NOT deduplicated
  // at the listener, so the second entrant is absorbed here instead.
  if (foregroundRetryRunning) return 'deferred';
  foregroundRetryRunning = true;
  const delays = opts?.delaysMs ?? FOREGROUND_CLEAR_RETRY_DELAYS_MS;
  const sleep = opts?.sleep ?? defaultSleep;
  const stillForeground = opts?.isForeground ?? (() => true);
  try {
    for (const delay of delays) {
      await sleep(delay);
      if (!providerStateStale) return 'confirmed';
      // Backgrounded again mid-chain. The next foreground gets its own chain;
      // giving up here is not a terminal failure and must not be reported one.
      if (!stillForeground()) return 'deferred';
      if (await attemptProviderMfaClear()) return 'confirmed';
    }
    reportTerminalDivergence();
    return 'unconfirmed';
  } finally {
    foregroundRetryRunning = false;
  }
}

export const PROVIDER_STATE_RECONCILE_TIMEOUT_MS = 2_500;

export async function reconcileProviderMfaState(args?: {
  timeoutMs?: number;
}): Promise<ProviderMfaClearOutcome> {
  if (!providerStateStale || !providerMfaClear) return 'confirmed';
  try {
    await withBoundedTimeout(
      attemptProviderMfaClear(),
      args?.timeoutMs ?? PROVIDER_STATE_RECONCILE_TIMEOUT_MS,
      () => new Error('provider mfa reconcile timed out'),
    );
  } catch {
    // Bounded on purpose. Never block a signature on the provider answering.
  }
  if (!providerStateStale) return 'confirmed';
  reportTerminalDivergence();
  return 'unconfirmed';
}

/** Optional hook for AppState integration. */
export function registerStepUpCacheClearedHook(fn: (() => void) | null): void {
  onCacheCleared = fn;
}

export function clearStepUpCache(): void {
  clearLocalAndProviderCache();
}

/**
 * Mark step-up verified for this session only.
 * Session identity is required — never accept anonymous / missing session.
 */
export function markStepUpVerified(session: CorsoSession): void {
  verifiedSessionKey = sessionCacheKey(session);
  lastActiveSessionKey = verifiedSessionKey;
}

/**
 * Cache hit only when the *same* session identity was verified.
 * No session → always false (fail closed). Never allow cross-wallet reuse.
 */
export function isStepUpCached(
  session: CorsoSession | null | undefined,
): boolean {
  if (!session) return false;
  const key = sessionCacheKey(session);
  return session.type === 'imported_seed' ||
    session.type === 'connected_external'
    ? appLockVerifiedSessionKey === key
    : verifiedSessionKey === key;
}

/**
 * Bind / observe the active session. Clears cache on identity switch or logout.
 * Call from root whenever session address/type changes (and on unmount with null).
 */
export function bindActiveStepUpSession(
  session: CorsoSession | null | undefined,
): void {
  if (!session) {
    if (
      lastActiveSessionKey !== null ||
      verifiedSessionKey !== null ||
      appLockVerifiedSessionKey !== null
    ) {
      clearLocalAndProviderCache();
    }
    lastActiveSessionKey = null;
    return;
  }
  const key = sessionCacheKey(session);
  if (lastActiveSessionKey !== null && lastActiveSessionKey !== key) {
    clearLocalAndProviderCache();
  }
  lastActiveSessionKey = key;
}

export function getActiveStepUpSessionKey(): string | null {
  return lastActiveSessionKey;
}

/**
 * @throws StepUpRequiredError when step-up is required and not completed
 */
export async function assertMfaForHighValue(args: {
  session: CorsoSession;
  notionalSol: number | null;
  surface: StepUpSurface;
  policy?: StepUpPolicy;
  /** Optional Privy verify callback — returns true when provider MFA succeeds */
  verifyPrivyMfa?: () => Promise<boolean>;
  /** Optional imported-wallet app-lock callback. */
  verifyAppLock?: () => Promise<boolean>;
  /** Live session identity after the app-lock prompt completes. */
  getLiveSessionKey?: () => string | null;
  verifyTimeoutMs?: number;
  reconcileTimeoutMs?: number;
}): Promise<void> {
  await reconcileProviderMfaState(
    args.reconcileTimeoutMs === undefined
      ? undefined
      : { timeoutMs: args.reconcileTimeoutMs },
  );

  const policy = args.policy ?? (await resolveStepUpPolicy());
  const path = resolveStepUpPath({
    session: args.session,
    notionalSol: args.notionalSol,
    policy,
    cached: isStepUpCached(args.session),
  });

  if (path === 'skip' || path === 'cached') return;

  if (path === 'privy') {
    if (!args.verifyPrivyMfa) {
      throw new StepUpRequiredError(
        'unavailable',
        "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
      );
    }
    // Snapshot the session key at gate entry — must still match after verify.
    const startedKey = sessionCacheKey(args.session);
    // Bind this op's session when unbound. If already bound to a *different*
    // identity, fail closed (do not step-up a non-active wallet).
    if (lastActiveSessionKey === null) {
      lastActiveSessionKey = startedKey;
    } else if (lastActiveSessionKey !== startedKey) {
      clearStepUpCache();
      throw new StepUpRequiredError(
        'unavailable',
        "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
      );
    }
    const timeoutMs = args.verifyTimeoutMs ?? STEP_UP_VERIFY_TIMEOUT_MS;
    try {
      const ok = await withBoundedTimeout(
        args.verifyPrivyMfa(),
        timeoutMs,
        () =>
          new StepUpRequiredError(
            'timeout',
            "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
          ),
      );
      if (!ok) {
        throw new StepUpRequiredError(
          'failed',
          "That didn't verify. Try again.",
        );
      }
      // Re-check identity before marking — hostile session switch mid-verify.
      if (!args.session?.address) {
        clearStepUpCache();
        throw new StepUpRequiredError(
          'unavailable',
          "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
        );
      }
      if (
        !mayCompleteVerifyForSession({
          startedSessionKey: startedKey,
          activeSessionKey: lastActiveSessionKey,
        })
      ) {
        clearStepUpCache();
        throw new StepUpRequiredError(
          'unavailable',
          "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
        );
      }
      // Active key must still be the same session we started with.
      if (sessionCacheKey(args.session) !== startedKey) {
        clearStepUpCache();
        throw new StepUpRequiredError(
          'unavailable',
          "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
        );
      }
      markStepUpVerified(args.session);
      return;
    } catch (error) {
      if (error instanceof StepUpRequiredError) throw error;
      throw new StepUpRequiredError(
        'unavailable',
        "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
      );
    }
  }

  if (path === 'app_lock') {
    if (!args.verifyAppLock || !args.getLiveSessionKey) {
      throw new StepUpRequiredError(
        'unavailable',
        "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
      );
    }
    const startedKey = sessionCacheKey(args.session);
    if (lastActiveSessionKey === null) {
      lastActiveSessionKey = startedKey;
    } else if (lastActiveSessionKey !== startedKey) {
      clearStepUpCache();
      throw new StepUpRequiredError(
        'unavailable',
        "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
      );
    }
    const timeoutMs = args.verifyTimeoutMs ?? STEP_UP_VERIFY_TIMEOUT_MS;
    try {
      const ok = await withBoundedTimeout(
        args.verifyAppLock(),
        timeoutMs,
        () =>
          new StepUpRequiredError(
            'timeout',
            "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
          ),
      );
      if (!ok) {
        throw new StepUpRequiredError(
          'failed',
          "That didn't verify. Try again.",
        );
      }
      const liveKey = args.getLiveSessionKey();
      if (
        liveKey !== startedKey ||
        (lastActiveSessionKey !== null && lastActiveSessionKey !== startedKey)
      ) {
        clearStepUpCache();
        throw new StepUpRequiredError(
          'unavailable',
          "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
        );
      }
      // AppState may clear the bound key while a native biometric prompt is
      // active. A still-live matching session may freshly re-bind and mark.
      lastActiveSessionKey = startedKey;
      appLockVerifiedSessionKey = startedKey;
      return;
    } catch (error) {
      if (error instanceof StepUpRequiredError) throw error;
      throw new StepUpRequiredError(
        'unavailable',
        "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
      );
    }
  }

  // Unknown future wallet types stay fail-closed.
  throw new StepUpRequiredError(
    'blocked_session_type',
    "This wallet type can't approve large transactions in this build yet.",
  );
}
