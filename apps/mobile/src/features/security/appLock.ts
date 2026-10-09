import AsyncStorage from '@react-native-async-storage/async-storage';
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { copy } from '@/constants/copy';
import { resolveBiometricLabel } from './biometricLabel';

const APP_LOCK_KEY = 'corso.appLock.v1';
export const APP_LOCK_CREDENTIAL_KEY = 'corso.appLock.passcode.v1';
export const APP_LOCK_ATTEMPTS_KEY = 'corso.appLock.attempts.v1';
export const IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY =
  'corso.importedResting.credential.v1';
export const IMPORTED_RESTING_APP_LOCK_ATTEMPTS_KEY =
  'corso.importedResting.attempts.v1';
const PASSCODE_LENGTH = 6;
// Six digits are a convenience lock, not wallet encryption. SecureStore is the
// extraction boundary; this bounded PBKDF2 cost slows offline guessing without
// making the app-owned fallback feel hung on the launch Android hardware.
const PASSCODE_ITERATIONS = 30_000;
// Migration floor for resting snapshots. Do not tie this to a future increase
// in PASSCODE_ITERATIONS: older owners must still be able to open the door.
const IMPORTED_RESTING_PASSCODE_ITERATION_FLOOR = 30_000;
const PASSCODE_SALT_BYTES = 16;
const PASSCODE_DIGEST_BYTES = 32;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

type PasscodeRecord = {
  version: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  saltHex: string;
  digestHex: string;
};

type AttemptState = {
  failures: number;
  lockedUntilMs: number;
  lastFailureMs: number;
};

export type PasscodeWait = Readonly<{
  lockedUntilMs: number;
  remainingMs: number;
}>;

export class PasscodeBackoffError extends Error {
  readonly lockedUntilMs: number;
  readonly remainingMs: number;

  constructor(wait: PasscodeWait) {
    super('app_lock_passcode_backoff');
    this.name = 'PasscodeBackoffError';
    this.lockedUntilMs = wait.lockedUntilMs;
    this.remainingMs = wait.remainingMs;
  }
}

export type AppLockPreference = 'biometric' | 'passcode' | 'skipped' | null;

export async function getAppLockPreference(): Promise<AppLockPreference> {
  const value = await AsyncStorage.getItem(APP_LOCK_KEY);
  if (value === 'skipped') return value;
  if (
    (value === 'biometric' || value === 'passcode') &&
    (await hasAppLockPasscode())
  )
    return value;
  return null;
}

export async function setAppLockPreference(
  method: Exclude<AppLockPreference, null>,
): Promise<void> {
  await AsyncStorage.setItem(APP_LOCK_KEY, method);
}

export async function clearAppLockPreference(): Promise<void> {
  await AsyncStorage.removeItem(APP_LOCK_KEY);
  await SecureStore.deleteItemAsync(
    APP_LOCK_CREDENTIAL_KEY,
    secureStoreOptions,
  );
}

function parsePasscodeRecord(raw: string | null): PasscodeRecord | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PasscodeRecord>;
    if (
      parsed.version !== 1 ||
      parsed.kdf !== 'pbkdf2-sha256' ||
      parsed.iterations !== PASSCODE_ITERATIONS ||
      typeof parsed.saltHex !== 'string' ||
      typeof parsed.digestHex !== 'string' ||
      !/^[0-9a-f]{32}$/.test(parsed.saltHex) ||
      !/^[0-9a-f]{64}$/.test(parsed.digestHex)
    )
      return null;
    return parsed as PasscodeRecord;
  } catch {
    return null;
  }
}

function parseImportedRestingPasscodeRecord(
  raw: string | null,
): PasscodeRecord | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PasscodeRecord>;
    if (
      parsed.version !== 1 ||
      parsed.kdf !== 'pbkdf2-sha256' ||
      !Number.isSafeInteger(parsed.iterations) ||
      parsed.iterations! < IMPORTED_RESTING_PASSCODE_ITERATION_FLOOR ||
      typeof parsed.saltHex !== 'string' ||
      typeof parsed.digestHex !== 'string' ||
      !/^[0-9a-f]{32}$/.test(parsed.saltHex) ||
      !/^[0-9a-f]{64}$/.test(parsed.digestHex)
    )
      return null;
    return parsed as PasscodeRecord;
  } catch {
    return null;
  }
}

function parseAttemptState(raw: string | null): AttemptState {
  if (raw === null) return { failures: 0, lockedUntilMs: 0, lastFailureMs: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<AttemptState>;
    if (
      !Number.isSafeInteger(parsed.failures) ||
      parsed.failures! < 0 ||
      !Number.isSafeInteger(parsed.lockedUntilMs) ||
      parsed.lockedUntilMs! < 0 ||
      !Number.isSafeInteger(parsed.lastFailureMs) ||
      parsed.lastFailureMs! < 0
    ) {
      throw new Error('invalid_app_lock_attempts');
    }
    return parsed as AttemptState;
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid_app_lock_attempts')
      throw error;
    throw new Error('invalid_app_lock_attempts');
  }
}

