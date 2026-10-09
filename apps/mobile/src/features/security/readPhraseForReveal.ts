import * as SecureStore from 'expo-secure-store';
import {
  importedMnemonicOptions,
  IMPORTED_MNEMONIC_KEY,
  IMPORTED_MNEMONIC_KEY_V2,
} from '@corso/wallet';

const options = {
  ...importedMnemonicOptions(SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY),
  requireAuthentication: true,
} as SecureStore.SecureStoreOptions;

export async function readPhraseForReveal(): Promise<string | null> {
  const deviceOnlyMnemonic = await SecureStore.getItemAsync(
    IMPORTED_MNEMONIC_KEY_V2,
    options,
  );
  if (deviceOnlyMnemonic !== null) return deviceOnlyMnemonic;
  return SecureStore.getItemAsync(IMPORTED_MNEMONIC_KEY, options);
}
