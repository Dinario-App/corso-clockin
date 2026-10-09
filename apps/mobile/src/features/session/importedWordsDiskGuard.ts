import { Platform } from 'react-native';
import { IMPORTED_MNEMONIC_KEYS } from '@corso/wallet';
import {
  SecureStoreAbsenceNative,
  type SecureStoreAbsenceNativeModule,
} from '@/modules/secure-store-absence';

export type DiskSeen = 'PRESENT' | 'ABSENT' | 'CANNOT_OBSERVE';

export type DiskVerdict =
  | 'REMOVED'
  | 'NOTHING_TO_REMOVE'
  | 'NOT_REMOVED'
  | 'ABSENT_ORIGIN_UNKNOWN'
  | 'CANNOT_TELL';

export const SECURE_STORE_DEFAULT_KEYCHAIN_SERVICE = 'key_v1';

export type DiskGuardEnv = Readonly<{
  FLAG_SECURESTORE_DISK_GUARD: boolean;
}>;

export type DiskGuardEnvInput = {
  EXPO_PUBLIC_FLAG_SECURESTORE_DISK_GUARD?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error(
      'EXPO_PUBLIC_FLAG_SECURESTORE_DISK_GUARD must be "0" or "1"',
    );
  }
  return raw === '1';
}

export function parseDiskGuardEnv(input: DiskGuardEnvInput = {}): DiskGuardEnv {
  // One line, in the exact shape tools/flags/flagDefaults.mjs parses: a
  // multi-line call is invisible to that gate, which then fails the tree.
  const FLAG_SECURESTORE_DISK_GUARD = parseEnvFlag(input.EXPO_PUBLIC_FLAG_SECURESTORE_DISK_GUARD, '0');
  return Object.freeze({ FLAG_SECURESTORE_DISK_GUARD });
}

/** The inlined build flag. A malformed value keeps the guard unarmed. */
export function readDiskGuardBuildFlag(): boolean {
  try {
    return parseDiskGuardEnv({
      EXPO_PUBLIC_FLAG_SECURESTORE_DISK_GUARD:
        process.env.EXPO_PUBLIC_FLAG_SECURESTORE_DISK_GUARD,
    }).FLAG_SECURESTORE_DISK_GUARD;
  } catch {
    return false;
  }
}

/**
 * The before/after table of `ABSENCE-OBSERVATION.md`, and the same function as
 * `verdict` in the module's `AbsenceObserver.kt`.
 */
export function diskVerdict(before: DiskSeen, after: DiskSeen): DiskVerdict {
  if (after === 'PRESENT') return 'NOT_REMOVED';
  if (after === 'CANNOT_OBSERVE') return 'CANNOT_TELL';
  if (before === 'PRESENT') return 'REMOVED';
  if (before === 'ABSENT') return 'NOTHING_TO_REMOVE';
  return 'ABSENT_ORIGIN_UNKNOWN';
}

/** Verdicts under which Remove may NOT report the words gone. */
export function diskVerdictFailsClosed(verdict: DiskVerdict): boolean {
  return verdict === 'NOT_REMOVED' || verdict === 'CANNOT_TELL';
}

export class ImportedWordsStillOnDiskError extends Error {
  readonly verdict: DiskVerdict;
  constructor(verdict: DiskVerdict) {
    super(`imported_mnemonic_remove_unverified_on_disk:${verdict}`);
    this.name = 'ImportedWordsStillOnDiskError';
    this.verdict = verdict;
  }
}

export type ImportedWordsDiskGuard = Readonly<{
  /** Whether this guard observes at all. False unless armed AND on Android. */
  active: boolean;
  /** Observe BEFORE the erase. `null` when inactive. */
  observeBefore(): Promise<DiskSeen | null>;
  /** Observe AFTER the erase; throws when the pair fails closed. No-op when inactive. */
  assertOffDisk(before: DiskSeen | null): Promise<void>;
}>;

export function createImportedWordsDiskGuard(deps: {
  armed: boolean;
  platform: string;
  native: SecureStoreAbsenceNativeModule | null;
}): ImportedWordsDiskGuard {
  const active = deps.armed && deps.platform === 'android';

  async function observe(): Promise<DiskSeen> {
    // A missing module (a binary built without it) cannot observe.
    if (deps.native === null) return 'CANNOT_OBSERVE';
    try {
      const { seen } = await deps.native.observe(
        IMPORTED_MNEMONIC_KEYS,
        SECURE_STORE_DEFAULT_KEYCHAIN_SERVICE,
      );
      return seen === 'PRESENT' || seen === 'ABSENT' || seen === 'CANNOT_OBSERVE'
        ? seen
        : 'CANNOT_OBSERVE';
    } catch {
      return 'CANNOT_OBSERVE';
    }
  }

  return Object.freeze({
    active,
    async observeBefore() {
      return active ? observe() : null;
    },
    async assertOffDisk(before: DiskSeen | null) {
      if (!active) return;
      const verdict = diskVerdict(before ?? 'CANNOT_OBSERVE', await observe());
      if (diskVerdictFailsClosed(verdict)) {
        throw new ImportedWordsStillOnDiskError(verdict);
      }
    },
  });
}

export const importedWordsDiskGuard = createImportedWordsDiskGuard({
  armed: readDiskGuardBuildFlag(),
  platform: Platform.OS,
  native: SecureStoreAbsenceNative,
});
