/**
 * Module-scope TOTP enrollment secret — outside the React tree.
 * Never put the factor secret in useState / crash-snapshottable props.
 * Cleared on enroll success, cancel, sheet hide, background, unmount.
 */

let secret: string | null = null;

export const totpEnrollmentBuffer = {
  set(value: string | null): void {
    if (secret && secret !== value) {
      // best-effort overwrite before drop (JS strings are immutable)
      secret = '\0'.repeat(secret.length);
    }
    secret = value && value.length > 0 ? value : null;
  },

  /** Read for paint-only UI. Do not log, persist, or put into React state. */
  peek(): string | null {
    return secret;
  },

  clear(): void {
    if (secret) {
      secret = '\0'.repeat(secret.length);
    }
    secret = null;
  },

  isSet(): boolean {
    return Boolean(secret && secret.length > 0);
  },
};
