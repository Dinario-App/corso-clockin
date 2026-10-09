import { AppState } from 'react-native';
import type { CorsoSession } from '@/src/features/session/types';
import type { StepUpPolicy } from '@/src/lib/apiConfig';
import {
  assertMfaForHighValue as assertCore,
  bindActiveStepUpSession,
  clearStepUpCache,
  getActiveStepUpSessionKey,
  isStepUpCached,
  markStepUpVerified as markCore,
  getUnconfirmedProviderMfaClearCount,
  isProviderMfaStateStale,
  reconcileProviderMfaState,
  registerProviderMfaClear,
  registerProviderMfaClearObserver,
  retryProviderMfaClearOnForeground,
  sessionCacheKey,
  setProviderMfaClearRetryArmed,
  StepUpRequiredError,
  type ProviderMfaClear,
  type ProviderMfaClearOutcome,
  type StepUpSurface,
} from '@/src/features/security/mfaGateCore';
import { totpEnrollmentBuffer } from '@/src/features/security/totpEnrollmentBuffer';

export {
  StepUpRequiredError,
  clearStepUpCache,
  isStepUpCached,
  getUnconfirmedProviderMfaClearCount,
  isProviderMfaStateStale,
  reconcileProviderMfaState,
  registerProviderMfaClear,
  registerProviderMfaClearObserver,
  retryProviderMfaClearOnForeground,
  bindActiveStepUpSession,
  getActiveStepUpSessionKey,
  sessionCacheKey,
  type ProviderMfaClear,
  type ProviderMfaClearOutcome,
  type StepUpSurface,
};

let appStateSub: { remove: () => void } | null = null;

function ensureAppStateListener(): void {
  if (appStateSub) return;
  setProviderMfaClearRetryArmed(true);
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') {
      clearStepUpCache();
      totpEnrollmentBuffer.clear();
      return;
    }
    void retryProviderMfaClearOnForeground({
      isForeground: () => AppState.currentState === 'active',
    });
  });
}

/** Session identity required — anonymous marks are rejected at the type boundary. */
export function markStepUpVerified(session: CorsoSession): void {
  ensureAppStateListener();
  markCore(session);
}

export async function assertMfaForHighValue(args: {
  session: CorsoSession;
  notionalSol: number | null;
  surface: StepUpSurface;
  policy?: StepUpPolicy;
  verifyPrivyMfa?: () => Promise<boolean>;
  verifyAppLock?: () => Promise<boolean>;
  getLiveSessionKey?: () => string | null;
  verifyTimeoutMs?: number;
}): Promise<void> {
  ensureAppStateListener();
  return assertCore(args);
}

export function ensureStepUpAppStateListener(): void {
  ensureAppStateListener();
}

// Arm listener when this module is first imported in the app runtime.
ensureAppStateListener();
