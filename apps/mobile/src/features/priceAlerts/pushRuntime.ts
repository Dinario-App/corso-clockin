import * as SecureStore from 'expo-secure-store';
import {
  createPushRegistration,
  PUSH_TOKEN_KEY,
  PUSH_ACTIVE_KEY,
  PUSH_PENDING_KEY,
} from './pushRegistration';
import { readPushFlags, revokePushRow, confirmPushRow, checkPushRow } from './pushClient';
// Explicit literals keep storage ownership checkable. No authentication-bound
// storage: deletion authority must remain usable on locked sign-out.
const storage = {
  async get(key: string) {
    if (key === PUSH_TOKEN_KEY) return SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (key === PUSH_ACTIVE_KEY)
      return SecureStore.getItemAsync(PUSH_ACTIVE_KEY);
    if (key === PUSH_PENDING_KEY)
      return SecureStore.getItemAsync(PUSH_PENDING_KEY);
    throw Error('push_storage_key');
  },
  async set(key: string, value: string) {
    if (key === PUSH_TOKEN_KEY)
      return SecureStore.setItemAsync(PUSH_TOKEN_KEY, value);
    if (key === PUSH_ACTIVE_KEY)
      return SecureStore.setItemAsync(PUSH_ACTIVE_KEY, value);
    if (key === PUSH_PENDING_KEY)
      return SecureStore.setItemAsync(PUSH_PENDING_KEY, value);
    throw Error('push_storage_key');
  },
  async remove(key: string) {
    if (key === PUSH_TOKEN_KEY)
      return SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    if (key === PUSH_ACTIVE_KEY)
      return SecureStore.deleteItemAsync(PUSH_ACTIVE_KEY);
    if (key === PUSH_PENDING_KEY)
      return SecureStore.deleteItemAsync(PUSH_PENDING_KEY);
    throw Error('push_storage_key');
  },
};
export const priceAlertPush = createPushRegistration({
  storage,
  flags: async () => {
    const flags = await readPushFlags();
    return {
      priceAlertsEnabled: flags.priceAlertsEnabled === true,
      pricesEnabled: flags.pricesEnabled === true,
    };
  },
  ask: async () => {
    const native = await import('./pushNative');
    return native.askForAlertPush();
  },
  permission: async () => {
    const native = await import('./pushNative');
    return native.allowAlertPush();
  },
  token: async () => {
    const native = await import('./pushNative');
    return native.readAlertPushToken();
  },
  register: async () => {
    throw Error('push_owner_required');
  },
  confirm: confirmPushRow,
  status: checkPushRow,
  granted: async () => {
    const native = await import('./pushNative');
    return native.hasAlertPushPermission();
  },
  revoke: revokePushRow,
});
export const clearPriceAlertPushOnTeardown = () =>
  priceAlertPush.clearOnTeardown();
export const retryPriceAlertPushRevocations = () =>
  priceAlertPush.retryPending();
