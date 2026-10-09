import type { ImportedMnemonicStore } from '@corso/wallet';
import type { AppLockPreference } from '@/src/features/security/appLock';

export type SessionDestination =
  | 'welcome'
  | 'lock-setup'
  | 'unlock'
  | 'home'
  | 'restoring'
  | 'resume';

export type PrivyRestoreState = 'absent' | 'pending' | 'needs-attention';

export type SessionGateState = {
  hasSession: boolean;
  needsLockSetup: boolean;
  locked: boolean;
  /**
   * Required — never defaulted. A silently omitted value would re-collapse
   * the unknown into "signed out", which is the whole defect.
   */
  restoreState: PrivyRestoreState;
};

export function getSessionDestination({
  hasSession,
  needsLockSetup,
  locked,
  restoreState,
}: SessionGateState): SessionDestination {
  if (!hasSession) {
    if (restoreState === 'pending') return 'restoring';
    if (restoreState === 'needs-attention') return 'resume';
    return 'welcome';
  }
  if (needsLockSetup) return 'lock-setup';
  if (locked) return 'unlock';
  return 'home';
}

export const BOOT_SPLASH_TIMEOUT_MS = 8_000;

/** Destinations a hung boot may land on. Never Home, never a restoring hold. */
export const BOOT_TIMEOUT_DESTINATIONS = [
  'welcome',
  'unlock',
  'lock-setup',
] as const;

export type BootTimeoutDestination = (typeof BOOT_TIMEOUT_DESTINATIONS)[number];

export type BootTimeoutCommit = {
  phase: 'ready';
  privySessionPolicy: 'deny';
  connectedStatus: 'none';
  locked: true;
  activeConnectedSession: null;
};

export function resolveBootTimeoutCommit(): BootTimeoutCommit {
  return {
    phase: 'ready',
    privySessionPolicy: 'deny',
    connectedStatus: 'none',
    locked: true,
    activeConnectedSession: null,
  };
}

export function getSessionDestinationAfterBootTimeout(): SessionDestination {
  const commit = resolveBootTimeoutCommit();
  return getSessionDestination({
    hasSession: false,
    needsLockSetup: false,
    locked: commit.locked,
    restoreState: 'absent',
  });
}

export function shouldRetrySessionRestore(args: {
  phase: 'booting' | 'ready';
  freshInstallHandled: boolean;
}): boolean {
  return args.phase === 'ready' && !args.freshInstallHandled;
}

const WALLET_NEEDS_ATTENTION: ReadonlySet<string> = new Set([
  'error',
  'needs-recovery',
  'not-created',
]);

export function resolvePrivyRestoreState(args: {
  /** Live Privy user present. A genuinely signed-out user has none. */
  hasPrivyUser: boolean;
  allowPrivySession: boolean;
  /** A session already resolved (Privy, imported, or connected). */
  hasSession: boolean;
  /** `useEmbeddedSolanaWallet().status`. */
  walletStatus: string;
  storedPrivySession?: boolean | null;
}): PrivyRestoreState {
  if (args.hasSession) return 'absent';
  // No live identity. A stored refresh token, or a read that has not settled,
  // is still a restore — Welcome would be the signed-out door.
  if (!args.hasPrivyUser) {
    if (args.storedPrivySession === true || args.storedPrivySession === null) {
      return 'pending';
    }
    return 'absent';
  }
  if (!args.allowPrivySession) return 'absent';
  if (WALLET_NEEDS_ATTENTION.has(args.walletStatus)) return 'needs-attention';
  return 'pending';
}

export type WalletErrorRecovery = 'redrive' | 'surface';

export function resolveWalletErrorRecovery(args: {
  /** No identity means nothing to reconnect to. */
  hasPrivyUser: boolean;
  /** Has an automatic re-drive already been spent this mount? */
  redriveAttempted: boolean;
}): WalletErrorRecovery {
  if (!args.hasPrivyUser) return 'surface';
  if (args.redriveAttempted) return 'surface';
  return 'redrive';
}

export function shouldAnnounceOnboardingStart(args: {
  phase: 'booting' | 'ready';
  gate: SessionGateState;
}): boolean {
  if (args.phase !== 'ready') return false;
  return getSessionDestination(args.gate) === 'welcome';
}

function lockEnabled(lockPreference: AppLockPreference): boolean {
  return lockPreference === 'biometric' || lockPreference === 'passcode';
}

/**
 * Process-cold lock decision, made as soon as the persisted preference resolves.
 *
 * A restored Privy identity/wallet can materialize after the boot storage reads.
 * Waiting for that session before closing the lock leaves a frame where the
 * later session inherits `locked=false` and routes directly to Home. The route
 * gate already ignores `locked` while no session exists, so closing early is
 * both fail-closed and invisible to a genuinely signed-out user.
 */
