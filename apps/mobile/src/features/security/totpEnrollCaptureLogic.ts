export type TotpCaptureState = 'idle' | 'pending' | 'ready' | 'failed';

/** Enrollment init (provider secret fetch) only when capture is proven ready. */
export function canStartTotpEnrollment(state: TotpCaptureState): boolean {
  return state === 'ready';
}

/** Secret may paint only when capture is ready and a non-empty secret exists. */
export function canPaintTotpSecret(args: {
  captureState: TotpCaptureState;
  secret: string | null | undefined;
}): boolean {
  if (args.captureState !== 'ready') return false;
  return Boolean(args.secret && args.secret.length > 0);
}

/**
 * Accept a capture-setup async result only for the current request nonce.
 * Stale → no state change (caller keeps previous / cleanup).
 */
export function applyCaptureSetupResult(args: {
  requestNonce: number;
  currentNonce: number;
  ok: boolean;
}): TotpCaptureState | 'stale' {
  if (args.requestNonce !== args.currentNonce) return 'stale';
  return args.ok ? 'ready' : 'failed';
}

/**
 * Accept a late initMfaEnrollment result only when nonce matches AND capture
 * is still ready. Otherwise discard secret (do not set buffer / do not paint).
 */
export function shouldAcceptEnrollmentSecret(args: {
  requestNonce: number;
  currentNonce: number;
  captureState: TotpCaptureState;
}): boolean {
  if (args.requestNonce !== args.currentNonce) return false;
  return args.captureState === 'ready';
}

/** Primary enroll CTA: disabled while capture pending/failed/idle or busy. */
export function isEnrollCtaDisabled(args: {
  captureState: TotpCaptureState;
  busy: boolean;
  phase: 'prompt' | 'code';
}): boolean {
  if (args.busy) return true;
  if (args.phase === 'prompt') {
    return args.captureState !== 'ready';
  }
  // code phase: capture must still be ready (secret already gated at set)
  return args.captureState !== 'ready';
}
