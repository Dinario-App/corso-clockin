import { copy } from '@/constants/copy';

export type BringYourWalletError =
  | { kind: 'none' }
  | { kind: 'count'; count: number }
  | { kind: 'word'; position: number }
  | { kind: 'checksum' };

export type BringYourWalletPresentation = {
  title: string;
  body: string;
  placeholder: string;
  counter: string;
  secureNote: string;
  ctaLabel: string;
  ctaDisabled: boolean;
  errorText: string | null;
  /** Card carries the dust outline in the error frame. */
  cardInvalid: boolean;
};

export function bringYourWalletErrorText(
  error: BringYourWalletError,
): string | null {
  switch (error.kind) {
    case 'none':
      return null;
    case 'count':
      return copy.v1Onboarding.bringWalletWrongCount(error.count);
    case 'word':
      return copy.import.errorWordlistAt(error.position);
    case 'checksum':
      return copy.import.errorChecksum;
  }
}

export function resolveBringYourWalletPresentation(input: {
  filled: number;
  length: number;
  canSubmit: unknown;
  busy: unknown;
  error: BringYourWalletError | string | null;
}): BringYourWalletPresentation {
  const errorText =
    input.error === null
      ? null
      : typeof input.error === 'string'
        ? input.error
        : bringYourWalletErrorText(input.error);
  return {
    title: copy.v1Onboarding.bringWalletTitle,
    body: copy.v1Onboarding.bringWalletBody,
    placeholder: copy.v1Onboarding.bringWalletPlaceholder,
    counter: copy.v1Onboarding.bringWalletCounter(input.filled, input.length),
    secureNote: copy.v1Onboarding.bringWalletSecure,
    ctaLabel: copy.v1Onboarding.bringWalletCta,
    ctaDisabled: input.canSubmit !== true || input.busy === true,
    errorText,
    cardInvalid: errorText !== null,
  };
}