export function resolveColdBootLock(args: {
  lockPreference: AppLockPreference;
  privySessionPolicy: PrivySessionPolicy;
}): boolean {
  if (args.privySessionPolicy !== 'open') return true;
  return lockEnabled(args.lockPreference);
}

export function shouldLockForAppState({
  nextState,
  lockPreference,
}: {
  nextState: string;
  lockPreference: AppLockPreference;
}): boolean {
  return nextState !== 'active' && lockEnabled(lockPreference);
}

export const DEFAULT_FOREGROUND_IDLE_LOCK_MS = 90_000;

export function shouldLockForIdle({
  nowMs,
  lastActiveMs,
  idleTimeoutMs = DEFAULT_FOREGROUND_IDLE_LOCK_MS,
  hasSession,
  lockPreference,
  appState,
}: {
  nowMs: number;
  lastActiveMs: number;
  idleTimeoutMs?: number;
  hasSession: boolean;
  lockPreference: AppLockPreference;
  /** Only evaluate idle while the app is foreground-active. */
  appState: string;
}): boolean {
  if (appState !== 'active') return false;
  if (!hasSession || !lockEnabled(lockPreference)) return false;
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastActiveMs)) return false;
  if (idleTimeoutMs <= 0) return true; // fail-closed: non-positive timeout locks
  return nowMs - lastActiveMs >= idleTimeoutMs;
}

/**
 * Pure activity clock used by the idle lock.
 * Call on touch / unlock / explicit screen signals — never only on mount.
 */
export function advanceUserActivityClock(
  previousLastActiveMs: number,
  nowMs: number,
): number {
  if (!Number.isFinite(nowMs)) return previousLastActiveMs;
  if (!Number.isFinite(previousLastActiveMs)) return nowMs;
  return nowMs >= previousLastActiveMs ? nowMs : previousLastActiveMs;
}

/**
 * Soft-keyboard edits are not guaranteed to bubble through the root touch
 * responder. Money/auth input surfaces call this explicitly on text changes.
 */
export function noteTextInputActivity(
  text: string,
  noteActivity: () => void,
  applyText: (value: string) => void,
): void {
  noteActivity();
  applyText(text);
}

export type LiveLockStateCell = { current: boolean };

export type SensitiveRouteLockAction =
  | 'render'
  | 'conceal'
  | 'unlock'
  | 'lock-setup';

function isSensitiveRootRoute(pathname: string): boolean {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (
    normalized === '/money' ||
    normalized === '/swap' ||
    normalized === '/send' ||
    normalized === '/receive' ||
    normalized === '/buy' ||
    normalized === '/add-cash' ||
    normalized === '/ask' ||
    normalized === '/sleeve' ||
    normalized === '/bots' ||
    normalized === '/bots/new'
  ) {
    return true;
  }
  if (/^\/onboarding\/(name|how|fund)$/.test(normalized)) return true;
  if (/^\/asset\/[^/]+$/.test(normalized)) return true;
  if (/^\/skills\/configure\/[^/]+$/.test(normalized)) return true;
  if (/^\/skills\/[^/]+$/.test(normalized)) return true;
  return /^\/activity\/[^/]+$/.test(normalized);
}

/**
 * File segments from expo-router `useSegments()`: groups kept, dynamic
 * segments kept as `[param]`, index omitted (`['bots']` for bots/index).
 * A decoded `%2F` splits the pathname and must not split this template.
 * `bots/[botId]` is not a pathname pattern: `^/bots/[^/]+$` also matches
 * `bots/revoke`.
 */
function isRouteGroup(segment: string): boolean {
  return (
    segment.length >= 2 &&
    segment.charCodeAt(0) === 40 &&
    segment.charCodeAt(segment.length - 1) === 41
  );
}

function routeTemplate(segments: readonly string[]): string {
  const visible: string[] = [];
  for (const segment of segments) {
    if (isRouteGroup(segment)) continue;
    visible.push(segment);
  }
  if (visible.length > 1 && visible[visible.length - 1] === 'index') {
    visible.pop();
  }
  const slash = String.fromCharCode(47);
  let template = slash.slice(1);
  for (const segment of visible) template += slash + segment;
  return template.length === 0 ? slash : template;
}

