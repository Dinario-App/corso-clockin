import { clearAlertTapEntry } from './alertTapEntry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearWaitAlertEntry, type WaitAlertEntry } from './waitEntry';
export const ALERT_PRESETS_KEY = 'corso.priceAlert.presets.v1';
export type AlertPreset = Omit<WaitAlertEntry, 'owner'> & {
  walletAddress: string;
};
let tail = Promise.resolve();
function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = tail.then(work);
  tail = result.then(
    () => {},
    () => {},
  );
  return result;
}
async function rows(): Promise<Record<string, AlertPreset>> {
  const raw = await AsyncStorage.getItem(ALERT_PRESETS_KEY);
  if (!raw) return {};
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('alert_preset_invalid');
  return value;
}
export function saveAlertPreset(
  id: string,
  entry: WaitAlertEntry,
  assertCurrent: () => void,
) {
  return serialized(async () => {
    assertCurrent();
    const all = await rows();
    assertCurrent();
    all[id] = {
      walletAddress: entry.owner.address,
      mint: entry.mint,
      symbol: entry.symbol,
      cluster: entry.cluster,
      preset: entry.preset,
    };
    await AsyncStorage.setItem(ALERT_PRESETS_KEY, JSON.stringify(all));
  });
}
export function readAlertPresets(walletAddress: string) {
  return serialized(async () =>
    Object.fromEntries(
      Object.entries(await rows()).filter(
        ([, value]) => value.walletAddress === walletAddress,
      ),
    ),
  );
}
export function removeAlertPreset(id: string, walletAddress: string) {
  return serialized(async () => {
    const all = await rows();
    if (all[id]?.walletAddress === walletAddress) {
      delete all[id];
      await AsyncStorage.setItem(ALERT_PRESETS_KEY, JSON.stringify(all));
    }
  });
}
export function clearAlertPresets() {
  clearWaitAlertEntry();
  clearAlertTapEntry();
  return serialized(() => AsyncStorage.removeItem(ALERT_PRESETS_KEY));
}
