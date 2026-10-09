import {
  importMnemonicToAddress,
  loadImportedAddress,
  type ImportedMnemonicStore,
} from '@corso/wallet';

export type ImportReplacementGuardResult =
  | { status: 'confirmation_required' }
  | { status: 'proceed' };

type ImportReplacementGuardInput = {
  phrase: string;
  store: ImportedMnemonicStore;
  allowReplace: boolean;
};

/**
 * Owns the import seam's read-before-write rule. Only public addresses are
 * compared, and both derived secret keys are zeroed before persistence begins.
 */
export async function guardImportedPhraseReplacement(
  input: ImportReplacementGuardInput,
): Promise<ImportReplacementGuardResult> {
  if (!input.allowReplace) {
    const incomingWallet = importMnemonicToAddress(input.phrase);
    let incomingAddress: string;
    try {
      incomingAddress = incomingWallet.address;
    } finally {
      incomingWallet.secretKey.fill(0);
    }

    try {
      const restingAddress = await loadImportedAddress(input.store);
      if (restingAddress !== null && restingAddress !== incomingAddress) {
        return { status: 'confirmation_required' };
      }
    } catch {
      // An unreadable keychain item may still hold words. Never overwrite it silently.
      return { status: 'confirmation_required' };
    }
  }

  return { status: 'proceed' };
}
