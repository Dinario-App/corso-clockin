import * as SecureStore from 'expo-secure-store';
import { parseMwaCapabilities, type MwaCapabilities } from './mwaTypes';

export const MWA_AUTH_TOKEN_REF = 'corso.mwa.auth.v1' as const;

export type StoredMwaSession = Readonly<{
  authToken: string;
  address: string;
  walletName: string | null;
  capabilities: MwaCapabilities;
}>;

export interface MwaSessionStore {
  load(): Promise<StoredMwaSession | null>;
  save(value: StoredMwaSession): Promise<void>;
  remove(): Promise<void>;
}

export type MwaSecureStoreOptions = {
  keychainAccessible?: number;
  requireAuthentication?: boolean;
};

export type MwaSecureStoreLike = {
  getItemAsync(key: string, options?: MwaSecureStoreOptions): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: MwaSecureStoreOptions,
  ): Promise<void>;
  deleteItemAsync(key: string, options?: MwaSecureStoreOptions): Promise<void>;
};

/** Expo SDK 57: WHEN_UNLOCKED_THIS_DEVICE_ONLY, never requireAuthentication. */
const MWA_SECURE_STORE_OPTIONS: MwaSecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function cloneCapabilities(value: MwaCapabilities): MwaCapabilities {
  return Object.freeze({
    signTransactions: value.signTransactions,
    signMessages: value.signMessages,
    signAndSendTransactions: value.signAndSendTransactions,
  });
}

function cloneStoredSession(value: StoredMwaSession): StoredMwaSession {
  return Object.freeze({
    authToken: value.authToken,
    address: value.address,
    walletName: value.walletName,
    capabilities: cloneCapabilities(value.capabilities),
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function parseStoredMwaSession(raw: string): StoredMwaSession | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) {
    return null;
  }
  const keys = Object.getOwnPropertyNames(parsed);
  if (keys.length !== 4) {
    return null;
  }
  if (
    !keys.includes('authToken') ||
    !keys.includes('address') ||
    !keys.includes('walletName') ||
    !keys.includes('capabilities')
  ) {
    return null;
  }
  if (typeof parsed.authToken !== 'string' || parsed.authToken.length === 0) {
    return null;
  }
  if (typeof parsed.address !== 'string' || parsed.address.length === 0) {
    return null;
  }
  if (parsed.walletName !== null && typeof parsed.walletName !== 'string') {
    return null;
  }
  try {
    return cloneStoredSession({
      authToken: parsed.authToken,
      address: parsed.address,
      walletName: parsed.walletName,
      capabilities: parseMwaCapabilities(parsed.capabilities),
    });
  } catch {
    return null;
  }
}

function serializeStoredSession(value: StoredMwaSession): string {
  return JSON.stringify({
    authToken: value.authToken,
    address: value.address,
    walletName: value.walletName,
    capabilities: {
      signTransactions: value.capabilities.signTransactions,
      signMessages: value.capabilities.signMessages,
      signAndSendTransactions: value.capabilities.signAndSendTransactions,
    },
  });
}

/** Injected Task 1 double. Task 2 production path is createSecureStoreMwaSessionStore. */
export function createMemoryMwaSessionStore(
  initial: StoredMwaSession | null = null,
): MwaSessionStore {
  let value: StoredMwaSession | null = initial ? cloneStoredSession(initial) : null;
  return {
    async load() {
      return value ? cloneStoredSession(value) : null;
    },
    async save(next) {
      value = cloneStoredSession(next);
    },
    async remove() {
      value = null;
    },
  };
}

export function createSecureStoreMwaSessionStore(
  secureStore: MwaSecureStoreLike = SecureStore,
): MwaSessionStore {
  return {
    async load() {
      const raw = await secureStore.getItemAsync(
        MWA_AUTH_TOKEN_REF,
        MWA_SECURE_STORE_OPTIONS,
      );
      if (raw == null || raw === '') {
        return null;
      }
      const parsed = parseStoredMwaSession(raw);
      if (!parsed) {
        try {
          await secureStore.deleteItemAsync(
            MWA_AUTH_TOKEN_REF,
            MWA_SECURE_STORE_OPTIONS,
          );
        } catch {
          // Fail closed: unreadable records must not surface.
        }
        return null;
      }
      return parsed;
    },
    async save(next) {
      await secureStore.setItemAsync(
        MWA_AUTH_TOKEN_REF,
        serializeStoredSession(cloneStoredSession(next)),
        MWA_SECURE_STORE_OPTIONS,
      );
    },
    async remove() {
      const existing = await secureStore.getItemAsync(
        MWA_AUTH_TOKEN_REF,
        MWA_SECURE_STORE_OPTIONS,
      );
      if (existing == null || existing === '') {
        return;
      }
      await secureStore.deleteItemAsync(
        MWA_AUTH_TOKEN_REF,
        MWA_SECURE_STORE_OPTIONS,
      );
    },
  };
}

export const mwaSessionStore = createSecureStoreMwaSessionStore();
