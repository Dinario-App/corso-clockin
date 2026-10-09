/** Imported and unknown sessions require the existing typed sign-out ceremony. */
import { copy } from '@/constants/copy';

export type SignOutSheet = {
  title: string;
  body: string;
  destructive: boolean;
  requiresTypedConfirm: boolean;
  confirmPhrase: string | null;
  confirmPlaceholder: string | null;
  ctaLabel: string;
  cancelLabel: string;
};

/** Only provider sessions get the one-tap sheet. */
export function isDestructiveSignOut(sessionType: unknown): boolean {
  return !(
    sessionType === 'privy_embedded' ||
    sessionType === 'connected_external'
  );
}

export function resolveSignOutSheet(sessionType: unknown): SignOutSheet {
  const destructive = isDestructiveSignOut(sessionType);
  return {
    title: copy.v1Security.signOutTitle,
    body: destructive
      ? copy.v1Security.signOutBodyImport
      : copy.v1Security.signOutBody,
    destructive,
    requiresTypedConfirm: destructive,
    confirmPhrase: destructive ? copy.v1Security.signOutConfirmPhrase : null,
    confirmPlaceholder: destructive
      ? copy.v1Security.signOutConfirmPlaceholder
      : null,
    ctaLabel: copy.v1Security.signOutCta,
    cancelLabel: copy.v1.cancel,
  };
}

/**
 * The single gate every sign-out button must pass through. Surrounding
 * whitespace is forgiven; case and wording are not.
 */
export function isSignOutConfirmed(input: {
  sessionType: unknown;
  typed: unknown;
}): boolean {
  const sheet = resolveSignOutSheet(input.sessionType);
  if (!sheet.requiresTypedConfirm) {
    return true;
  }
  return (
    typeof input.typed === 'string' &&
    input.typed.trim() === copy.v1Security.signOutConfirmPhrase
  );
}
