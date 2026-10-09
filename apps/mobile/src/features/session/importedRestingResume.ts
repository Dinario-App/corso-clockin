import {
  clearImportedRestingPasscode,
  hasImportedRestingPasscode,
  restoreImportedRestingPasscode,
  verifyImportedRestingPasscode,
} from '@/src/features/security/appLock';
import { importedMnemonicStore } from './importedMnemonicStore';
import { importedRestingStore } from './importedResting';
import { loadImportedAddress } from './sessionGate';

export type ImportedRestingWelcomeState =
  | 'hidden'
  | 'resume'
  | 'no_passcode';

type WelcomeStateDependencies = Readonly<{
  loadResting?: () => Promise<boolean>;
  hasBoundPasscode?: () => Promise<boolean>;
}>;

/** Discovery is deliberately phrase-blind, so Welcome never prompts at launch. */
export async function readImportedRestingWelcomeState(
  dependencies: WelcomeStateDependencies = {},
): Promise<ImportedRestingWelcomeState> {
  const loadResting = dependencies.loadResting ?? importedRestingStore.load;
  const hasBoundPasscode =
    dependencies.hasBoundPasscode ?? hasImportedRestingPasscode;
  if (!(await loadResting())) return 'hidden';
  return (await hasBoundPasscode()) ? 'resume' : 'no_passcode';
}

type ResumeDependencies = Readonly<{
  passcode: string;
  loadResting?: () => Promise<boolean>;
  verifyBoundPasscode?: (passcode: string) => Promise<boolean>;
  loadImportedAddress?: () => Promise<string | null>;
  restoreBoundPasscode?: () => Promise<void>;
  clearMarker?: () => Promise<void>;
  clearBoundPasscode?: () => Promise<void>;
}>;

export type ImportedRestingResumeResult =
  | Readonly<{ status: 'resumed'; address: string }>
  | Readonly<{
      status:
        | 'not_resting'
        | 'missing_words'
        | 'wrong_passcode'
        | 'read_failed';
    }>;

/**
 * Verifies the credential bound at imported sign-out before touching words.
 * The phrase is read only through the wallet package's address-derivation path.
 */
export async function resumeImportedRestingWords(
  input: ResumeDependencies,
): Promise<ImportedRestingResumeResult> {
  const loadResting = input.loadResting ?? importedRestingStore.load;
  const verifyBoundPasscode =
    input.verifyBoundPasscode ?? verifyImportedRestingPasscode;
  const loadAddress =
    input.loadImportedAddress ??
    (() => loadImportedAddress(importedMnemonicStore));
  const restoreBoundPasscode =
    input.restoreBoundPasscode ?? restoreImportedRestingPasscode;
  const clearMarker = input.clearMarker ?? importedRestingStore.clear;
  const clearBoundPasscode =
    input.clearBoundPasscode ?? clearImportedRestingPasscode;

  if (!(await loadResting())) return { status: 'not_resting' };
  if (!(await verifyBoundPasscode(input.passcode))) {
    return { status: 'wrong_passcode' };
  }

  let address: string | null;
  try {
    address = await loadAddress();
  } catch {
    return { status: 'read_failed' };
  }

  if (address === null) {
    await clearMarker();
    await clearBoundPasscode();
    return { status: 'missing_words' };
  }

  await restoreBoundPasscode();
  await clearMarker();
  await clearBoundPasscode();
  return { status: 'resumed', address };
}
