const PRIVY_STORAGE_PUNCTUATION = /[:/]/g;

export function privySecureStoreKey(logicalKey: string): string {
  return logicalKey.replace(PRIVY_STORAGE_PUNCTUATION, '-');
}

export function privyRefreshTokenLogicalKey(activeUserId: string | null): string {
  return activeUserId
    ? `privy:${activeUserId}:refresh_token`
    : 'privy:refresh_token';
}

export const PRIVY_ACTIVE_USER_LOGICAL_KEY = 'privy:active-user';

export type PrivyKeyReader = {
  /** Privy's `Storage.get` is typed loosely; SecureStore returns a string or null. */
  get: (key: string) => Promise<unknown> | unknown;
};

async function readStoredString(
  store: PrivyKeyReader,
  logicalKey: string,
): Promise<string | null> {
  const value = await store.get(privySecureStoreKey(logicalKey));
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * `true` — a refresh token is stored. `false` — the read settled empty, or
 * it threw. A throw is not a hold: a broken keystore must still reach
 * sign-in. The in-flight hold is the caller's initial `null`, not this
 * function.
 */
export async function readStoredPrivySession(
  store: PrivyKeyReader,
): Promise<boolean> {
  try {
    const activeUserId = await readStoredString(store, PRIVY_ACTIVE_USER_LOGICAL_KEY);
    if (activeUserId) {
      const named = await readStoredString(
        store,
        privyRefreshTokenLogicalKey(activeUserId),
      );
      if (named) return true;
    }
    const legacy = await readStoredString(store, privyRefreshTokenLogicalKey(null));
    return legacy !== null;
  } catch {
    return false;
  }
}
