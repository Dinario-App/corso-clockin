import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/expo';
import { copy } from '@/constants/copy';
import type { CorsoSession } from '@/src/features/session/types';
import {
  assertMfaForHighValue,
  bindActiveStepUpSession,
  clearStepUpCache,
  isStepUpCached,
  markStepUpVerified,
  sessionCacheKey,
  StepUpRequiredError,
} from '@/src/features/security/mfaGate';
import {
  cancelPendingOnSessionKeyChange,
  decideLocalStepUpOwnerCompletion,
  sessionIdentityKey,
  type PendingMfaHandle,
} from '@/src/features/security/mfaSessionGuard';
import type { StepUpMode } from '@/src/features/security/StepUpSheet';
import {
  formatStepUpThreshold,
  isAboveStepUpThreshold,
} from '@/src/features/security/stepUpPolicy';
import { requirePrepareSessionStillLive } from '@/src/features/security/requireMoneySignerGate';
import {
  resolveStepUpPolicy,
  type StepUpPolicy,
} from '@/src/lib/apiConfig';
import { trackEvent } from '@/src/lib/analytics';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import {
  getAppLockPreference,
  hasAppLockPasscode,
  hasBiometricHardware,
  PasscodeBackoffError,
  promptAppUnlock,
  verifyAppLockPasscode,
} from '@/src/features/security/appLock';
import {
  afterBiometricStepUp,
  resolveRevealStepUpMethod,
} from '@/src/features/security/revealStepUp';

type LocalPending = PendingMfaHandle & {
  surface: 'swap' | 'send';
  /** Map resolve(void) → resolve(boolean) for verifyPrivyMfa callers. */
  resolveOk: (ok: boolean) => void;
};

/**
 * Step-up UX + verify callback for high-value Confirm paths.
 * Call `prepareStepUp` before submit; pass `verifyPrivyMfa` into getActiveSigner.
 * Threshold label starts empty until policy resolves — no UI 0.05 literal.
 * Cache lookups always require the active session identity.
 * **Live session identity during render is authoritative** before factor
 * completion, cache mark, pending resolve, signing, or broadcast — even when
 * prepare-bound sessionRef still holds A and the cancel effect has not flushed.
 * Provider MFA clear is owned by PrivyMfaRootListener (always mounted).
 */
