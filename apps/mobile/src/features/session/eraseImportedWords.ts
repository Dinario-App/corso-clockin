import {
  importedWordsDiskGuard,
  type ImportedWordsDiskGuard,
} from '@/src/features/session/importedWordsDiskGuard';

export async function eraseImportedWordsAndVerify(deps: {
  remove: () => Promise<void>;
  loadRemainingAddress: () => Promise<string | null>;
  diskGuard?: ImportedWordsDiskGuard;
}): Promise<void> {
  const diskGuard = deps.diskGuard ?? importedWordsDiskGuard;
  const onDiskBefore = await diskGuard.observeBefore();
  await deps.remove();
  if ((await deps.loadRemainingAddress()) !== null) {
    throw new Error('imported_mnemonic_remove_unverified');
  }
  await diskGuard.assertOffDisk(onDiskBefore);
}
