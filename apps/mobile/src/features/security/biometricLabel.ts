/** The neutral label. Used whenever the platform or the sensor is unknown. */
export const NEUTRAL_BIOMETRIC_LABEL = 'biometrics';

export type BiometricLabelInput = {
  /** `Platform.OS`. Anything other than `ios`/`android` falls to neutral. */
  platform: string;
  /** OS reports a face sensor. */
  facial: boolean;
  /** OS reports a fingerprint sensor. */
  fingerprint: boolean;
};

export function resolveBiometricLabel(input: BiometricLabelInput): string {
  if (input.platform === 'ios') {
    if (input.facial) return 'Face ID';
    if (input.fingerprint) return 'Touch ID';
    return NEUTRAL_BIOMETRIC_LABEL;
  }

  if (input.platform === 'android') {
    if (input.facial) return 'Face Unlock';
    if (input.fingerprint) return 'Fingerprint';
    return NEUTRAL_BIOMETRIC_LABEL;
  }

  return NEUTRAL_BIOMETRIC_LABEL;
}
