import * as SecureStore from 'expo-secure-store';
import { importedMnemonicAccessibility } from './importedMnemonicStore';

export const IMPORTED_RESTING_KEY = 'corso.importedResting.v1';

const IMPORTED_RESTING_VALUE = 'resting';
const IMPORTED_RESTING_OPTIONS: SecureStore.SecureStoreOptions = Object.freeze({
  keychainAccessible: importedMnemonicAccessibility,
  requireAuthentication: false,
});

type ImportedRestingSecureStore = Pick<
  typeof SecureStore,
  'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'
>;

export type ImportedRestingStore = Readonly<{
  load: () => Promise<boolean>;
  mark: () => Promise<void>;
  clear: () => Promise<void>;
}>;

export function createImportedRestingStore(
  secureStore: ImportedRestingSecureStore = SecureStore,
): ImportedRestingStore {
  let mutationTail: Promise<void> = Promise.resolve();
  const mutate = (operation: () => Promise<void>): Promise<void> => {
    const result = mutationTail.then(operation, operation);
    mutationTail = result.catch(() => undefined);
    return result;
  };

  return Object.freeze({
    async load() {
      await mutationTail;
      return (
        (await secureStore.getItemAsync(
          IMPORTED_RESTING_KEY,
          IMPORTED_RESTING_OPTIONS,
        )) !== null
      );
    },
    async mark() {
      await mutate(() =>
        secureStore.setItemAsync(
          IMPORTED_RESTING_KEY,
          IMPORTED_RESTING_VALUE,
          IMPORTED_RESTING_OPTIONS,
        ),
      );
    },
    async clear() {
      await mutate(() =>
        secureStore.deleteItemAsync(
          IMPORTED_RESTING_KEY,
          IMPORTED_RESTING_OPTIONS,
        ),
      );
    },
  });
}

export const importedRestingStore = createImportedRestingStore();

export function shouldRestoreImported(input: {
  hasWords: boolean;
  resting: boolean;
}): boolean {
  return input.hasWords && !input.resting;
}
