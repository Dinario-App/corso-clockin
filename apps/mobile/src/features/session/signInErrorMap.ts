import { copy } from '@/constants/copy';

export type SignInErrorKind =
  | 'none'
  | 'badCode'
  | 'expired'
  | 'network'
  | 'rateLimited'
  | 'unknown'
  | 'alreadyIn';

export type SignInOtpStep = 'send' | 'verify';

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as { message: unknown }).message;
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}

export function isAlreadyLoggedInError(error: unknown): boolean {
  return /already logged in/i.test(extractMessage(error));
}

export function mapSignInError(
  error: unknown,
  step: SignInOtpStep,
): Exclude<SignInErrorKind, 'none'> {
  if (isAlreadyLoggedInError(error)) {
    return 'alreadyIn';
  }

  const message = extractMessage(error).toLowerCase();
  if (/expir/.test(message)) {
    return 'expired';
  }
  if (isRateLimitedError(error, message)) {
    return 'rateLimited';
  }
  if (
    /network|timeout|offline|econn|enotfound|failed to fetch|fetch failed|network request failed/.test(
      message,
    )
  ) {
    return 'network';
  }
  if (
    step === 'verify' &&
    /invalid|incorrect|wrong|mismatch|bad.?code|didn'?t match/.test(message)
  ) {
    return 'badCode';
  }

  return 'unknown';
}

/** null is the SDK's explicit user cancellation, not a provider outage.
 * Do not guess cancellation from message fragments: a failure to cancel is
 * still a failure. @privy-io/expo 0.70.6 emits this code for CANCEL/DISMISS. */
export function resolveOAuthSignInError(error: unknown): string | null {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'login_with_oauth_was_cancelled_by_user'
  ) {
    return null;
  }
  return mapSignInError(error, 'send') === 'network'
    ? copy.signin.errorOAuthNetwork
    : copy.signin.errorOAuthUnavailable;
}

function isRateLimitedError(error: unknown, message: string): boolean {
  if (/rate.?limit|too many|429|throttl/.test(message)) {
    return true;
  }
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    (error as { status?: unknown }).status === 429
  ) {
    return true;
  }
  return false;
}
