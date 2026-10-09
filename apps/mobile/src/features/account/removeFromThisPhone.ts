import { clearPriceAlertPushOnTeardown } from '../priceAlerts/pushRuntime';
import {
  clearPerUserLocalStores,
  type LocalClearOutcome,
} from '@/src/features/session/localClearRegistry';
import { loadImportedAddress } from '@/src/features/session/sessionGate';
import { importedMnemonicStore } from '@/src/features/session/importedMnemonicStore';
import {
  importedWordsDiskGuard,
  type ImportedWordsDiskGuard,
} from '@/src/features/session/importedWordsDiskGuard';

export type RemoveFromThisPhoneResult = Readonly<{
  localClearIncomplete: boolean;
  failedStores: readonly string[];
}>;

type ClearLocalStores = (
  tier: 'account-deletion',
) => Promise<LocalClearOutcome>;

export async function executeRemoveFromPhoneFlow(
  input: Readonly<{
    hasImportedWalletOnPhone: boolean;
    hasConnectedWalletOnPhone: boolean;
    clearConnectedSession: () => Promise<unknown>;
    eraseImportedWordsFromPhone: () => Promise<unknown>;
    loadImportedAddress?: () => Promise<string | null>;
    clearLocalStores?: ClearLocalStores;
    diskGuard?: ImportedWordsDiskGuard;
  }>,
): Promise<RemoveFromThisPhoneResult> {
  await clearPriceAlertPushOnTeardown().catch(() => {});
  const failedStores: string[] = [];
  const addFailure = (id: string) => {
    if (!failedStores.includes(id)) failedStores.push(id);
  };

  if (input.hasImportedWalletOnPhone) {
    const diskGuard = input.diskGuard ?? importedWordsDiskGuard;
    try {
      const onDiskBefore = await diskGuard.observeBefore();
      await input.eraseImportedWordsFromPhone();
      const remainingAddress = await (
        input.loadImportedAddress ??
        (() => loadImportedAddress(importedMnemonicStore))
      )();
      if (remainingAddress !== null) {
        throw new Error('imported_mnemonic_remove_unverified');
      }
      await diskGuard.assertOffDisk(onDiskBefore);
    } catch {
      // Abort before the registry: it owns the resting marker, bound factor
      // and limiter, which are the only safe recovery path while words remain.
      addFailure('importedMnemonic');
      return {
        localClearIncomplete: true,
        failedStores,
      };
    }
  }

  if (input.hasConnectedWalletOnPhone) {
    try {
      await input.clearConnectedSession();
    } catch {
      // Fail closed for copy: if disconnect cleanup threw, do not claim that
      // the connected wallet is gone even though Session clears memory first.
      addFailure('mwaSession');
    }
  }

  const { unfinished } = await (
    input.clearLocalStores ?? clearPerUserLocalStores
  )('account-deletion');
  for (const id of unfinished) addFailure(id);

  return {
    localClearIncomplete: failedStores.length > 0,
    failedStores,
  };
}
