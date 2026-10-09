import * as SecureStore from 'expo-secure-store';
import {
  bootPerUserReadsMayOpen,
  isPendingSignOutClearArmed,
} from '../session/pendingSignOutClear';
import {
  parseStatusCredential,
  type StatusCredential,
  type StatusScope,
} from './statusAuthorization';

/** One active identity per app: a single scoped record needs no separate index. */
export const STATUS_CREDENTIAL_KEY = 'corso.rampStatusCredential.v1';
const options = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};
let generation = 0;
let blocked = false;
export const statusReadsBlocked = () => blocked;
let memory: StatusCredential | null = null;
let rejectedCredentialId: string | null = null;
export const statusRequiresReproof = () => rejectedCredentialId !== null;
let storageTail: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const requests = new Set<AbortController>();
export const statusGeneration = () => generation;
export function subscribeStatusCredential(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function trackStatusRequest(controller: AbortController): () => void {
  requests.add(controller);
  return () => {
    requests.delete(controller);
  };
}
function announce(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* Notification cannot block clearing. */
    }
  }
}
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const task = storageTail.then(operation, operation);
  storageTail = task.catch(() => undefined);
  return task;
}
export async function saveStatusCredential(
  value: StatusCredential,
  isCurrent: () => boolean,
): Promise<boolean> {
  const attempt = generation;
  const current = () =>
    !blocked &&
    attempt === generation &&
    isCurrent() &&
    !isPendingSignOutClearArmed();
  if (!parseStatusCredential(value, value) || !current()) return false;
  return serialize(async () => {
    if (!current()) return false;
    await SecureStore.setItemAsync(
      STATUS_CREDENTIAL_KEY,
      JSON.stringify(value),
      options,
    );
    if (!current()) {
      await SecureStore.deleteItemAsync(STATUS_CREDENTIAL_KEY, options);
      return false;
    }
    memory = value;
    rejectedCredentialId = null;
    announce();
    return true;
  });
}
export async function readStatusCredential(
  scope: StatusScope,
  isCurrent: () => boolean,
): Promise<StatusCredential | null> {
  const attempt = generation;
  const current = () =>
    !blocked &&
    attempt === generation &&
    isCurrent() &&
    !isPendingSignOutClearArmed();
  if (!current() || !(await bootPerUserReadsMayOpen()) || !current())
    return null;
  await storageTail;
  try {
    const raw = await SecureStore.getItemAsync(STATUS_CREDENTIAL_KEY, options);
    if (!raw || !current()) return null;
    const value = parseStatusCredential(JSON.parse(raw), scope);
    if (value?.credentialId === rejectedCredentialId) return null;
    if (!current()) return null;
    memory = value;
    return value;
  } catch {
    return null;
  }
}
export async function rejectStatusCredential(
  credential: StatusCredential,
): Promise<void> {
  rejectedCredentialId = credential.credentialId;
  await clearStatusCredential();
}
export async function clearStatusCredential(): Promise<void> {
  blocked = true;
  memory = null;
  generation++;
  for (const controller of requests) controller.abort();
  requests.clear();
  announce();
  await serialize(async () => {
    await SecureStore.deleteItemAsync(STATUS_CREDENTIAL_KEY, options);
    if (
      (await SecureStore.getItemAsync(STATUS_CREDENTIAL_KEY, options)) !== null
    ) {
      throw new Error('Status credential clear incomplete');
    }
  });
  blocked = false;
  announce();
}
/** Synchronous invalidation; the one request cannot block the existing sign-out ceremony. */
export function beginStatusSignOut(): void {
  blocked = true;
  let credential = memory;
  memory = null;
  rejectedCredentialId = null;
  generation++;
  for (const controller of requests) controller.abort();
  requests.clear();
  announce();
  if (!credential) return;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 2000);
  try {
    void fetch(`${credential.audience}/v1/ramps/status/revoke`, {
      method: 'POST',
      headers: { Authorization: `RampStatus ${credential.token}` },
      redirect: 'error',
      signal: controller.signal,
    }).then(
      () => clearTimeout(deadline),
      () => clearTimeout(deadline),
    );
  } catch {
    clearTimeout(deadline);
  } finally {
    credential = null;
  }
}
