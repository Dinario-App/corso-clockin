import {
  parseDisclosureSet,
  type DisclosureSet,
  type DisclosureSetFailure,
} from '@corso/disclosures';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scrubProviderErrorMessage } from '@/src/lib/analyticsScrub';
import {
  loadCachedDisclosureSet,
  writeCachedDisclosureSet,
  type DisclosureCacheStorage,
} from './disclosureCache';

export type DisclosureReadiness =
  | { disclosuresReady: true; set: DisclosureSet }
  | { disclosuresReady: false; set: null; reason: DisclosureSetFailure };

function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export function resolveDisclosureReadiness(body: unknown): DisclosureReadiness {
  const result = parseDisclosureSet(body);
  if (!result.ok) {
    return { disclosuresReady: false, set: null, reason: result.reason };
  }
  return { disclosuresReady: true, set: result.set };
}

let lastKnownGoodSet: DisclosureSet | null = null;

let cacheStorage: DisclosureCacheStorage = AsyncStorage;
let rehydrated: Promise<void> | null = null;

async function rehydrateOnce(): Promise<void> {
  if (rehydrated) return rehydrated;
  rehydrated = (async () => {
    const cached = await loadCachedDisclosureSet(cacheStorage);
    // A live read that landed first always wins — it is newer by definition.
    if (cached && !lastKnownGoodSet) lastKnownGoodSet = cached;
  })();
  return rehydrated;
}

export function __resetDisclosureCacheForTests(
  storage: DisclosureCacheStorage = emptyStore(),
): void {
  lastKnownGoodSet = null;
  cacheStorage = storage;
  rehydrated = null;
}

function emptyStore(): DisclosureCacheStorage {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
  };
}

export function __getLastKnownGoodDisclosureSetForTests(): DisclosureSet | null {
  return lastKnownGoodSet;
}

/**
 * Fetch and validate the disclosure set.
 *
 * Returns `disclosuresReady: false` on every failure path and never throws, so
 * a caller cannot accidentally treat a rejected promise as a pass.
 */
export async function resolveDisclosures(): Promise<DisclosureReadiness> {
  await rehydrateOnce();
  const base = apiBaseUrl();
  let body: unknown = null;

  if (!base) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(
        '[disclosures] EXPO_PUBLIC_API_URL missing. Acquire doors fail closed.',
      );
    }
  } else {
    try {
      const response = await fetch(`${base}/v1/disclosures`);
      if (!response.ok) {
        throw new Error(`disclosures HTTP ${response.status}`);
      }
      body = await response.json();
    } catch (error) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          '[disclosures] GET /v1/disclosures failed',
          base,
          scrubProviderErrorMessage(error),
        );
      }
      body = null;
    }
  }

  const readiness = resolveDisclosureReadiness(body);
  if (readiness.disclosuresReady) {
    lastKnownGoodSet = readiness.set;
    // Fire-and-forget: the answer is already in hand and a slow write must not
    // hold a door shut. `writeCachedDisclosureSet` never throws.
    void writeCachedDisclosureSet(cacheStorage, readiness.set);
    return readiness;
  }

  if (lastKnownGoodSet) {
    return { disclosuresReady: true, set: lastKnownGoodSet };
  }
  return readiness;
}