function isSensitiveRouteTemplate(segments: readonly string[]): boolean {
  const template = routeTemplate(segments);
  if (
    template === '/money' ||
    template === '/swap' ||
    template === '/send' ||
    template === '/receive' ||
    template === '/buy' ||
    template === '/add-cash' ||
    template === '/ask' ||
    template === '/sleeve' ||
    template === '/bots' ||
    template === '/bots/new' ||
    template === '/asset/[mint]' ||
    template === '/activity/[signature]' ||
    template === '/bots/[botId]' ||
    template === '/skills/[skillId]' ||
    template === '/skills/configure/[skillId]'
  ) {
    return true;
  }
  return /^\/onboarding\/(name|how|fund)$/.test(template);
}

export function getSensitiveRouteLockAction(args: {
  pathname: string;
  segments?: readonly string[];
  phase: 'booting' | 'ready';
  locked: boolean;
  needsLockSetup?: boolean;
}): SensitiveRouteLockAction {
  const sensitive =
    args.segments !== undefined
      ? isSensitiveRouteTemplate(args.segments)
      : isSensitiveRootRoute(args.pathname);
  if (!sensitive) return 'render';
  if (args.phase === 'booting') return 'conceal';
  if (args.needsLockSetup) return 'lock-setup';
  if (args.locked) return 'unlock';
  return 'render';
}

export type PrivySessionPolicy = 'open' | 'wait_user_null' | 'deny';

export type FreshInstallDecision =
  | {
      action: 'continue';
      markLaunched: boolean;
      privySessionPolicy: 'open' | 'wait_user_null';
    }
  | {
      action: 'logout_required';
      markLaunched: false;
      privySessionPolicy: 'deny';
    }
  | {
      action: 'block';
      reason: 'logout_failed' | 'storage_untrusted';
      markLaunched: boolean;
      privySessionPolicy: 'deny';
    };

export function decideFreshInstall(args: {
  /** true / false from AsyncStorage; null when the read failed. */
  hasLaunchedBefore: boolean | null;
  hasPrivyUser: boolean;
  /** Set after attempting logout when required. */
  logoutResult?: 'success' | 'failed' | 'not_attempted';
}): FreshInstallDecision {
  const logoutResult = args.logoutResult ?? 'not_attempted';

  // Untrusted storage: cannot prove this is not a reinstall with Keychain residue.
  if (args.hasLaunchedBefore === null) {
    if (args.hasPrivyUser) {
      if (logoutResult === 'success') {
        return {
          action: 'continue',
          markLaunched: true,
          privySessionPolicy: 'wait_user_null',
        };
      }
      if (logoutResult === 'failed') {
        return {
          action: 'block',
          reason: 'logout_failed',
          markLaunched: false,
          privySessionPolicy: 'deny',
        };
      }
      return {
        action: 'logout_required',
        markLaunched: false,
        privySessionPolicy: 'deny',
      };
    }
    return {
      action: 'continue',
      markLaunched: true,
      privySessionPolicy: 'open',
    };
  }

  if (args.hasLaunchedBefore === true) {
    return {
      action: 'continue',
      markLaunched: false,
      privySessionPolicy: 'open',
    };
  }

  // Fresh install (hasLaunchedBefore === false)
  if (!args.hasPrivyUser) {
    return {
      action: 'continue',
      markLaunched: true,
      privySessionPolicy: 'open',
    };
  }

  if (logoutResult === 'success') {
    // Hostile: stale user object after await logout() must not open a session.
    return {
      action: 'continue',
      markLaunched: true,
      privySessionPolicy: 'wait_user_null',
    };
  }
  if (logoutResult === 'failed') {
    return {
      action: 'block',
      reason: 'logout_failed',
      markLaunched: false,
      privySessionPolicy: 'deny',
    };
  }
  return {
    action: 'logout_required',
    markLaunched: false,
    privySessionPolicy: 'deny',
  };
}

/**
 * Resolve whether a Privy-backed CorsoSession may materialize right now.
 * After forced logout success, requires authoritative live user === null.
 */
export function resolveAllowPrivySession(args: {
  policy: PrivySessionPolicy;
  /** True when Privy hook still exposes a user (including stale post-logout). */
  livePrivyUserPresent: boolean;
}): boolean {
  if (args.policy === 'deny') return false;
  if (args.policy === 'wait_user_null') {
    // Only open the gate once the stale user has cleared — then fresh login is allowed.
    return !args.livePrivyUserPresent;
  }
  // open
  return true;
}

export async function loadImportedAddress(
  store: Pick<ImportedMnemonicStore, 'load'>,
): Promise<string | null> {
  const wallet = await store.load();
  if (wallet === null) return null;

  try {
    return wallet.address;
  } finally {
    wallet.secretKey.fill(0);
  }
}
