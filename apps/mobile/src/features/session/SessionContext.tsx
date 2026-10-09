import { mwaRuntimeTransact } from '@/src/features/connect/mwaRuntime';
import { resolveConnectEnabled } from '@/src/lib/apiConfig';
import { MWA_IDENTITY, validMwaIdentity } from '@/src/features/connect/connectFlow';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform, View, type AppStateStatus } from 'react-native';
import {
  usePrivy,
  usePrivyClient,
  useEmbeddedSolanaWallet,
  isConnected,
} from '@privy-io/expo';
import {
  bootPerUserReadsMayOpen,
  pendingSignOutClearBeforePerUserReads,
  releasePerUserReadsForIncomingSession,
  retryIncomingClearWhileClosed,
  shouldDrainArmedIncomingClear,
  stepPendingClearTransition,
} from '@/src/features/session/pendingSignOutClear';
import type { CorsoSession, ConnectedStatus } from '@/src/features/session/types';
import {
  PRIVY_EMBEDDED_CAPABILITIES,
  IMPORTED_SEED_CAPABILITIES,
  connectedAppLockEnabled,
  mapMwaConnectSessionToCorsoSession,
  resolveExclusiveCorsoSession,
  sessionStateFromConnectedRestore,
} from '@/src/features/session/types';
import { disconnectMwa, restoreMwaWhenAvailable } from '@/src/features/connect/mwaClient';
import { mwaSessionStore } from '@/src/features/connect/mwaSessionStore';
import {
  type MwaConnectSession,
} from '@/src/features/connect/mwaTypes';
import {
  getAppLockPreference,
  hasAppLockPasscode,
  hasBiometricHardware,
  promptAppUnlock,
  setAppLockPasscode,
  setAppLockPreference,
  verifyAppLockPasscode,
  clearAppLockPreference,
  clearImportedRestingPasscode,
  copyAppLockPasscodeToImportedResting,
  type AppLockPreference,
} from '@/src/features/security/appLock';
import { importedMnemonicStore } from '@/src/features/session/importedMnemonicStore';
import { eraseImportedWordsAndVerify } from '@/src/features/session/eraseImportedWords';
import {
  importedRestingStore,
  shouldRestoreImported,
} from '@/src/features/session/importedResting';
import {
  resumeImportedRestingWords,
  type ImportedRestingResumeResult,
} from '@/src/features/session/importedRestingResume';
import { StepUpRequiredError } from '@/src/features/security/mfaGateCore';
import {
  advanceUserActivityClock,
  BOOT_SPLASH_TIMEOUT_MS,
  decideFreshInstall,
  DEFAULT_FOREGROUND_IDLE_LOCK_MS,
  resolveBootTimeoutCommit,
  resolvePrivyRestoreState,
  resolveColdBootLock,
  loadImportedAddress,
  resolveAllowPrivySession,
  shouldLockForIdle,
  shouldRetrySessionRestore,
  type LiveLockStateCell,
  type PrivySessionPolicy,
  type PrivyRestoreState,
} from '@/src/features/session/sessionGate';
import {
  readResumeClock,
  shouldConcealForAppState,
  stepResumeGrace,
  type AwayMark,
} from '@/src/features/lock/resumeGrace';
import { CorsoPrivyStorage } from '@/src/features/security/privyStorage';
import { readStoredPrivySession } from '@/src/features/security/storedPrivySession';
import { colors } from '@/constants/theme';

const HAS_LAUNCHED_KEY = 'hasLaunchedBefore';
const IDLE_LOCK_TICK_MS = 5_000;

const UNAVAILABLE_MSG =
  "We can't run the security check right now, so this transaction is on hold. Try again in a moment.";

function throwUnavailable(): never {
  throw new StepUpRequiredError('unavailable', UNAVAILABLE_MSG);
}

/**
 * Opaque provenance-bearing money-signer gate capability.
 * Plain shape-matched objects are not authority — only the Session root
 * installer can create a capability that passes runtime checks.
 */
export type MoneySignerGateCells = {
  readonly liveLockCell: LiveLockStateCell;
  readonly liveSessionCell: LiveSessionCell;
};

/**
 * Mutable live-session cell — mirrors `useRef` updated on every
 * SessionContext / useActiveSigner render.
 */
export type LiveSessionCell = {
  current: { type: string; address: string } | null | undefined;
};

export function createLiveSessionCell(
  initial: { type: string; address: string } | null | undefined = null,
): LiveSessionCell {
  return { current: initial };
}

type GateProvenance = {
  liveSessionCell: LiveSessionCell;
  liveLockCell: LiveLockStateCell;
};

type RootInstallArgs = {
  liveSessionCell: LiveSessionCell;
  liveLockCell: LiveLockStateCell;
  /** Exact current active root, or null when no root is installed yet. */
  previous: MoneySignerGateCells | null;
};

type RootAuthority = {
  install: (args: RootInstallArgs) => MoneySignerGateCells;
  requireCells: (
    cells: MoneySignerGateCells | null | undefined,
  ) => asserts cells is MoneySignerGateCells;
  isActiveRoot: (cells: MoneySignerGateCells | null | undefined) => boolean;
  revokeActive: () => void;
  releaseForOwnerUnmount: (ownedRoot: MoneySignerGateCells | null) => void;
  ownsPendingInstallFence: (ownedRoot: MoneySignerGateCells | null) => boolean;
};

