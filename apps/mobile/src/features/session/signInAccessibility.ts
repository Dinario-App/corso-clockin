/**
 * Pure accessibility props for Sign-in (Privy email / OAuth / provision).
 * Highest-risk controls: back, primary CTAs, code entry, sign-out escape.
 */

export type SignInA11yCopy = {
  back: string;
  emailInput: string;
  codeInput: string;
  cta: string;
  verify: string;
  workingSuffix: string;
  errorRetry: string;
  signOut: string;
  codeResend: string;
};

export function resolveSignInAccessibility(input: {
  busy: boolean;
  codeSent: boolean;
  emailEmpty: boolean;
  codeEmpty: boolean;
  copy: SignInA11yCopy;
}) {
  const continueDisabled = input.emailEmpty || input.busy;
  const verifyDisabled = input.codeEmpty || input.busy;

  return {
    back: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.copy.back,
    },
    emailInput: {
      accessibilityLabel: input.copy.emailInput,
    },
    codeInput: {
      accessibilityLabel: input.copy.codeInput,
    },
    continueCta: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.busy
        ? `${input.copy.cta}${input.copy.workingSuffix}`
        : input.copy.cta,
      accessibilityState: {
        busy: input.busy,
        disabled: continueDisabled,
      },
    },
    verifyCta: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.busy
        ? `${input.copy.verify}${input.copy.workingSuffix}`
        : input.copy.verify,
      accessibilityState: {
        busy: input.busy,
        disabled: verifyDisabled,
      },
    },
    retryCta: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.copy.errorRetry,
    },
    resend: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.copy.codeResend,
    },
    signOut: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: input.copy.signOut,
    },
    error: {
      accessibilityRole: 'alert' as const,
      accessibilityLiveRegion: 'assertive' as const,
    },
  };
}