function delayForFailures(failures: number): number {
  if (failures <= 5) return 0;
  if (failures === 6) return MINUTE_MS;
  if (failures === 7) return 5 * MINUTE_MS;
  if (failures === 8) return 15 * MINUTE_MS;
  return HOUR_MS;
}

async function readAttemptState(
  key = APP_LOCK_ATTEMPTS_KEY,
): Promise<AttemptState> {
  return parseAttemptState(
    await SecureStore.getItemAsync(key, secureStoreOptions),
  );
}

async function writeAttemptState(
  state: AttemptState,
  key = APP_LOCK_ATTEMPTS_KEY,
): Promise<void> {
  await SecureStore.setItemAsync(
    key,
    JSON.stringify(state),
    secureStoreOptions,
  );
}

async function resolveWait(
  state: AttemptState,
  nowMs: number,
  key = APP_LOCK_ATTEMPTS_KEY,
): Promise<PasscodeWait | null> {
  const currentDelayMs = delayForFailures(state.failures);
  if (currentDelayMs > 0 && nowMs < state.lastFailureMs) {
    const rolledBackState = {
      ...state,
      lastFailureMs: nowMs,
      lockedUntilMs: nowMs + currentDelayMs,
    };
    await writeAttemptState(rolledBackState, key);
    return {
      lockedUntilMs: rolledBackState.lockedUntilMs,
      remainingMs: currentDelayMs,
    };
  }
  if (nowMs < state.lockedUntilMs) {
    return {
      lockedUntilMs: state.lockedUntilMs,
      remainingMs: state.lockedUntilMs - nowMs,
    };
  }
  return null;
}

export async function getAppLockPasscodeWait(): Promise<PasscodeWait | null> {
  return resolveWait(await readAttemptState(), Date.now());
}

export async function getImportedRestingPasscodeWait(): Promise<PasscodeWait | null> {
  return resolveWait(
    await readAttemptState(IMPORTED_RESTING_APP_LOCK_ATTEMPTS_KEY),
    Date.now(),
    IMPORTED_RESTING_APP_LOCK_ATTEMPTS_KEY,
  );
}

export async function clearAppLockAttempts(): Promise<void> {
  await SecureStore.deleteItemAsync(APP_LOCK_ATTEMPTS_KEY, secureStoreOptions);
}

export async function clearImportedRestingPasscode(): Promise<void> {
  await SecureStore.deleteItemAsync(
    IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
    secureStoreOptions,
  );
  await SecureStore.deleteItemAsync(
    IMPORTED_RESTING_APP_LOCK_ATTEMPTS_KEY,
    secureStoreOptions,
  );
}

export function formatPasscodeWait(remainingMs: number): string | null {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
  if (remainingMs < HOUR_MS) {
    const minutes = Math.ceil(remainingMs / MINUTE_MS);
    return minutes === 1
      ? copy.lock.waitMinute
      : copy.lock.waitMinutes(minutes);
  }
  const hours = Math.ceil(remainingMs / HOUR_MS);
  return hours === 1 ? copy.lock.waitHour : copy.lock.waitHours(hours);
}

async function derivePasscode(
  passcode: string,
  salt: Uint8Array,
  iterations = PASSCODE_ITERATIONS,
): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(passcode), salt, {
    c: iterations,
    dkLen: PASSCODE_DIGEST_BYTES,
    asyncTick: 10,
  });
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

async function verifyPasscodeAgainstRecord(
  record: PasscodeRecord,
  passcode: string,
): Promise<boolean> {
  if (!new RegExp(`^\\d{${PASSCODE_LENGTH}}$`).test(passcode)) return false;
  const candidate = await derivePasscode(
    passcode,
    hexToBytes(record.saltHex),
    record.iterations,
  );
  return constantTimeEqual(candidate, hexToBytes(record.digestHex));
}

export async function hasAppLockPasscode(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(
    APP_LOCK_CREDENTIAL_KEY,
    secureStoreOptions,
  );
  return parsePasscodeRecord(raw) !== null;
}

export async function hasImportedRestingPasscode(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(
    IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
    secureStoreOptions,
  );
  return parseImportedRestingPasscodeRecord(raw) !== null;
}

/**
 * Snapshot the imported owner's credential before sign-out deletes the
 * general app-lock record. A missing record yields no resume signal; a failed
 * keychain write aborts sign-out rather than pretending the copy exists.
 */
export async function copyAppLockPasscodeToImportedResting(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(
    APP_LOCK_CREDENTIAL_KEY,
    secureStoreOptions,
  );
  if (raw === null || parsePasscodeRecord(raw) === null) return false;
  await SecureStore.setItemAsync(
    IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
    raw,
    secureStoreOptions,
  );
  return true;
}

export async function setAppLockPasscode(passcode: string): Promise<void> {
  if (!new RegExp(`^\\d{${PASSCODE_LENGTH}}$`).test(passcode)) {
    throw new Error('invalid_app_lock_passcode');
  }
  const salt = new Uint8Array(PASSCODE_SALT_BYTES);
  globalThis.crypto.getRandomValues(salt);
  const digest = await derivePasscode(passcode, salt);
  const record: PasscodeRecord = {
    version: 1,
    kdf: 'pbkdf2-sha256',
    iterations: PASSCODE_ITERATIONS,
    saltHex: bytesToHex(salt),
    digestHex: bytesToHex(digest),
  };
  await SecureStore.setItemAsync(
    APP_LOCK_CREDENTIAL_KEY,
    JSON.stringify(record),
    secureStoreOptions,
  );
  await clearAppLockAttempts();
}