/** Bumped on explicit connect/disconnect so stale boot restore cannot overwrite. */
let connectedLifecycleEpoch = 0;

function bumpConnectedLifecycleEpoch(): number {
  connectedLifecycleEpoch += 1;
  return connectedLifecycleEpoch;
}

function isStaleConnectedLifecycle(capturedEpoch: number): boolean {
  return capturedEpoch !== connectedLifecycleEpoch;
}

const rootAuthority: RootAuthority = (() => {
  const mintedGateCapabilities = new WeakSet<object>();
  const revokedGateCapabilities = new WeakSet<object>();
  const gateProvenance = new WeakMap<object, GateProvenance>();
  let activeRootCapability: MoneySignerGateCells | null = null;
  /** One-shot fence: the exact root revoked synchronously before async clear cleanup. */
  let pendingInstallPredecessor: MoneySignerGateCells | null = null;

  function install(args: RootInstallArgs): MoneySignerGateCells {
    if (
      args.liveSessionCell == null ||
      args.liveLockCell == null ||
      typeof args.liveSessionCell !== 'object' ||
      typeof args.liveLockCell !== 'object' ||
      !('current' in args.liveSessionCell) ||
      !('current' in args.liveLockCell)
    ) {
      throwUnavailable();
    }
    // Hostile registration without the Session-held previous capability fails closed.
    // Pending fence (post-revoke, pre-remint): accept ONLY the exact predecessor.
    // Null or unrelated previous must fail. First install (no fence) requires previous null.
    if (activeRootCapability == null) {
      if (pendingInstallPredecessor != null) {
        if (args.previous !== pendingInstallPredecessor) {
          throwUnavailable();
        }
      } else if (args.previous != null) {
        throwUnavailable();
      }
    } else if (args.previous !== activeRootCapability) {
      throwUnavailable();
    }
    if (activeRootCapability) {
      revokedGateCapabilities.add(activeRootCapability);
      activeRootCapability = null;
    }
    const cells = Object.freeze({
      liveSessionCell: args.liveSessionCell,
      liveLockCell: args.liveLockCell,
    });
    mintedGateCapabilities.add(cells);
    gateProvenance.set(cells, {
      liveSessionCell: args.liveSessionCell,
      liveLockCell: args.liveLockCell,
    });
    activeRootCapability = cells;
    pendingInstallPredecessor = null;
    return cells;
  }

  function requireCells(
    cells: MoneySignerGateCells | null | undefined,
  ): asserts cells is MoneySignerGateCells {
    if (cells == null || typeof cells !== 'object') {
      throwUnavailable();
    }
    if (activeRootCapability == null || cells !== activeRootCapability) {
      throwUnavailable();
    }
    if (!mintedGateCapabilities.has(cells)) {
      throwUnavailable();
    }
    if (revokedGateCapabilities.has(cells)) {
      throwUnavailable();
    }
    const provenance = gateProvenance.get(cells);
    if (!provenance) {
      throwUnavailable();
    }
    if (
      cells.liveSessionCell == null ||
      cells.liveLockCell == null ||
      typeof cells.liveSessionCell !== 'object' ||
      typeof cells.liveLockCell !== 'object' ||
      !('current' in cells.liveSessionCell) ||
      !('current' in cells.liveLockCell)
    ) {
      throwUnavailable();
    }
    if (
      cells.liveSessionCell !== provenance.liveSessionCell ||
      cells.liveLockCell !== provenance.liveLockCell
    ) {
      throwUnavailable();
    }
  }

  function isActiveRoot(
    cells: MoneySignerGateCells | null | undefined,
  ): boolean {
    return (
      cells != null &&
      activeRootCapability != null &&
      cells === activeRootCapability &&
      mintedGateCapabilities.has(cells) &&
      !revokedGateCapabilities.has(cells)
    );
  }

  function revokeActive(): void {
    if (activeRootCapability) {
      pendingInstallPredecessor = activeRootCapability;
      revokedGateCapabilities.add(activeRootCapability);
      activeRootCapability = null;
    }
  }

  function releaseForOwnerUnmount(ownedRoot: MoneySignerGateCells | null): void {
    if (ownedRoot == null) {
      return;
    }
    if (activeRootCapability === ownedRoot) {
      pendingInstallPredecessor = activeRootCapability;
      revokedGateCapabilities.add(ownedRoot);
      activeRootCapability = null;
      return;
    }
    if (pendingInstallPredecessor === ownedRoot) {
      pendingInstallPredecessor = null;
    }
  }

  function ownsPendingInstallFence(
    ownedRoot: MoneySignerGateCells | null,
  ): boolean {
    return ownedRoot != null && pendingInstallPredecessor === ownedRoot;
  }

  return {
    install,
    requireCells,
    isActiveRoot,
    revokeActive,
    releaseForOwnerUnmount,
    ownsPendingInstallFence,
  };
})();

/** True when `cells` is the sole currently installed Session root capability. */
export function isActiveSessionMoneySignerGateRoot(
  cells: MoneySignerGateCells | null | undefined,
): boolean {
  return rootAuthority.isActiveRoot(cells);
}

/**
 * Runtime assert: value-moving boundaries require the sole installed Session
 * root capability. Independent, copied, forged, stale, superseded, or partial
 * cells fail closed before any sign, broadcast, MFA, or API execute.
 */
