import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  createImportedMnemonicStore,
  type ImportedMnemonicDivergenceReason,
  type SecureStoreLike,
} from '@corso/wallet';

export const importedMnemonicAccessibility =
  SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY;

function trackImportedMnemonicDivergence(
  reason: ImportedMnemonicDivergenceReason,
): void {
  void import('@/src/lib/analytics')
    .then(({ trackEvent }) => {
      trackEvent('imported_mnemonic_divergent', { reason });
    })
    .catch(() => {
      // Diagnostics are best-effort and cannot block a wallet restore.
    });
}

const secureStoreAdapter: SecureStoreLike = {
  getItemAsync: (key, options) =>
    SecureStore.getItemAsync(key, options as SecureStore.SecureStoreOptions),
  setItemAsync: (key, value, options) =>
    SecureStore.setItemAsync(
      key,
      value,
      options as SecureStore.SecureStoreOptions,
    ),
  deleteItemAsync: (key, options) =>
    SecureStore.deleteItemAsync(key, options as SecureStore.SecureStoreOptions),
};

export const importedMnemonicStore = createImportedMnemonicStore(
  secureStoreAdapter,
  {
    keychainAccessible: importedMnemonicAccessibility,
    migrateLegacy: Platform.OS === 'ios',
    onDivergent: ({ reason }) => {
      trackImportedMnemonicDivergence(reason);
    },
  },
);
