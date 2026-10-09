import { copy } from '@/constants/copy';
import type { SignInErrorKind } from './signInErrorMap.js';

export type SignInSourceState =
  | 'F005'
  | 'F006'
  | 'F007'
  | 'F008'
  | 'F009'
  | 'F010'
  | 'F011';

export type SignInPrimaryAction =
  | 'continue'
  | 'verify'
  | 'resend'
  | 'retry'
  | 'none';

export const SIGNIN_VERIFY_LABEL = copy.signin.verify;

export type SignInChrome = {
  frame: SignInSourceState;
  title: string;
  helperKind: 'email' | 'code' | 'alreadyIn';
  primaryAction: SignInPrimaryAction;
  primaryLabel: string;
  showEmailField: boolean;
  showCodeField: boolean;
  showResend: boolean;
  signOutEscape: boolean;
  errorMessage: string | null;
};

function normalizeErrorKind(value: unknown): SignInErrorKind {
  if (
    value === 'none' ||
    value === 'badCode' ||
    value === 'expired' ||
    value === 'network' ||
    value === 'rateLimited' ||
    value === 'unknown' ||
    value === 'alreadyIn'
  ) {
    return value;
  }
  return 'none';
}

export function resolveSignInErrorMessage(
  kind: unknown,
): string | null {
  switch (normalizeErrorKind(kind)) {
    case 'badCode':
      return copy.signin.errorBadCode;
    case 'expired':
      return copy.signin.errorExpired;
    case 'network':
      return copy.signin.errorNetwork;
    case 'rateLimited':
      return copy.signin.errorRateLimited;
    case 'unknown':
      return copy.signin.errorUnknown;
    case 'alreadyIn':
      return copy.signin.errorAlreadyIn;
    case 'none':
      return null;
  }
}

export function resolveSignInSourceState(input: {
  method?: unknown;
  codeSent?: unknown;
  emailEmpty?: unknown;
  errorKind?: unknown;
  alreadySignedIn?: unknown;
}): SignInSourceState {
  const method = typeof input.method === 'string' ? input.method : 'email';
  if (input.alreadySignedIn === true || method === 'resume') {
    return 'F011';
  }

  const errorKind = normalizeErrorKind(input.errorKind);
  if (
    errorKind === 'network' ||
    errorKind === 'rateLimited' ||
    errorKind === 'unknown'
  ) {
    return 'F010';
  }

  if (input.codeSent === true) {
    if (errorKind === 'expired') {
      return 'F009';
    }
    if (errorKind === 'badCode') {
      return 'F008';
    }
    return 'F007';
  }

  if (input.emailEmpty === true) {
    return 'F006';
  }
  return 'F005';
}

export function resolveSignInChrome(input: {
  method?: unknown;
  codeSent?: unknown;
  emailEmpty?: unknown;
  errorKind?: unknown;
  alreadySignedIn?: unknown;
}): SignInChrome {
  const frame = resolveSignInSourceState(input);
  const errorMessage = resolveSignInErrorMessage(
    frame === 'F006' || frame === 'F005' || frame === 'F007'
      ? 'none'
      : input.errorKind,
  );

  switch (frame) {
    case 'F005':
      return {
        frame,
        title: copy.signin.title,
        helperKind: 'email',
        primaryAction: 'continue',
        primaryLabel: copy.signin.cta,
        showEmailField: true,
        showCodeField: false,
        showResend: false,
        signOutEscape: false,
        errorMessage: null,
      };
    case 'F006':
      return {
        frame,
        title: copy.signin.title,
        helperKind: 'email',
        primaryAction: 'continue',
        primaryLabel: copy.signin.cta,
        showEmailField: true,
        showCodeField: false,
        showResend: false,
        signOutEscape: false,
        errorMessage: null,
      };
    case 'F007':
      return {
        frame,
        title: copy.signin.codeTitle,
        helperKind: 'code',
        primaryAction: 'verify',
        primaryLabel: SIGNIN_VERIFY_LABEL,
        showEmailField: false,
        showCodeField: true,
        showResend: true,
        signOutEscape: false,
        errorMessage: null,
      };
    case 'F008':
      return {
        frame,
        title: copy.signin.codeTitle,
        helperKind: 'code',
        primaryAction: 'verify',
        primaryLabel: SIGNIN_VERIFY_LABEL,
        showEmailField: false,
        showCodeField: true,
        showResend: true,
        signOutEscape: false,
        errorMessage,
      };
    case 'F009':
      return {
        frame,
        title: copy.signin.codeTitle,
        helperKind: 'code',
        primaryAction: 'resend',
        primaryLabel: copy.signin.codeResend,
        showEmailField: false,
        showCodeField: true,
        showResend: false,
        signOutEscape: false,
        errorMessage,
      };
    case 'F010':
      return {
        frame,
        title:
          input.codeSent === true ? copy.signin.codeTitle : copy.signin.title,
        helperKind: input.codeSent === true ? 'code' : 'email',
        primaryAction: 'retry',
        primaryLabel: copy.signin.errorRetry,
        showEmailField: input.codeSent !== true,
        showCodeField: input.codeSent === true,
        showResend: input.codeSent === true,
        signOutEscape: false,
        errorMessage,
      };
    case 'F011':
      return {
        frame,
        title: copy.signin.title,
        helperKind: 'alreadyIn',
        primaryAction: 'none',
        primaryLabel: '',
        showEmailField: false,
        showCodeField: false,
        showResend: false,
        signOutEscape: true,
        errorMessage: copy.signin.errorAlreadyIn,
      };
  }
}

export type SignInProvisionFrame = 'one-second' | 'stuck' | 'none';

export function resolveSignInProvisionFrame(input: {
  showProvision: boolean;
  showAlreadyInFrame: boolean;
  provisionStuck: boolean;
}): SignInProvisionFrame {
  if (!input.showProvision) return 'none';
  if (input.provisionStuck) return 'stuck';
  return input.showAlreadyInFrame ? 'none' : 'one-second';
}

export function resolveSignInBackAffordance(input: {
  frame: SignInSourceState;
  hasUser: unknown;
}): 'back-chevron' | 'none' {
  return input.frame === 'F011' && input.hasUser === true ? 'none' : 'back-chevron';
}

export function resolveSignInHelperText(
  helperKind: SignInChrome['helperKind'],
  email: unknown,
): string {
  if (helperKind === 'code') {
    const trimmed = typeof email === 'string' ? email.trim() : '';
    return copy.signin.codeHelper(trimmed);
  }
  if (helperKind === 'alreadyIn') {
    // errorAlreadyIn is the assertive error, not a second helper line.
    return '';
  }
  return copy.signin.emailHelper;
}
