import AsyncStorage from '@react-native-async-storage/async-storage';

export const ANALYTICS_INSTALL_ID_KEY = '@corso/analytics/anonymousId';

function randomId(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

let cachedAnonymousId: string | null = null;
/** Every rotation bumps it, so a read that started before one never lands. */
let generation = 0;

export async function getAnonymousId(): Promise<string> {
  if (cachedAnonymousId) return cachedAnonymousId;
  const started = generation;
  try {
    const existing = await AsyncStorage.getItem(ANALYTICS_INSTALL_ID_KEY);
    if (started !== generation) return getAnonymousId();
    if (existing && existing.length >= 8) {
      cachedAnonymousId = existing;
      return existing;
    }
    const next = randomId();
    await AsyncStorage.setItem(ANALYTICS_INSTALL_ID_KEY, next);
    if (started !== generation) return getAnonymousId();
    cachedAnonymousId = next;
    return next;
  } catch {
    if (started !== generation) return getAnonymousId();
    const fallback = randomId();
    cachedAnonymousId = fallback;
    return fallback;
  }
}

/**
 * Account deletion only. A new id replaces the old one in memory at once and
 * then on the phone. Throws when the phone refuses the new one, so the
 * deletion can retry it and report it: the old id would come back on the next
 * launch.
 */
export async function rotateAnalyticsInstallId(): Promise<void> {
  generation += 1;
  const next = randomId();
  cachedAnonymousId = next;
  await AsyncStorage.setItem(ANALYTICS_INSTALL_ID_KEY, next);
}

export function resetAnalyticsInstallIdCacheForTests(): void {
  generation += 1;
  cachedAnonymousId = null;
}