export function requireMoneySignerGateCells(
  cells: MoneySignerGateCells | null | undefined,
): asserts cells is MoneySignerGateCells {
  rootAuthority.requireCells(cells);
}

function useSessionMoneySignerGateRoot(args: {
  liveSessionCell: LiveSessionCell;
  liveLockCell: LiveLockStateCell;
  sessionIdentityKey: string;
}): {
  cells: MoneySignerGateCells;
  status: 'ready' | 'step_up_required';
  retry: () => void;
} {
  const moneySignerGateRef = useRef<MoneySignerGateCells | null>(null);
  const unavailableGateRef = useRef<MoneySignerGateCells | null>(null);
  if (unavailableGateRef.current == null) {
    // Deliberately not minted by rootAuthority. If React renders a replacement
    // provider while the prior owner is still committed, consumers may render
    // an honest hold but every money boundary rejects this placeholder.
    unavailableGateRef.current = Object.freeze({
      liveSessionCell: args.liveSessionCell,
      liveLockCell: args.liveLockCell,
    });
  }
  const gateIdentityRef = useRef<string | null>(null);
  const ownedRootRef = moneySignerGateRef;
  const [, setGateRootEpoch] = useState(0);
  const retry = useCallback(() => {
    setGateRootEpoch((epoch) => epoch + 1);
  }, []);
  if (
    moneySignerGateRef.current != null &&
    !rootAuthority.isActiveRoot(moneySignerGateRef.current) &&
    !rootAuthority.ownsPendingInstallFence(moneySignerGateRef.current)
  ) {
    moneySignerGateRef.current = null;
  }
  if (
    moneySignerGateRef.current == null ||
    gateIdentityRef.current !== args.sessionIdentityKey
  ) {
    try {
      moneySignerGateRef.current = rootAuthority.install({
        liveSessionCell: args.liveSessionCell,
        liveLockCell: args.liveLockCell,
        previous: moneySignerGateRef.current,
      });
      gateIdentityRef.current = args.sessionIdentityKey;
    } catch (error) {
      if (
        !(error instanceof StepUpRequiredError) ||
        error.code !== 'unavailable'
      ) {
        throw error;
      }
      // Never let an authority-availability refusal escape render and destroy
      // the React tree. Leave the ref empty so the next legitimate render
      // retries installation after the prior owner's commit cleanup.
      moneySignerGateRef.current = null;
      gateIdentityRef.current = null;
    }
  }
  useEffect(() => {
    const owned = ownedRootRef.current;
    if (
      owned != null &&
      !rootAuthority.isActiveRoot(owned) &&
      rootAuthority.ownsPendingInstallFence(owned)
    ) {
      try {
        moneySignerGateRef.current = rootAuthority.install({
          liveSessionCell: args.liveSessionCell,
          liveLockCell: args.liveLockCell,
          previous: owned,
        });
        setGateRootEpoch((epoch) => epoch + 1);
      } catch (error) {
        if (
          !(error instanceof StepUpRequiredError) ||
          error.code !== 'unavailable'
        ) {
          throw error;
        }
        moneySignerGateRef.current = null;
        gateIdentityRef.current = null;
        setGateRootEpoch((epoch) => epoch + 1);
      }
    }

    return () => {
      const ownedAtCleanup = ownedRootRef.current;
      const hadActiveOwned =
        ownedAtCleanup != null && rootAuthority.isActiveRoot(ownedAtCleanup);
      rootAuthority.releaseForOwnerUnmount(ownedAtCleanup);
      if (hadActiveOwned && ownedAtCleanup != null) {
        const cleanupPredecessor = ownedAtCleanup;
        queueMicrotask(() => {
          if (rootAuthority.ownsPendingInstallFence(cleanupPredecessor)) {
            rootAuthority.releaseForOwnerUnmount(cleanupPredecessor);
          }
        });
      }
    };
    // Cells are stable SessionProvider refs; owner scope is one-shot per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- strict replay remint
  }, []);
  const cells = moneySignerGateRef.current ?? unavailableGateRef.current;
  return {
    cells,
    status: rootAuthority.isActiveRoot(cells)
      ? 'ready'
      : 'step_up_required',
    retry,
  };
}

type SessionPhase = 'booting' | 'ready';
export type AppUnlockResult = 'unlocked' | 'passcode_required';
type ImportedWalletPersistedPresence = 'unknown' | 'absent' | 'present';

export function resolveHasImportedWalletOnPhone(
  input: Readonly<{
    importedAddress: string | null;
    persistedPresence: ImportedWalletPersistedPresence;
  }>,
): boolean {
  return input.importedAddress !== null || input.persistedPresence !== 'absent';
}

