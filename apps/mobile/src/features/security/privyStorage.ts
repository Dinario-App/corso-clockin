import * as SecureStore from 'expo-secure-store';
import type { Storage } from '@privy-io/expo';

const opts: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export const CorsoPrivyStorage: Storage = {
  get: (key) => SecureStore.getItemAsync(key, opts),
  put: (key, value) => SecureStore.setItemAsync(key, value as string, opts),
  del: (key) => SecureStore.deleteItemAsync(key, opts),
  getKeys: async () => [],
};