export async function verifyAppLockPasscode(
  passcode: string,
): Promise<boolean> {
  return verifyPasscodeWithLimiter({
    passcode,
    attemptsKey: APP_LOCK_ATTEMPTS_KEY,
    credentialKey: APP_LOCK_CREDENTIAL_KEY,
    parseRecord: parsePasscodeRecord,
  });
}

async function verifyPasscodeWithLimiter(input: {
  passcode: string;
  attemptsKey: string;
  credentialKey: string;
  parseRecord: (raw: string | null) => PasscodeRecord | null;
}): Promise<boolean> {
  const nowMs = Date.now();
  const priorState = await readAttemptState(input.attemptsKey);
  const activeWait = await resolveWait(priorState, nowMs, input.attemptsKey);
  if (activeWait) throw new PasscodeBackoffError(activeWait);
  const failures = priorState.failures + 1;
  const delayMs = delayForFailures(failures);
  const attemptState = {
    failures,
    lastFailureMs: nowMs,
    lockedUntilMs: delayMs === 0 ? 0 : nowMs + delayMs,
  };
  // Persist first: killing Corso during the KDF never grants a free guess.
  await writeAttemptState(attemptState, input.attemptsKey);
  const raw = await SecureStore.getItemAsync(
    input.credentialKey,
    secureStoreOptions,
  );
  const record = input.parseRecord(raw);
  const matches =
    record !== null &&
    (await verifyPasscodeAgainstRecord(record, input.passcode));
  if (matches) {
    await SecureStore.deleteItemAsync(input.attemptsKey, secureStoreOptions);
    return true;
  }
  if (delayMs > 0) {
    throw new PasscodeBackoffError({
      lockedUntilMs: attemptState.lockedUntilMs,
      remainingMs: delayMs,
    });
  }
  return false;
}

export async function verifyImportedRestingPasscode(
  passcode: string,
): Promise<boolean> {
  return verifyPasscodeWithLimiter({
    passcode,
    attemptsKey: IMPORTED_RESTING_APP_LOCK_ATTEMPTS_KEY,
    credentialKey: IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
    parseRecord: parseImportedRestingPasscodeRecord,
  });
}

/**
 * Reinstates the credential captured at imported sign-out. This deliberately
 * overwrites any general credential a later session created on the device.
 */
export async function restoreImportedRestingPasscode(): Promise<void> {
  const raw = await SecureStore.getItemAsync(
    IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
    secureStoreOptions,
  );
  if (parseImportedRestingPasscodeRecord(raw) === null || raw === null) {
    throw new Error('invalid_imported_resting_passcode');
  }
  await SecureStore.setItemAsync(
    APP_LOCK_CREDENTIAL_KEY,
    raw,
    secureStoreOptions,
  );
  await clearAppLockAttempts();
  await setAppLockPreference('passcode');
}

export type RemovePasscodeRequirement = 'bound' | 'general' | 'none';

/** Active Remove keeps today's general factor; a resting copy always wins. */
export async function getRemovePasscodeRequirement(): Promise<RemovePasscodeRequirement> {
  const boundRaw = await SecureStore.getItemAsync(
    IMPORTED_RESTING_APP_LOCK_CREDENTIAL_KEY,
    secureStoreOptions,
  );
  if (boundRaw !== null) {
    if (parseImportedRestingPasscodeRecord(boundRaw) === null) {
      throw new Error('invalid_imported_resting_passcode');
    }
    return 'bound';
  }
  return (await hasAppLockPasscode()) ? 'general' : 'none';
}

/** Never falls back to the replaceable general record when a bound copy exists. */
export async function verifyRemovePasscode(passcode: string): Promise<boolean> {
  const requirement = await getRemovePasscodeRequirement();
  if (requirement === 'bound') return verifyImportedRestingPasscode(passcode);
  if (requirement === 'general') return verifyAppLockPasscode(passcode);
  return false;
}

export async function getBiometricLabel(): Promise<string> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return resolveBiometricLabel({
    platform: Platform.OS,
    facial: types.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ),
    fingerprint: types.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    ),
  });
}

export async function hasBiometricHardware(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return compatible && enrolled;
}

/** Explicit enrolment read for setup flows; hardware alone cannot raise a prompt. */
export async function isBiometricEnrolled(): Promise<boolean> {
  return LocalAuthentication.isEnrolledAsync();
}

/** Compatibility alias used by existing settings surfaces. */
export const isLocalAuthAvailable = hasBiometricHardware;

export async function promptAppUnlock() {
  return LocalAuthentication.authenticateAsync({
    promptMessage: copy.lock.prompt,
    cancelLabel: copy.v1.cancel,
    biometricsSecurityLevel: 'strong',
    disableDeviceFallback: true,
    fallbackLabel: '',
  });
}
