import AsyncStorage from '@react-native-async-storage/async-storage';
const listeners = new Set<() => void>();
export const DELEGATION_MARKER_PREFIX = 'corso.delegation-markers.v1:';
const key = (wallet: string) => `${DELEGATION_MARKER_PREFIX}${wallet}`;
export async function readDelegationMarkers(wallet: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(key(wallet));
  if (!raw) return [];
  try {
    const ids: unknown = JSON.parse(raw);
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}
let writes = Promise.resolve();
function update(
  wallet: string,
  change: (ids: string[]) => string[],
): Promise<void> {
  const next = writes
    .catch(() => {})
    .then(async () => {
      await AsyncStorage.setItem(
        key(wallet),
        JSON.stringify(change(await readDelegationMarkers(wallet))),
      );
      for (const listener of listeners) listener();
    });
  writes = next;
  return next;
}
export function rememberDelegation(wallet: string, id: string) {
  return update(wallet, (ids) => [...new Set([...ids, id])]);
}
/** Caller must have the server's confirmed revoke receipt for this delegation. */
export function forgetConfirmedRevocation(wallet: string, id: string) {
  return update(wallet, (ids) => ids.filter((value) => value !== id));
}
export function subscribeDelegationMarkers(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Account deletion removes personal local data, not the on-chain permission. */
export async function clearDelegationMarkersOnAccountDeletion() {
  await writes.catch(() => {});
  const keys = (await AsyncStorage.getAllKeys()).filter((value) =>
    value.startsWith(DELEGATION_MARKER_PREFIX),
  );
  if (keys.length) await AsyncStorage.multiRemove(keys);
  for (const listener of listeners) listener();
}
