import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import {
  useMfa,
  useRegisterMfaListener,
  type MfaMethod,
} from '@privy-io/expo';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import {
  bindActiveStepUpSession,
  clearStepUpCache,
  markStepUpVerified,
  registerProviderMfaClear,
  registerProviderMfaClearObserver,
  retryProviderMfaClearOnForeground,
  sessionCacheKey,
} from '@/src/features/security/mfaGate';
import {
  cancelPendingOnSessionKeyChange,
  ownerAcceptFactorCompletion,
  sessionIdentityKey,
  type PendingMfaHandle,
} from '@/src/features/security/mfaSessionGuard';
import { totpEnrollmentBuffer } from '@/src/features/security/totpEnrollmentBuffer';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { trackEvent } from '@/src/lib/analytics';
import { formatStepUpThreshold } from '@/src/features/security/stepUpPolicy';
import { resolveStepUpPolicy } from '@/src/lib/apiConfig';

export function PrivyMfaRootListener() {
  const { session } = useCorsoSession();
  const { clear: clearPrivyMfa, cancel } = useMfa();
  const [visible, setVisible] = useState(false);
  const [thresholdLabel, setThresholdLabel] = useState('');
  const [methods, setMethods] = useState<MfaMethod[]>([]);
  const pendingRef = useRef<PendingMfaHandle | null>(null);
  const sessionKey = session ? sessionCacheKey(session) : null;
  const sessionKeyRef = useRef<string | null>(sessionKey);
  sessionKeyRef.current = sessionKey;

  // Keep provider clear registered for AppState / session switch.
  // Return the promise. Discarding it dropped the rejection Privy raises when
  // the clear times out on background, which surfaced as an unhandled promise
  // rejection. mfaGateCore attaches the failure path and records the outcome.
  useEffect(() => {
    registerProviderMfaClear(() => clearPrivyMfa());
    // Outcome only. No session key, address, token, factor or provider error.
    registerProviderMfaClearObserver((outcome) => {
      if (outcome === 'unconfirmed') {
        trackEvent('stepup_provider_clear_unconfirmed');
      }
    });
    return () => {
      registerProviderMfaClear(null);
      registerProviderMfaClearObserver(null);
      clearStepUpCache();
      totpEnrollmentBuffer.clear();
      // Reject any in-flight root MFA wait so wallet actions cannot hang open.
      pendingRef.current = cancelPendingOnSessionKeyChange({
        pending: pendingRef.current,
        nextSessionKey: null,
        cancelProvider: () => cancel(),
        reason: 'MFA cancelled: root listener unmounted',
      });
      setVisible(false);
    };
  }, [clearPrivyMfa, cancel]);

  // Clear cache + reject pending when active session identity changes (A → B).
  useEffect(() => {
    bindActiveStepUpSession(session);
    pendingRef.current = cancelPendingOnSessionKeyChange({
      pending: pendingRef.current,
      nextSessionKey: sessionIdentityKey(session),
      cancelProvider: () => cancel(),
      reason: 'MFA cancelled: active session changed during step-up',
    });
    if (!pendingRef.current) {
      setVisible(false);
    }
  }, [sessionKey, session, cancel]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        clearStepUpCache();
        totpEnrollmentBuffer.clear();
        pendingRef.current = cancelPendingOnSessionKeyChange({
          pending: pendingRef.current,
          nextSessionKey: null,
          cancelProvider: () => cancel(),
          reason: 'MFA cancelled: app left foreground',
        });
        setVisible(false);
        return;
      }
      void retryProviderMfaClearOnForeground({
        isForeground: () => AppState.currentState === 'active',
      });
    });
    return () => sub.remove();
  }, [cancel]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const policy = await resolveStepUpPolicy();
        if (!cancelled) {
          setThresholdLabel(formatStepUpThreshold(policy.stepUpThresholdSol));
        }
      } catch {
        // label stays empty — no hardcoded 0.05
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Owner-only mark path: accept sheet factor completion only when the
   * completed key, pending start key, and live active key all match.
   * Stale/late Wallet A completion after switch to B → reject + clear cache.
   */
  const finishSuccess = useCallback(
    (completedSessionKey: string | null) => {
      setVisible(false);
      const currentSessionKey = sessionKeyRef.current;
      const result = ownerAcceptFactorCompletion({
        pending: pendingRef.current,
        completedSessionKey,
        currentSessionKey,
        cancelProvider: () => cancel(),
      });
      pendingRef.current = result.pending;

      if (
        result.shouldMark &&
        session &&
        sessionIdentityKey(session) === completedSessionKey &&
        completedSessionKey === currentSessionKey
      ) {
        markStepUpVerified(session);
        return;
      }

      // Never mark on fail path. Clear cache when we rejected a pending op, or
      // when the sheet claims a completed factor for a non-active session
      // (stale/late Wallet A after switch to B). Do not wipe an unrelated
      // wallet's legitimate mark on a no-op double-fire with no pending.
      if (
        result.pendingRejected ||
        (completedSessionKey != null &&
          completedSessionKey !== currentSessionKey)
      ) {
        clearStepUpCache();
      }
    },
    [cancel, session],
  );

  const finishCancel = useCallback(() => {
    setVisible(false);
    cancel();
    const pending = pendingRef.current;
    pendingRef.current = null;
    pending?.reject(new Error('MFA cancelled by user'));
  }, [cancel]);

  useRegisterMfaListener({
    onMfaRequired: async (mfaMethods) => {
      setMethods(mfaMethods);
      // Prefer verify when methods exist; enroll sheet if empty (new factor).
      return new Promise<void>((resolve, reject) => {
        // Replace any prior pending wait (should not stack).
        if (pendingRef.current) {
          pendingRef.current.reject(new Error('MFA superseded'));
        }
        const key = sessionKeyRef.current;
        if (!key) {
          reject(new Error('MFA cancelled: no active session'));
          return;
        }
        pendingRef.current = {
          sessionKey: key,
          resolve,
          reject,
        };
        setVisible(true);
      });
    },
  });

  // methods used for mode: empty → enroll, else verify
  const mode = methods.length === 0 ? 'enroll' : 'verify';

  return (
    <View pointerEvents="box-none" collapsable={false}>
      <StepUpSheet
        visible={visible}
        mode={mode}
        thresholdLabel={thresholdLabel}
        surface="swap"
        session={session}
        onVerified={finishSuccess}
        onCancel={finishCancel}
      />
    </View>
  );
}
