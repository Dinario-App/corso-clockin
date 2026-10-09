import {
  importMnemonicToAddress,
  type ImportedWallet,
} from './importMnemonic.js';

/** Legacy authenticated key. New writes use v2 so iOS can change accessibility class. */
export const IMPORTED_MNEMONIC_KEY = 'corso.mnemonic.v1';
export const IMPORTED_MNEMONIC_KEY_V2 = 'corso.mnemonic.v2';
export const IMPORTED_MNEMONIC_KEYS = [
  IMPORTED_MNEMONIC_KEY_V2,
  IMPORTED_MNEMONIC_KEY,
] as const;

export type SecureStoreOptions = {
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
  keychainAccessible?: number;
};

/** Structural subset of Expo SecureStore, injected so this package stays platform-agnostic. */
export interface SecureStoreLike {
  getItemAsync(
    key: string,
    options?: SecureStoreOptions,
  ): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: SecureStoreOptions,
  ): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>;
}

export type ImportedMnemonicStore = {
  save(mnemonic: string): Promise<{ address: string }>;
  load(): Promise<ImportedWallet | null>;
  remove(): Promise<void>;
};

export type ImportedMnemonicDivergenceReason =
  | 'legacy_vs_device_only_mismatch'
  | 'device_only_invalid_legacy_valid';

export type ImportedMnemonicDivergence = Readonly<{
  reason: ImportedMnemonicDivergenceReason;
}>;

export type CreateImportedMnemonicStoreOptions = Readonly<{
  keychainAccessible: number;
  migrateLegacy: boolean;
  onDivergent?: (info: ImportedMnemonicDivergence) => void;
}>;

/** Restore only the public session identity and immediately clear derived secret material. */
export async function loadImportedAddress(
  store: ImportedMnemonicStore,
): Promise<string | null> {
  const wallet = await store.load();
  if (wallet === null) return null;

  try {
    return wallet.address;
  } finally {
    wallet.secretKey.fill(0);
  }
}

export function importedMnemonicOptions(
  keychainAccessible: number,
): SecureStoreOptions {
  return {
    requireAuthentication: true,
    authenticationPrompt: 'Unlock Corso',
    keychainAccessible,
  };
}

const emittedDivergenceReasons = new Set<ImportedMnemonicDivergenceReason>();

function deriveAddressAndZero(mnemonic: string): string {
  const wallet = importMnemonicToAddress(mnemonic);
  try {
    return wallet.address;
  } finally {
    wallet.secretKey.fill(0);
  }
}

export function createImportedMnemonicStore(
  secureStore: SecureStoreLike,
  config: CreateImportedMnemonicStoreOptions,
): ImportedMnemonicStore {
  const options = importedMnemonicOptions(config.keychainAccessible);
  let loadInFlight: Promise<string | null> | null = null;

  function reportDivergence(reason: ImportedMnemonicDivergenceReason): void {
    if (!config.onDivergent || emittedDivergenceReasons.has(reason)) return;
    emittedDivergenceReasons.add(reason);
    try {
      config.onDivergent({ reason });
    } catch {
      // Diagnostics must never change keychain or boot behavior.
    }
  }

  async function deleteBestEffort(key: string): Promise<void> {
    try {
      await secureStore.deleteItemAsync(key, options);
    } catch {
      // The verified source remains available, and a later load retries cleanup.
    }
  }

  async function migrateLegacyMnemonic(
    legacyMnemonic: string,
  ): Promise<string> {
    try {
      await secureStore.setItemAsync(
        IMPORTED_MNEMONIC_KEY_V2,
        legacyMnemonic,
        options,
      );
    } catch {
      await deleteBestEffort(IMPORTED_MNEMONIC_KEY_V2);
      return legacyMnemonic;
    }

    let readBack: string | null;
    try {
      readBack = await secureStore.getItemAsync(
        IMPORTED_MNEMONIC_KEY_V2,
        options,
      );
    } catch {
      await deleteBestEffort(IMPORTED_MNEMONIC_KEY_V2);
      return legacyMnemonic;
    }

    if (readBack === null || readBack !== legacyMnemonic) {
      await deleteBestEffort(IMPORTED_MNEMONIC_KEY_V2);
      return legacyMnemonic;
    }

    try {
      const legacyAddress = deriveAddressAndZero(legacyMnemonic);
      const deviceOnlyAddress = deriveAddressAndZero(readBack);
      if (legacyAddress !== deviceOnlyAddress) {
        await deleteBestEffort(IMPORTED_MNEMONIC_KEY_V2);
        return legacyMnemonic;
      }
    } catch {
      await deleteBestEffort(IMPORTED_MNEMONIC_KEY_V2);
      return legacyMnemonic;
    }

    await deleteBestEffort(IMPORTED_MNEMONIC_KEY);
    return readBack;
  }

  async function loadMnemonicOnce(): Promise<string | null> {
    const deviceOnlyMnemonic = await secureStore.getItemAsync(
      IMPORTED_MNEMONIC_KEY_V2,
      options,
    );

    if (deviceOnlyMnemonic !== null) {
      try {
        deriveAddressAndZero(deviceOnlyMnemonic);
      } catch (deviceOnlyError) {
        const legacyMnemonic = await secureStore.getItemAsync(
          IMPORTED_MNEMONIC_KEY,
          options,
        );
        if (legacyMnemonic === null) throw deviceOnlyError;
        try {
          deriveAddressAndZero(legacyMnemonic);
        } catch {
          throw deviceOnlyError;
        }
        reportDivergence('device_only_invalid_legacy_valid');
        return legacyMnemonic;
      }

      let legacyMnemonic: string | null;
      try {
        legacyMnemonic = await secureStore.getItemAsync(
          IMPORTED_MNEMONIC_KEY,
          options,
        );
      } catch {
        return deviceOnlyMnemonic;
      }
      if (legacyMnemonic === null) return deviceOnlyMnemonic;
      if (legacyMnemonic === deviceOnlyMnemonic) {
        await deleteBestEffort(IMPORTED_MNEMONIC_KEY);
      } else {
        reportDivergence('legacy_vs_device_only_mismatch');
      }
      return deviceOnlyMnemonic;
    }

    const legacyMnemonic = await secureStore.getItemAsync(
      IMPORTED_MNEMONIC_KEY,
      options,
    );
    if (legacyMnemonic === null || !config.migrateLegacy) return legacyMnemonic;
    return migrateLegacyMnemonic(legacyMnemonic);
  }

  return {
    async save(mnemonic) {
      const normalizedMnemonic = mnemonic
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      const wallet = importMnemonicToAddress(normalizedMnemonic);

      try {
        await secureStore.setItemAsync(
          IMPORTED_MNEMONIC_KEY_V2,
          normalizedMnemonic,
          options,
        );
        await deleteBestEffort(IMPORTED_MNEMONIC_KEY);
        return { address: wallet.address };
      } finally {
        wallet.secretKey.fill(0);
      }
    },

    async load() {
      if (loadInFlight === null) {
        loadInFlight = loadMnemonicOnce().finally(() => {
          loadInFlight = null;
        });
      }
      const mnemonic = await loadInFlight;
      return mnemonic === null ? null : importMnemonicToAddress(mnemonic);
    },

    async remove() {
      let firstError: unknown;
      for (const key of IMPORTED_MNEMONIC_KEYS) {
        try {
          await secureStore.deleteItemAsync(key, options);
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError !== undefined) throw firstError;
    },
  };
}
