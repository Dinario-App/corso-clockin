import { parseDisclosureSet, type DisclosureSet } from '@corso/disclosures';

export const DISCLOSURE_CACHE_KEY = '@corso/disclosures/lastKnownGood/v1';

export type DisclosureCacheStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/** The exact JSON shape `GET /v1/disclosures` returns. Nothing added. */
export function serializeDisclosureSet(set: DisclosureSet): string {
  return JSON.stringify({
    disclaimer: set.disclaimer,
    disclosures: set.disclosures,
  });
}

/**
 * Raw stored bytes → a set, or `null`.
 *
 * `null` for every failure: absent, unparseable JSON, or a payload that no
 * longer satisfies `parseDisclosureSet`. There is deliberately no reason code —
 * a caller cannot do anything different with "the cache was corrupt" than with
 * "the cache was empty", and offering the distinction invites someone to treat
 * one of them as partial success.
 */
export function readCachedDisclosureSet(
  raw: string | null,
): DisclosureSet | null {
  if (raw === null) return null;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = parseDisclosureSet(body);
  return result.ok ? result.set : null;
}

/**
 * Persist a set that has ALREADY been validated by the caller.
 *
 * Never throws. A device that cannot write — storage full, a locked keychain —
 * still has a working app and a working in-memory cache; losing the offline
 * copy is not worth failing a disclosure fetch over.
 */
export async function writeCachedDisclosureSet(
  storage: DisclosureCacheStorage,
  set: DisclosureSet,
): Promise<void> {
  try {
    await storage.setItem(DISCLOSURE_CACHE_KEY, serializeDisclosureSet(set));
  } catch {
    /* An unwritable cache is a lost convenience, not a failed gate. */
  }
}

/** Read and re-validate. Never throws; an unreadable store is an empty one. */
export async function loadCachedDisclosureSet(
  storage: DisclosureCacheStorage,
): Promise<DisclosureSet | null> {
  try {
    return readCachedDisclosureSet(await storage.getItem(DISCLOSURE_CACHE_KEY));
  } catch {
    return null;
  }
}
