import type { CorsoSession } from '@/src/features/session/types';
import type { StepUpPolicy } from '@/src/lib/apiConfig';
import { isAboveStepUpThreshold } from '@/src/features/security/stepUpPolicy';

export type StepUpPath = 'skip' | 'cached' | 'privy' | 'app_lock' | 'block';

export function resolveStepUpPath(args: {
  session: CorsoSession;
  notionalSol: number | null;
  policy: StepUpPolicy;
  cached: boolean;
}): StepUpPath {
  if (!args.policy.stepUpRequired) return 'skip';
  if (!isAboveStepUpThreshold(args.notionalSol, args.policy)) return 'skip';
  if (args.session.type === 'privy_embedded') {
    return args.cached ? 'cached' : 'privy';
  }
  if (
    args.session.type === 'imported_seed' ||
    args.session.type === 'connected_external'
  ) {
    return args.cached ? 'cached' : 'app_lock';
  }
  // Unknown future session types fail closed before any cache can satisfy them.
  return 'block';
}

/** Bounded verify timeout (ms) for provider MFA — fail closed. */
export const STEP_UP_VERIFY_TIMEOUT_MS = 60_000;

/**
 * Race a promise against a timeout; on timeout call onTimeout and reject with its error.
 */
export function withBoundedTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(onTimeout());
    }, timeoutMs);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
