import { copy } from '@/constants/copy';

export type StepUpA11yCopy = {
  enrollCta: string;
  verifyCta: string;
  enrollCancel: string;
  verifyCancel: string;
};

/**
 * Hide the TOTP enrollment secret from VoiceOver / TalkBack.
 * Visual paint remains for sighted enrollment; SR must not speak the factor secret.
 */
export function totpSecretScreenReaderProps() {
  return {
    accessible: false as const,
    accessibilityElementsHidden: true as const,
    importantForAccessibility: 'no-hide-descendants' as const,
  };
}

export function resolveStepUpAccessibility(input: {
  mode: 'enroll' | 'verify';
  phase: 'prompt' | 'code';
  busy: boolean;
  capturePending: boolean;
  enrollDisabled: boolean;
  copy: StepUpA11yCopy;
}) {
  const primaryLabel =
    input.mode === 'enroll' && input.phase === 'prompt'
      ? input.copy.enrollCta
      : input.copy.verifyCta;
  const cancelLabel =
    input.mode === 'enroll'
      ? input.copy.enrollCancel
      : input.copy.verifyCancel;
  const primaryBusy =
    input.busy || (input.mode === 'enroll' && input.capturePending);
  const primaryDisabled =
    input.mode === 'enroll' ? input.enrollDisabled : input.busy;

  return {
    primary: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: primaryBusy
        ? `${primaryLabel}${copy.signin.workingSuffix}`
        : primaryLabel,
      accessibilityState: {
        busy: primaryBusy,
        disabled: primaryDisabled,
      },
    },
    cancel: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: cancelLabel,
      accessibilityState: { disabled: input.busy },
    },
    codeInput: {
      accessibilityLabel: 'Authentication code',
    },
    error: {
      accessibilityRole: 'alert' as const,
      accessibilityLiveRegion: 'assertive' as const,
    },
    secret: totpSecretScreenReaderProps(),
  };
}