export function useStepUpConfirm() {
  const { user } = usePrivy();
  const { session: liveSession } = useCorsoSession();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<StepUpMode>('verify');
  const [thresholdLabel, setThresholdLabel] = useState('');
  const [surface, setSurface] = useState<'swap' | 'send'>('swap');
  const [policy, setPolicy] = useState<StepUpPolicy | null>(null);
  /**
   * Bound prepare identity for StepUpSheet completion reporting only.
   * Must never win over liveSession for owner currentKey / mark / cache / sign.
   */
  const [activeSession, setActiveSession] = useState<CorsoSession | null>(null);
  const pendingRef = useRef<LocalPending | null>(null);
  const sessionRef = useRef<CorsoSession | null>(null);
  const thresholdLabelRef = useRef('');
  /** Live identity ref — updated every render (pre-effect), like root listener. */
  const liveSessionRef = useRef<CorsoSession | null>(liveSession);
  liveSessionRef.current = liveSession;
  const liveSessionKey = liveSession ? sessionCacheKey(liveSession) : null;

  const enrolled = (user?.mfa_methods?.length ?? 0) > 0;

  const refreshPolicy = useCallback(async () => {
    const next = await resolveStepUpPolicy();
    thresholdLabelRef.current = formatStepUpThreshold(next.stepUpThresholdSol);
    setPolicy(next);
    setThresholdLabel(thresholdLabelRef.current);
    return next;
  }, []);

  useEffect(() => {
    void refreshPolicy();
  }, [refreshPolicy]);

  // Cancel any in-flight local MFA when the live session identity changes (A→B).
  // Owner path does not wait on this effect — live identity is authoritative
  // during render for onVerified / verifyPrivyMfa (pre-effect safe).
  useEffect(() => {
    const nextKey = sessionIdentityKey(liveSession);
    const pending = pendingRef.current;
    if (!pending) return;
    const cleared = cancelPendingOnSessionKeyChange({
      pending: {
        sessionKey: pending.sessionKey,
        resolve: () => pending.resolveOk(true),
        reject: pending.reject,
      },
      nextSessionKey: nextKey,
      reason: 'MFA cancelled: active session changed during step-up',
    });
    if (!cleared) {
      pendingRef.current = null;
      setVisible(false);
    }
  }, [liveSessionKey, liveSession]);

  const showReviewNotice = useCallback(
    (notionalSol: number | null, p: StepUpPolicy | null) => {
      const active = p ?? policy;
      if (!active) return false;
      return isAboveStepUpThreshold(notionalSol, active);
    },
    [policy],
  );

  const verifyPrivyMfa = useCallback(async (): Promise<boolean> => {
    // Live render identity only — never sessionRef (may lag A after B switch).
    const active = liveSessionRef.current;
    const liveKey = sessionIdentityKey(active);

    const existing = pendingRef.current;
    if (existing && existing.sessionKey !== liveKey) {
      cancelPendingOnSessionKeyChange({
        pending: {
          sessionKey: existing.sessionKey,
          resolve: () => existing.resolveOk(true),
          reject: existing.reject,
        },
        nextSessionKey: liveKey,
        reason: 'MFA cancelled: active session changed during step-up',
      });
      pendingRef.current = null;
      setVisible(false);
    }

    // Identity required — never treat anonymous / missing session as cached.
    if (active && isStepUpCached(active)) return true;
    const key = liveKey;
    if (!key) {
      throw new StepUpRequiredError(
        'unavailable',
        "We can't run the security check right now, so this transaction is on hold. Try again in a moment.",
      );
    }
    return new Promise<boolean>((resolve, reject) => {
      pendingRef.current = {
        sessionKey: key,
        resolve: () => resolve(true),
        reject,
        resolveOk: (ok) => {
          if (ok) resolve(true);
          else {
            reject(
              new StepUpRequiredError(
                'cancelled',
                'Transaction not sent. Amounts at or above the security threshold need a second confirmation.',
              ),
            );
          }
        },
        surface,
      };
      setMode(enrolled ? 'verify' : 'enroll');
      setVisible(true);
    });
  }, [enrolled, surface]);

  const verifyAppLock = useCallback(async (): Promise<boolean> => {
    const active = liveSessionRef.current;
    const key = sessionIdentityKey(active);
    if (
      (active?.type !== 'imported_seed' &&
        active?.type !== 'connected_external') ||
      !key
    ) {
      throw new StepUpRequiredError('unavailable', copy.stepup.unavailable);
    }
    if (!(await hasAppLockPasscode())) {
      throw new StepUpRequiredError(
        'no_app_lock',
        copy.stepup.noAppLock(thresholdLabelRef.current),
      );
    }

    const preference = await getAppLockPreference();
    const biometricHardware = await hasBiometricHardware().catch(() => false);
    const method = resolveRevealStepUpMethod({
      preference,
      biometricHardware,
    });
    if (method === 'biometric') {
      const result = await promptAppUnlock().catch(() => null);
      if (afterBiometricStepUp(result?.success) === 'passed') return true;
    }

    if (sessionIdentityKey(liveSessionRef.current) !== key) {
      throw new StepUpRequiredError('unavailable', copy.stepup.unavailable);
    }
    return new Promise<boolean>((resolve, reject) => {
      pendingRef.current = {
        sessionKey: key,
        resolve: () => resolve(true),
        reject,
        resolveOk: (ok) => {
          if (ok) resolve(true);
          else {
            reject(
              new StepUpRequiredError(
                'cancelled',
                'Transaction not sent. Amounts at or above the security threshold need a second confirmation.',
              ),
            );
          }
        },
        surface,
      };
      setMode('app_lock');
      setVisible(true);
    });
  }, [surface]);

  const prepareStepUp = useCallback(
    async (args: {
      session: CorsoSession;
      notionalSol: number | null;
      surface: 'swap' | 'send';
    }) => {
      // Refuse prepare when bound session is not the live active identity.
      requirePrepareSessionStillLive({
        prepareSession: args.session,
        liveSession: liveSessionRef.current,
      });
      bindActiveStepUpSession(args.session);
      sessionRef.current = args.session;
      setActiveSession(args.session);
      const nextPolicy = await refreshPolicy();
      // Re-check live identity AFTER refreshPolicy await (A→B during fetch).
      // Stale prepare for A when live is already B must fail closed here.
      requirePrepareSessionStillLive({
        prepareSession: args.session,
        liveSession: liveSessionRef.current,
      });
      setSurface(args.surface);
      if (!isAboveStepUpThreshold(args.notionalSol, nextPolicy)) {
        return { needed: false as const, policy: nextPolicy };
      }
      trackEvent('stepup_required', {
        surface: args.surface,
        session_type: args.session.type,
        above_threshold: true,
      });

      if (args.session.type === 'privy_embedded') {
        // Sheet runs inside assertMfa via verifyPrivyMfa at signer boundary.
        return {
          needed: true as const,
          verifyPrivyMfa,
          thresholdLabel: formatStepUpThreshold(nextPolicy.stepUpThresholdSol),
          policy: nextPolicy,
        };
      }

      if (
        args.session.type === 'imported_seed' ||
        args.session.type === 'connected_external'
      ) {
        await assertMfaForHighValue({
          session: args.session,
          notionalSol: args.notionalSol,
          surface: args.surface,
          policy: nextPolicy,
          verifyAppLock,
          getLiveSessionKey: () => sessionIdentityKey(liveSessionRef.current),
        });
        return { needed: false as const, policy: nextPolicy };
      }

      // Unknown future wallet types fail closed inside the core gate.
      try {
        await assertMfaForHighValue({
          session: args.session,
          notionalSol: args.notionalSol,
          surface: args.surface,
          policy: nextPolicy,
        });
        return { needed: false as const, policy: nextPolicy };
      } catch (error) {
        if (error instanceof StepUpRequiredError) throw error;
        throw error;
      }
    },
    [refreshPolicy, verifyAppLock, verifyPrivyMfa],
  );

  /**
   * Owner-only mark path: sheet reports completed factor identity; we mark
   * only after atomic same-session check against **live** identity.
   * Late Wallet A after render already shows B (pre-effect) → reject + clear.
   */
  const onVerified = useCallback((completedSessionKey: string | null) => {
    setVisible(false);
    const pending = pendingRef.current;
    // Snapshot live first — authoritative even if sessionRef still holds A.
    const live = liveSessionRef.current;
    const bound = sessionRef.current;

    const decision = decideLocalStepUpOwnerCompletion({
      pending: pending
        ? {
            sessionKey: pending.sessionKey,
            resolve: () => pending.resolveOk(true),
            reject: pending.reject,
          }
        : null,
      completedSessionKey,
      liveSession: live,
      boundSession: bound,
    });
    pendingRef.current = null;

    if (decision.markSession) {
      markStepUpVerified(decision.markSession as CorsoSession);
      return;
    }

    if (decision.shouldClearCache) {
      clearStepUpCache();
    }
  }, []);

  const onCancel = useCallback(() => {
    setVisible(false);
    pendingRef.current?.resolveOk(false);
    pendingRef.current = null;
  }, []);

  const onAppLockPasscode = useCallback(
    async (passcode: string): Promise<'ok' | 'wrong' | 'error'> => {
      const pending = pendingRef.current;
      if (!pending) return 'error';
      if (sessionIdentityKey(liveSessionRef.current) !== pending.sessionKey) {
        pendingRef.current = null;
        setVisible(false);
        pending.reject(
          new StepUpRequiredError('unavailable', copy.stepup.unavailable),
        );
        return 'error';
      }
      try {
        if (!(await verifyAppLockPasscode(passcode))) return 'wrong';
        if (sessionIdentityKey(liveSessionRef.current) !== pending.sessionKey) {
          pendingRef.current = null;
          setVisible(false);
          pending.reject(
            new StepUpRequiredError('unavailable', copy.stepup.unavailable),
          );
          return 'error';
        }
        pendingRef.current = null;
        setVisible(false);
        pending.resolveOk(true);
        return 'ok';
      } catch (error) {
        if (error instanceof PasscodeBackoffError) throw error;
        return 'error';
      }
    },
    [],
  );

  return {
    sheet: {
      visible,
      mode,
      thresholdLabel,
      surface,
      // Sheet reports this identity on factor complete; owner re-checks live.
      session: activeSession,
      onVerified,
      onAppLockPasscode,
      onCancel,
    },
    policy,
    refreshPolicy,
    showReviewNotice,
    prepareStepUp,
    verifyPrivyMfa,
    bindSession: (s: CorsoSession | null) => {
      sessionRef.current = s;
      setActiveSession(s);
      bindActiveStepUpSession(s);
    },
  };
}