type SessionContextValue = {
  phase: SessionPhase;
  session: CorsoSession | null;
  needsLockSetup: boolean;
  locked: boolean;
  /** Resolved app-lock policy used to keep the unlock CTA truthful. */
  lockPreference: AppLockPreference;
  /** Synchronous lock truth for stale async money callbacks. */
  lockStateCell: LiveLockStateCell;
  /** Root live-session cell — updated every render before money callbacks run. */
  liveSessionCell: LiveSessionCell;
  /**
   * Opaque provenance-bearing money-signer gate capability.
   * Value-moving paths must pass this object; plain forged cells reject.
   */
  moneySignerGateCells: MoneySignerGateCells;
  /** Whether the Session-owned signing root is usable by money entry points. */
  moneySignerGateStatus: 'ready' | 'step_up_required';
  /** Re-attempt Session-owned root installation without bypassing provenance. */
  retryMoneySignerGate: () => void;
  privyReady: boolean;
  privyRestoreState: PrivyRestoreState;
  retrySessionRestore: () => void;
  unlockSession: () => Promise<AppUnlockResult>;
  lockSession: () => void;
  unlockWithPasscode: (passcode: string) => Promise<boolean>;
  markLockSetupComplete: (
    method: Exclude<AppLockPreference, null>,
    passcode?: string,
  ) => Promise<void>;
  clearLocalSession: () => void;
  resetSessionLocalState: (options?: {
    restImportedSession?: boolean;
  }) => Promise<void>;
  setImportedSession: (address: string | null) => void;
  resumeImportedSession: (
    passcode: string,
  ) => Promise<ImportedRestingResumeResult>;
  clearImportedSession: () => Promise<void>;
  eraseImportedWordsFromPhone: () => Promise<void>;
  /** Includes a live imported wallet hidden under a connected active wallet. */
  hasImportedWalletOnPhone: boolean;
  connectedStatus: ConnectedStatus;
  setConnectedSession: (input: {
    dto: MwaConnectSession;
    walletName: string | null;
  }) => void;
  markConnectedDegraded: () => void;
  clearConnectedSession: () => Promise<void>;
  /**
   * Activity signal for idle lock. Root touch capture calls this; affected
   * TextInputs call it explicitly because soft-keyboard edits may not bubble.
   */
  noteUserActivity: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/** Privy + device-local imported-address session. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { user, isReady, logout } = usePrivy();
  const privyClient = usePrivyClient();
  const solanaWallet = useEmbeddedSolanaWallet();
  const [phase, setPhase] = useState<SessionPhase>('booting');
  const [perUserReadsOpen, setPerUserReadsOpen] = useState(false);
  const [drainGeneration, setDrainGeneration] = useState(0);
  const incomingClearRef = useRef(false);
  const incomingClearForegroundRef = useRef<() => void>(() => {});
  const [clearTrack, setClearTrack] = useState<{
    ready: boolean;
    sawSignOut: boolean;
    privyUserId: string | null;
    sessionType: string | null;
    sessionAddress: string | null;
  }>({
    ready: false,
    sawSignOut: false,
    privyUserId: null,
    sessionType: null,
    sessionAddress: null,
  });
  const [lockPref, setLockPref] = useState<AppLockPreference>(null);
  const [freshInstallHandled, setFreshInstallHandled] = useState(false);
  const [privySessionPolicy, setPrivySessionPolicy] =
    useState<PrivySessionPolicy>('deny');
  const [importedAddress, setImportedAddress] = useState<string | null>(null);
  // Unknown fails closed for Remove copy: name the phrase until boot proves
  // that neither a live import nor the device-only resting marker exists.
  const [importedWalletPersistedPresence, setImportedWalletPersistedPresence] =
    useState<ImportedWalletPersistedPresence>('unknown');
  const [activeConnectedSession, setActiveConnectedSession] =
    useState<CorsoSession | null>(null);
  const [connectedStatus, setConnectedStatus] =
    useState<ConnectedStatus>('none');
  const [locked, setLocked] = useState(true);
  const lockStateCell = useRef<LiveLockStateCell>({ current: true }).current;
  const liveSessionCell = useRef<LiveSessionCell>({ current: null }).current;
  const lastActiveMsRef = useRef<number>(Date.now());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const resumeAwayRef = useRef<AwayMark>(null);
  /** Away from the foreground, the canvas covers the session (app switcher). */
  const [concealed, setConcealed] = useState(false);
  const bootRunIdRef = useRef(0);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [storedPrivySession, setStoredPrivySession] = useState<boolean | null>(
    null,
  );
  const bootTimedOutRef = useRef(false);
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  const commitLocked = useCallback((nextLocked: boolean) => {
    lockStateCell.current = nextLocked;
    setLocked(nextLocked);
  }, [lockStateCell]);

  const noteUserActivity = useCallback(() => {
    lastActiveMsRef.current = advanceUserActivityClock(
      lastActiveMsRef.current,
      Date.now(),
    );
  }, []);

  // After forced logout, once live user is actually null, promote to `open`
  // so a later fresh login can materialize (stale-user window is closed).
  useEffect(() => {
    if (privySessionPolicy === 'wait_user_null' && !user) {
      setPrivySessionPolicy('open');
    }
  }, [privySessionPolicy, user]);

  // Recompute allowPrivySession whenever live user or policy changes.
  // After forced logout: wait_user_null + stale user → false until user is null.
  const allowPrivySession = useMemo(
    () =>
      resolveAllowPrivySession({
        policy: privySessionPolicy,
        livePrivyUserPresent: Boolean(user),
      }),
    [privySessionPolicy, user],
  );

  useEffect(() => {
    let cancelled = false;
    void bootPerUserReadsMayOpen().then((open) => {
      if (!cancelled && !open) {
        incomingClearRef.current = true;
        setDrainGeneration((generation) => generation + 1);
        return;
      }
      if (!cancelled && !incomingClearRef.current) setPerUserReadsOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (drainGeneration === 0) return;
    let cancelled = false;
    void releasePerUserReadsForIncomingSession().then((open) => {
      if (!cancelled && open) setPerUserReadsOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [drainGeneration]);

  useEffect(() => {
    if (drainGeneration === 0 || perUserReadsOpen) return;
    let cancelled = false;
    const stop = retryIncomingClearWhileClosed({
      onOpen: () => {
        if (!cancelled) setPerUserReadsOpen(true);
      },
      subscribeAppState: (onForeground) => {
        incomingClearForegroundRef.current = () => {
          void onForeground();
        };
        return () => {
          incomingClearForegroundRef.current = () => {};
        };
      },
      schedule: (run, delayMs) => {
        const handle = setTimeout(() => {
          void run();
        }, delayMs);
        return () => clearTimeout(handle);
      },
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [drainGeneration, perUserReadsOpen]);

  useEffect(() => {
    if (!isReady || freshInstallHandled) return;
    const bootRunId = ++bootRunIdRef.current;
    let cancelled = false;
    (async () => {
      const bootLifecycleEpoch = connectedLifecycleEpoch;
      const abortIfSuperseded = (): boolean =>
        cancelled ||
        bootRunId !== bootRunIdRef.current ||
        isStaleConnectedLifecycle(bootLifecycleEpoch);
      const finalizeWithoutConnectedApply = (): void => {
        if (cancelled || bootRunId !== bootRunIdRef.current) return;
        setFreshInstallHandled(true);
        setPhase('ready');
      };
      await pendingSignOutClearBeforePerUserReads();
      if (abortIfSuperseded()) {
        finalizeWithoutConnectedApply();
        return;
      }
      let hasLaunchedBefore: boolean | null = null;
      try {
        const raw = await AsyncStorage.getItem(HAS_LAUNCHED_KEY);
        hasLaunchedBefore = raw != null && raw !== '';
      } catch {
        hasLaunchedBefore = null;
      }
      if (abortIfSuperseded()) {
        finalizeWithoutConnectedApply();
        return;
      }

      // Capture user presence once at gate start (stale snapshot is intentional).
      const capturedPrivyUser = Boolean(user);
      let decision = decideFreshInstall({
        hasLaunchedBefore,
        hasPrivyUser: capturedPrivyUser,
      });

      if (decision.action === 'logout_required' && capturedPrivyUser) {
        let logoutResult: 'success' | 'failed' = 'failed';
        try {
          await logoutRef.current();
          logoutResult = 'success';
        } catch {
          logoutResult = 'failed';
        }
        if (abortIfSuperseded()) {
          finalizeWithoutConnectedApply();
          return;
        }
        // Re-decide with logout outcome. Policy becomes wait_user_null on success —
        // never open against the captured pre-logout user object.
        decision = decideFreshInstall({
          hasLaunchedBefore,
          hasPrivyUser: true,
          logoutResult,
        });
      }

      if (decision.markLaunched) {
        try {
          await AsyncStorage.setItem(HAS_LAUNCHED_KEY, 'true');
        } catch {
          if (decision.action !== 'block' && capturedPrivyUser) {
            decision = {
              action: 'block',
              reason: 'storage_untrusted',
              markLaunched: false,
              privySessionPolicy: 'deny',
            };
          }
        }
        if (abortIfSuperseded()) {
          finalizeWithoutConnectedApply();
          return;
        }
      }

      if (abortIfSuperseded()) {
        finalizeWithoutConnectedApply();
        return;
      }

      if (!bootTimedOutRef.current) {
        setPrivySessionPolicy(decision.privySessionPolicy);
      }
      setConnectedStatus('restoring');

      try {
        const [pref, restoredImported, restoreResult] = await Promise.all([
          getAppLockPreference(),
          (async () => {
            const resting = await importedRestingStore.load();
            if (resting) {
              return {
                address: null,
                persistedPresence: 'present' as const,
              };
            }
            const address = await loadImportedAddress(importedMnemonicStore);
            return {
              address: shouldRestoreImported({
                hasWords: address !== null,
                resting,
              })
                ? address
                : null,
              persistedPresence:
                address === null ? ('absent' as const) : ('present' as const),
            };
          })(),
          restoreMwaWhenAvailable({
            transact: mwaRuntimeTransact,
            store: mwaSessionStore,
            identity: MWA_IDENTITY,
            chain: 'solana:mainnet',
            availability: async () => ({
              connectEnabled: await resolveConnectEnabled(),
              platformOS: Platform.OS,
              flavor: (await import('expo-constants')).default.expoConfig?.extra?.flavor,
              identityConfigured: validMwaIdentity(MWA_IDENTITY),
            }),
          }),
        ]);
        if (abortIfSuperseded()) {
          finalizeWithoutConnectedApply();
          return;
        }
        const storedAfterRestore =
          restoreResult.state === 'none' ? null : await mwaSessionStore.load();
        if (abortIfSuperseded()) {
          finalizeWithoutConnectedApply();
          return;
        }
        const applied = sessionStateFromConnectedRestore(
          restoreResult.state === 'none'
            ? { state: 'none' }
            : restoreResult.state === 'ready'
              ? {
                  state: 'ready',
                  session: restoreResult.result.session,
                  walletName: storedAfterRestore?.walletName ?? null,
                }
              : {
                  state: 'degraded',
                  session: restoreResult.session,
                  walletName: storedAfterRestore?.walletName ?? null,
                },
          { appLockEnabled: connectedAppLockEnabled(pref) },
        );
        setActiveConnectedSession(applied.session);
        setConnectedStatus(applied.connectedStatus);
        setLockPref(pref);
        setImportedAddress((prev) => restoredImported.address ?? prev);
        setImportedWalletPersistedPresence(restoredImported.persistedPresence);
        // Close the cold-start gate from persisted policy, before a late Privy
        // wallet/session can materialize. Session routing ignores this bit while
        // signed out, so no-session Welcome remains unchanged.
        commitLocked(
          resolveColdBootLock({
            lockPreference: pref,
            privySessionPolicy: decision.privySessionPolicy,
          }),
        );
        setPrivySessionPolicy(decision.privySessionPolicy);
        setFreshInstallHandled(true);
        setPhase('ready');
      } catch {
        if (abortIfSuperseded()) {
          finalizeWithoutConnectedApply();
          return;
        }
        setPrivySessionPolicy('deny');
        setActiveConnectedSession(null);
        setConnectedStatus('none');
        setImportedWalletPersistedPresence('unknown');
        commitLocked(true);
        setFreshInstallHandled(true);
        setPhase('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally omit `user` from deps: re-running the gate on user clear
    // would race wait_user_null. Live user is observed via resolveAllowPrivySession.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot gate
  }, [isReady, freshInstallHandled, bootAttempt, commitLocked]);

  useEffect(() => {
    if (phase !== 'booting') return;
    const timer = setTimeout(() => {
      bootTimedOutRef.current = true;
      const commit = resolveBootTimeoutCommit();
      setPrivySessionPolicy(commit.privySessionPolicy);
      setActiveConnectedSession(commit.activeConnectedSession);
      setConnectedStatus(commit.connectedStatus);
      commitLocked(commit.locked);
      setPhase(commit.phase);
    }, BOOT_SPLASH_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [phase, commitLocked]);

  useEffect(() => {
    let cancelled = false;
    void readStoredPrivySession(CorsoPrivyStorage).then((present) => {
      if (!cancelled) setStoredPrivySession(present);
    });
    return () => {
      cancelled = true;
    };
  }, [isReady, user?.id, phase]);

  const session = useMemo<CorsoSession | null>(() => {
    const imported: CorsoSession | null = importedAddress
      ? {
          type: 'imported_seed',
          address: importedAddress,
          capabilities: IMPORTED_SEED_CAPABILITIES,
          appLockEnabled: true,
        }
      : null;
    let privy: CorsoSession | null = null;
    // #9: never materialize Keychain-restored / stale Privy until policy + live user allow it.
    if (allowPrivySession && user && isConnected(solanaWallet)) {
      const wallet = solanaWallet.wallets[0];
      if (wallet?.address) {
        privy = {
          type: 'privy_embedded',
          address: wallet.address,
          privyUserId: user.id,
          privyWalletId: String(wallet.walletIndex),
          capabilities: PRIVY_EMBEDDED_CAPABILITIES,
          appLockEnabled: lockPref === 'biometric' || lockPref === 'passcode',
        };
      }
    }
    return resolveExclusiveCorsoSession({
      connected: activeConnectedSession,
      connectedStatus,
      imported,
      privy,
    });
  }, [
    importedAddress,
    user,
    solanaWallet,
    lockPref,
    allowPrivySession,
    activeConnectedSession,
    connectedStatus,
  ]);

  const incomingSnapshot = {
    privyUserId: user?.id ?? null,
    sessionType: session?.type ?? null,
    sessionAddress: session?.address ?? null,
  };
  if (freshInstallHandled) {
    if (!clearTrack.ready) {
      setClearTrack({
        ready: true,
        sawSignOut: false,
        privyUserId: incomingSnapshot.privyUserId,
        sessionType: incomingSnapshot.sessionType,
        sessionAddress: incomingSnapshot.sessionAddress,
      });
    } else if (
      clearTrack.privyUserId !== incomingSnapshot.privyUserId ||
      clearTrack.sessionType !== incomingSnapshot.sessionType ||
      clearTrack.sessionAddress !== incomingSnapshot.sessionAddress
    ) {
      const stepped = stepPendingClearTransition({
        sawSignOut: clearTrack.sawSignOut,
        previous: {
          privyUserId: clearTrack.privyUserId,
          sessionType: clearTrack.sessionType,
          sessionAddress: clearTrack.sessionAddress,
        },
        next: incomingSnapshot,
      });
      setClearTrack({
        ready: true,
        sawSignOut: stepped.sawSignOut,
        privyUserId: incomingSnapshot.privyUserId,
        sessionType: incomingSnapshot.sessionType,
        sessionAddress: incomingSnapshot.sessionAddress,
      });
      if (shouldDrainArmedIncomingClear(stepped)) {
        incomingClearRef.current = true;
        setDrainGeneration((generation) => generation + 1);
        setPerUserReadsOpen(false);
      }
    }
  }

  const privyRestoreState = resolvePrivyRestoreState({
    hasPrivyUser: Boolean(user),
    allowPrivySession,
    hasSession: Boolean(session),
    walletStatus: solanaWallet.status,
    storedPrivySession,
  });

  const restorePendingRef = useRef(false);
  restorePendingRef.current = privyRestoreState === 'pending';
  const restoreReadInFlightRef = useRef(false);
  const restoreMountedRef = useRef(true);
  useEffect(() => {
    restoreMountedRef.current = true;
    return () => { restoreMountedRef.current = false; };
  }, []);
  const rereadPendingSession = useCallback(async () => {
    if (!restorePendingRef.current || restoreReadInFlightRef.current) return;
    restoreReadInFlightRef.current = true;
    const epoch = connectedLifecycleEpoch;
    try {
      await privyClient.user.get();
    } catch {
      // Offline remains held; only the SDK may invalidate its stored token.
    } finally {
      const present = await readStoredPrivySession(CorsoPrivyStorage);
      if (restoreMountedRef.current && restorePendingRef.current &&
          !isStaleConnectedLifecycle(epoch)) setStoredPrivySession(present);
      restoreReadInFlightRef.current = false;
    }
  }, [privyClient]);
  useEffect(() => {
    if (privyRestoreState !== 'pending') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(async () => {
        await rereadPendingSession();
        if (!cancelled) schedule();
      }, 5_000);
    };
    schedule();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [privyRestoreState, rereadPendingSession]);

  // Pre-effect live identity write — stale money callbacks read the latest session.
  liveSessionCell.current = session;

  const sessionIdentityKey = session
    ? `${session.type}:${session.address}`
    : 'none';
  const moneySignerGateRoot = useSessionMoneySignerGateRoot({
    liveSessionCell,
    liveLockCell: lockStateCell,
    sessionIdentityKey,
  });
  const moneySignerGateCells = moneySignerGateRoot.cells;
  const moneySignerGateStatus = moneySignerGateRoot.status;
  const retryMoneySignerGate = moneySignerGateRoot.retry;

  const needsLockSetup =
    Boolean(session) &&
    lockPref === null &&
    freshInstallHandled;

  // Background lock + activity-backed foreground idle lock (#9).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') incomingClearForegroundRef.current();
      appStateRef.current = nextState;
      const step = stepResumeGrace({
        away: resumeAwayRef.current,
        nextState,
        lockPreference: lockPref,
        now: readResumeClock(),
      });
      resumeAwayRef.current = step.away;
      // The gate closes before the cover lifts, so no frame shows the session.
      if (step.lock) commitLocked(true);
      setConcealed(
        shouldConcealForAppState({ nextState, lockPreference: lockPref }),
      );
    });

    const tick = setInterval(() => {
      if (
        shouldLockForIdle({
          nowMs: Date.now(),
          lastActiveMs: lastActiveMsRef.current,
          idleTimeoutMs: DEFAULT_FOREGROUND_IDLE_LOCK_MS,
          hasSession: Boolean(session),
          lockPreference: lockPref,
          appState: appStateRef.current,
        })
      ) {
        commitLocked(true);
      }
    }, IDLE_LOCK_TICK_MS);

    return () => {
      subscription.remove();
      clearInterval(tick);
    };
  }, [session, lockPref, commitLocked]);

  const markLockSetupComplete = useCallback(
    async (method: Exclude<AppLockPreference, null>, passcode?: string) => {
      if (method === 'biometric' || method === 'passcode') {
        if (passcode !== undefined) {
          await setAppLockPasscode(passcode);
        } else if (!(await hasAppLockPasscode())) {
          throw new Error('app_lock_passcode_required');
        }
      }
      await setAppLockPreference(method);
      setLockPref(method);
      noteUserActivity();
      commitLocked(false);
    },
    [noteUserActivity, commitLocked],
  );

  const clearLocalSession = useCallback(() => {}, []);

  const resetSessionLocalState = useCallback(async (options?: {
    restImportedSession?: boolean;
  }) => {
    if (options?.restImportedSession && importedAddress !== null) {
      await copyAppLockPasscodeToImportedResting();
      await importedRestingStore.mark();
      setImportedWalletPersistedPresence('present');
    }
    await clearAppLockPreference();
    setImportedAddress(null);
    setLockPref(null);
    commitLocked(false);
  }, [importedAddress, commitLocked]);

  const setImportedSession = useCallback((address: string | null) => {
    void (async () => {
      await clearImportedRestingPasscode();
      await importedRestingStore.clear();
    })().catch(() => {
      // A failed clear is safe: the marker keeps the next boot signed out.
    });
    setImportedAddress(address);
    if (address !== null) setImportedWalletPersistedPresence('present');
    commitLocked(false);
  }, [commitLocked]);

  const eraseImportedWordsFromPhone = useCallback(async () => {
    await eraseImportedWordsAndVerify({
      remove: () => importedMnemonicStore.remove(),
      loadRemainingAddress: () => loadImportedAddress(importedMnemonicStore),
    });
    setImportedAddress(null);
    setImportedWalletPersistedPresence('absent');
    commitLocked(false);
  }, [commitLocked]);

  const clearImportedSession = useCallback(async () => {
    await eraseImportedWordsFromPhone();
    await clearImportedRestingPasscode();
    await importedRestingStore.clear();
  }, [eraseImportedWordsFromPhone]);

  const resumeImportedSession = useCallback(
    async (passcode: string): Promise<ImportedRestingResumeResult> => {
      const result = await resumeImportedRestingWords({ passcode });
      if (result.status === 'resumed') {
        setImportedAddress(result.address);
        setImportedWalletPersistedPresence('present');
        setLockPref('passcode');
        commitLocked(false);
      } else if (result.status === 'missing_words') {
        setImportedAddress(null);
        setImportedWalletPersistedPresence('absent');
      }
      return result;
    },
    [commitLocked],
  );

  const setConnectedSession = useCallback(
    (input: { dto: MwaConnectSession; walletName: string | null }) => {
      bumpConnectedLifecycleEpoch();
      setActiveConnectedSession(
        mapMwaConnectSessionToCorsoSession(input.dto, {
          walletName: input.walletName,
          appLockEnabled: connectedAppLockEnabled(lockPref),
        }),
      );
      setConnectedStatus('ready');
    },
    [lockPref],
  );

  const markConnectedDegraded = useCallback(() => {
    setConnectedStatus((status) => (status === 'none' ? 'none' : 'degraded'));
  }, []);

  const clearConnectedSession = useCallback(async () => {
    bumpConnectedLifecycleEpoch();
    liveSessionCell.current = null;
    rootAuthority.revokeActive();
    setActiveConnectedSession(null);
    setConnectedStatus('none');
    await disconnectMwa({
      transact: mwaRuntimeTransact,
      store: mwaSessionStore,
    });
  }, [liveSessionCell]);

  const unlockSession = useCallback(async () => {
    const preference = await getAppLockPreference();
    if (preference === 'biometric' && (await hasBiometricHardware())) {
      const result = await promptAppUnlock();
      if (result.success) {
        // AMBER — a verified unlock resets the resume grace window.
        resumeAwayRef.current = null;
        noteUserActivity();
        commitLocked(false);
        return 'unlocked';
      }
    }
    return 'passcode_required';
  }, [noteUserActivity, commitLocked]);

  const lockSession = useCallback(() => {
    commitLocked(true);
  }, [commitLocked]);

  const unlockWithPasscode = useCallback(async (passcode: string) => {
    const success = await verifyAppLockPasscode(passcode);
    if (success) {
      // AMBER — a verified unlock resets the resume grace window.
      resumeAwayRef.current = null;
      noteUserActivity();
      commitLocked(false);
    }
    return success;
  }, [noteUserActivity, commitLocked]);

  const retrySessionRestore = useCallback(() => {
    void rereadPendingSession();
    if (!shouldRetrySessionRestore({ phase, freshInstallHandled })) return;
    setBootAttempt((attempt) => attempt + 1);
  }, [phase, freshInstallHandled, rereadPendingSession]);

  const value = useMemo(
    () => ({
      phase,
      session,
      needsLockSetup,
      locked,
      lockPreference: lockPref,
      lockStateCell,
      liveSessionCell,
      moneySignerGateCells,
      moneySignerGateStatus,
      retryMoneySignerGate,
      privyReady: isReady,
      privyRestoreState,
      retrySessionRestore,
      unlockSession,
      lockSession,
      unlockWithPasscode,
      markLockSetupComplete,
      clearLocalSession,
      resetSessionLocalState,
      setImportedSession,
      resumeImportedSession,
      clearImportedSession,
      eraseImportedWordsFromPhone,
      hasImportedWalletOnPhone: resolveHasImportedWalletOnPhone({
        importedAddress,
        persistedPresence: importedWalletPersistedPresence,
      }),
      connectedStatus,
      setConnectedSession,
      markConnectedDegraded,
      clearConnectedSession,
      noteUserActivity,
    }),
    [
      phase,
      session,
      needsLockSetup,
      locked,
      lockPref,
      lockStateCell,
      liveSessionCell,
      moneySignerGateCells,
      moneySignerGateStatus,
      retryMoneySignerGate,
      isReady,
      privyRestoreState,
      retrySessionRestore,
      unlockSession,
      lockSession,
      unlockWithPasscode,
      markLockSetupComplete,
      clearLocalSession,
      resetSessionLocalState,
      setImportedSession,
      resumeImportedSession,
      clearImportedSession,
      eraseImportedWordsFromPhone,
      importedAddress,
      importedWalletPersistedPresence,
      connectedStatus,
      setConnectedSession,
      markConnectedDegraded,
      clearConnectedSession,
      noteUserActivity,
    ],
  );

  // Central touch capture refreshes idle clock. Soft-keyboard edits do not have
  // a proven cross-platform bubble path, so affected TextInputs also signal
  // activity explicitly through noteTextInputActivity.
  const onStartShouldSetResponderCapture = useCallback(() => {
    noteUserActivity();
    return false;
  }, [noteUserActivity]);

  return (
    <SessionContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        collapsable={false}
        onStartShouldSetResponderCapture={onStartShouldSetResponderCapture}
        onTouchStart={noteUserActivity}
      >
        {perUserReadsOpen ? children : null}
        {concealed ? (
          <View
            pointerEvents="none"
            testID="app-privacy-cover"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: colors.canvas,
            }}
          />
        ) : null}
      </View>
    </SessionContext.Provider>
  );
}

export function useCorsoSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useCorsoSession must be used within SessionProvider');
  }
  return ctx;
}
