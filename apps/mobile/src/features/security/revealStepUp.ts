import type { AppLockPreference } from '@/src/features/security/appLock';

export type RevealStepUpMethod = 'biometric' | 'passcode';

/**
 * Which app-lock factor to raise. Biometric only when it is the chosen
 * preference AND the device can honour it; everything else is the passcode.
 * A missing or `skipped` preference is not "no lock": the passcode path is
 * asked for and, with no passcode on file, `verifyAppLockPasscode` refuses.
 */
export function resolveRevealStepUpMethod(input: {
  preference: AppLockPreference;
  biometricHardware: boolean;
}): RevealStepUpMethod {
  return input.preference === 'biometric' && input.biometricHardware === true
    ? 'biometric'
    : 'passcode';
}

/**
 * A biometric that did not succeed — cancelled, failed, or threw — falls back
 * to the passcode sheet, never to the reveal. Same shape as `unlockSession`
 * returning `passcode_required`.
 */
export function afterBiometricStepUp(
  success: unknown,
): 'passed' | 'passcode_required' {
  return success === true ? 'passed' : 'passcode_required';
}

export type RevealGateInput = {
  /** `canRevealWords(session.type)` — import door only. */
  allowed: unknown;
  /** The anti-phishing gate was acknowledged on THIS mount. */
  consented: unknown;
  /** The app-lock factor passed for THIS reveal. */
  stepUpPassed: unknown;
  /** iOS reported a screenshot; the words are gone for good this session. */
  screenshotDetected: unknown;
};

export type RevealGateRefusal =
  | 'not_import_door'
  | 'consent_missing'
  | 'step_up_missing'
  | 'screenshot_detected';

export type RevealGateDecision =
  | { read: true }
  | { read: false; reason: RevealGateRefusal };

/**
 * The one decision that stands between the button and `readPhraseForReveal`.
 * Every input must be literally `true`; anything else fails closed. Order
 * matters only for the reason reported — every refusal is a refusal.
 */
export function decideReadPhrase(input: RevealGateInput): RevealGateDecision {
  if (input.allowed !== true) return { read: false, reason: 'not_import_door' };
  if (input.screenshotDetected === true) {
    return { read: false, reason: 'screenshot_detected' };
  }
  if (input.consented !== true) return { read: false, reason: 'consent_missing' };
  if (input.stepUpPassed !== true) return { read: false, reason: 'step_up_missing' };
  return { read: true };
}

/** Convenience for callers that only need the boolean. */
export function canReadPhraseForReveal(input: RevealGateInput): boolean {
  return decideReadPhrase(input).read;
}
