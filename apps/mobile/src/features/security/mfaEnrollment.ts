import { sessionIdentityKey } from '@/src/features/security/mfaSessionGuard';

type SessionIdentity = { type: string; address: string } | null | undefined;

function ownDataValue(
  value: object,
  key: string,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !('value' in descriptor) || descriptor.get || descriptor.set) {
    return undefined;
  }
  return descriptor.value;
}

/**
 * Read only the installed Privy SDK's passkey account DTO shape. Accessors,
 * inherited fields, malformed values, and duplicate credentials are ignored.
 */
export function extractPasskeyCredentialIds(accounts: unknown): string[] {
  if (!Array.isArray(accounts)) return [];
  const ids = new Set<string>();
  for (const account of accounts) {
    if (
      typeof account !== 'object' ||
      account === null ||
      Object.getPrototypeOf(account) !== Object.prototype
    ) {
      continue;
    }
    if (ownDataValue(account, 'type') !== 'passkey') continue;
    const raw = ownDataValue(account, 'credential_id');
    if (typeof raw !== 'string') continue;
    const credentialId = raw.trim();
    if (credentialId.length > 0) ids.add(credentialId);
  }
  return [...ids];
}

/** Every post-await enrollment continuation rechecks the live signer identity. */
export function mayContinueMfaEnrollment(input: {
  startedSessionKey: string;
  currentSession: SessionIdentity;
}): boolean {
  return (
    input.currentSession?.type === 'privy_embedded' &&
    sessionIdentityKey(input.currentSession) === input.startedSessionKey
  );
}
