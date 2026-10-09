import * as SecureStore from 'expo-secure-store';
import {
  isCredentialProvider,
  type CredentialProvider,
  type StoredCred,
} from '../types';

export const AI_CREDENTIAL_KEY_PREFIX = 'corso.ai.v1' as const;
export const AI_CREDENTIAL_INDEX_KEY =
  `${AI_CREDENTIAL_KEY_PREFIX}.index` as const;
/** Under the Android cap with headroom for SecureStore's own envelope. */
export const AI_CREDENTIAL_CHUNK_BYTES = 1_536;

export type SecureStoreOptions = {
  keychainAccessible?: number;
  requireAuthentication?: boolean;
};

export type SecureStoreLike = {
  getItemAsync(
    key: string,
    options?: SecureStoreOptions,
  ): Promise<string | null>;
  setItemAsync(
    key: string,
    value: string,
    options?: SecureStoreOptions,
  ): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>;
};

export type CredentialRef = Readonly<{
  provider: CredentialProvider;
  accountId: string;
}>;

export interface CredentialStore {
  list(): Promise<CredentialRef[]>;
  load(ref: CredentialRef): Promise<StoredCred | null>;
  save(cred: StoredCred): Promise<void>;
  remove(ref: CredentialRef): Promise<void>;
  saveIfUnchanged(cred: StoredCred, stamp: number): Promise<boolean>;
}

const writeStamps = new Map<string, number>();
const writeLocks = new Map<string, Promise<unknown>>();
let writeClock = 0;

export function credentialStamp(ref: CredentialRef): number {
  return writeStamps.get(credentialKeyBase(ref)) ?? 0;
}

function stampWrite(base: string): void {
  writeClock += 1;
  writeStamps.set(base, writeClock);
}

function withWriteLock<T>(base: string, body: () => Promise<T>): Promise<T> {
  const prior = writeLocks.get(base) ?? Promise.resolve();
  const run = prior.then(body, body);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  writeLocks.set(base, settled);
  void settled.then(() => {
    if (writeLocks.get(base) === settled) writeLocks.delete(base);
  });
  return run;
}

function lockedWrite<T>(ref: CredentialRef, body: () => Promise<T>): Promise<T> {
  const base = credentialKeyBase(ref);
  return withWriteLock(base, () => {
    stampWrite(base);
    return body();
  });
}

/** Shared by every `CredentialStore`: the CAS, decided inside the lock. */
function lockedCas(
  cred: StoredCred,
  stamp: number,
  body: () => Promise<void>,
): Promise<boolean> {
  const base = credentialKeyBase(cred);
  return withWriteLock(base, async () => {
    if ((writeStamps.get(base) ?? 0) !== stamp) return false;
    stampWrite(base);
    await body();
    return true;
  });
}

const OPTIONS: SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function credentialKeyBase(ref: CredentialRef): string {
  const safeAccount = ref.accountId.replace(/[^A-Za-z0-9._-]/g, '_');
  return `${AI_CREDENTIAL_KEY_PREFIX}.${ref.provider}.${safeAccount}`;
}

export function chunkText(
  text: string,
  size: number = AI_CREDENTIAL_CHUNK_BYTES,
): string[] {
  if (size <= 0) throw new Error('chunk size must be positive');
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size)
    chunks.push(text.slice(i, i + size));
  return chunks.length === 0 ? [''] : chunks;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function optionalString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function cloneCred(cred: StoredCred): StoredCred {
  return Object.freeze({
    provider: cred.provider,
    accountId: cred.accountId,
    authKind: cred.authKind,
    accessToken: cred.accessToken,
    refreshToken: cred.refreshToken,
    expiresAtMs: cred.expiresAtMs,
    scopes: Object.freeze([...cred.scopes]),
    planTier: cred.planTier,
    label: cred.label,
    invalidatedAt: cred.invalidatedAt,
    entitlementBlockedAt: cred.entitlementBlockedAt,
  });
}

/** Fail-closed parse: any field of the wrong shape refuses the record. */
export function parseStoredCred(raw: string): StoredCred | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) return null;
  if (!isCredentialProvider(parsed.provider)) return null;
  if (typeof parsed.accountId !== 'string' || parsed.accountId.length === 0)
    return null;
  if (
    parsed.authKind !== 'oauth' &&
    parsed.authKind !== 'setupToken' &&
    parsed.authKind !== 'apiKey'
  ) {
    return null;
  }
  if (typeof parsed.accessToken !== 'string' || parsed.accessToken.length === 0)
    return null;
  const refreshToken = optionalString(parsed.refreshToken);
  if (refreshToken === undefined) return null;
  if (
    typeof parsed.expiresAtMs !== 'number' ||
    !Number.isFinite(parsed.expiresAtMs)
  )
    return null;
  if (
    !Array.isArray(parsed.scopes) ||
    !parsed.scopes.every((s) => typeof s === 'string')
  ) {
    return null;
  }
  const planTier = optionalString(parsed.planTier);
  const label = optionalString(parsed.label);
  const invalidatedAt = optionalNumber(parsed.invalidatedAt);
  const entitlementBlockedAt = optionalNumber(parsed.entitlementBlockedAt);
  if (
    planTier === undefined ||
    label === undefined ||
    invalidatedAt === undefined ||
    entitlementBlockedAt === undefined
  ) {
    return null;
  }
  return cloneCred({
    provider: parsed.provider,
    accountId: parsed.accountId,
    authKind: parsed.authKind,
    accessToken: parsed.accessToken,
    refreshToken,
    expiresAtMs: parsed.expiresAtMs,
    scopes: parsed.scopes as string[],
    planTier,
    label,
    invalidatedAt,
    entitlementBlockedAt,
  });
}

export function serializeStoredCred(cred: StoredCred): string {
  const c = cloneCred(cred);
  return JSON.stringify({
    provider: c.provider,
    accountId: c.accountId,
    authKind: c.authKind,
    accessToken: c.accessToken,
    refreshToken: c.refreshToken,
    expiresAtMs: c.expiresAtMs,
    scopes: [...c.scopes],
    planTier: c.planTier,
    label: c.label,
    invalidatedAt: c.invalidatedAt,
    entitlementBlockedAt: c.entitlementBlockedAt,
  });
}

function parseIndex(raw: string | null): CredentialRef[] {
  if (raw == null || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const refs: CredentialRef[] = [];
  for (const entry of parsed) {
    if (!isPlainObject(entry)) continue;
    if (!isCredentialProvider(entry.provider)) continue;
    if (typeof entry.accountId !== 'string' || entry.accountId.length === 0)
      continue;
    refs.push(
      Object.freeze({ provider: entry.provider, accountId: entry.accountId }),
    );
  }
  return refs;
}

function parseHeader(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(parsed) || parsed.v !== 1) return null;
  const chunks = parsed.chunks;
  if (
    typeof chunks !== 'number' ||
    !Number.isInteger(chunks) ||
    chunks < 1 ||
    chunks > 256
  ) {
    return null;
  }
  return chunks;
}

function sameRef(a: CredentialRef, b: CredentialRef): boolean {
  return a.provider === b.provider && a.accountId === b.accountId;
}

export function createSecureStoreCredentialStore(
  secureStore: SecureStoreLike = SecureStore,
  chunkBytes: number = AI_CREDENTIAL_CHUNK_BYTES,
): CredentialStore {
  async function readIndex(): Promise<CredentialRef[]> {
    return parseIndex(
      await secureStore.getItemAsync(AI_CREDENTIAL_INDEX_KEY, OPTIONS),
    );
  }

  async function writeIndex(refs: CredentialRef[]): Promise<void> {
    if (refs.length === 0) {
      await deleteAndVerify(AI_CREDENTIAL_INDEX_KEY);
      return;
    }
    await secureStore.setItemAsync(
      AI_CREDENTIAL_INDEX_KEY,
      JSON.stringify(
        refs.map((r) => ({ provider: r.provider, accountId: r.accountId })),
      ),
      OPTIONS,
    );
  }

  async function deleteAndVerify(key: string): Promise<void> {
    await secureStore.deleteItemAsync(key, OPTIONS);
    if ((await secureStore.getItemAsync(key, OPTIONS)) !== null) {
      throw new Error('SecureStore item could not be deleted.');
    }
  }

  async function wipeRecord(
    base: string,
    chunks: number | null,
  ): Promise<void> {
    const upper = Math.max(chunks ?? 0, 256);
    let failed = false;
    for (let i = 0; i < upper; i += 1) {
      try {
        await deleteAndVerify(`${base}.${i}`);
      } catch {
        failed = true;
      }
    }
    try {
      await deleteAndVerify(base);
    } catch {
      failed = true;
    }
    if (failed) {
      throw new Error('Credential record could not be deleted from SecureStore.');
    }
  }

  async function saveBody(cred: StoredCred): Promise<void> {
    const base = credentialKeyBase(cred);
    const previous = parseHeader(await secureStore.getItemAsync(base, OPTIONS));
    const parts = chunkText(serializeStoredCred(cred), chunkBytes);
    // Chunks first, header last: a crash between them leaves no header, so
    // the next read sees "absent" rather than a torn record.
    for (let i = 0; i < parts.length; i += 1) {
      await secureStore.setItemAsync(`${base}.${i}`, parts[i]!, OPTIONS);
    }
    await secureStore.setItemAsync(
      base,
      JSON.stringify({ v: 1, chunks: parts.length }),
      OPTIONS,
    );
    if (previous !== null && previous > parts.length) {
      for (let i = parts.length; i < previous; i += 1) {
        await deleteAndVerify(`${base}.${i}`);
      }
    }
    const index = await readIndex();
    if (!index.some((r) => sameRef(r, cred))) {
      await writeIndex([
        ...index,
        { provider: cred.provider, accountId: cred.accountId },
      ]);
    }
  }

  async function removeBody(ref: CredentialRef): Promise<void> {
    const base = credentialKeyBase(ref);
    const chunks = parseHeader(await secureStore.getItemAsync(base, OPTIONS));
    await wipeRecord(base, chunks);
    const index = await readIndex();
    await writeIndex(index.filter((r) => !sameRef(r, ref)));
  }

  return {
    async list() {
      return readIndex();
    },

    async load(ref) {
      const base = credentialKeyBase(ref);
      const chunks = parseHeader(await secureStore.getItemAsync(base, OPTIONS));
      if (chunks === null) return null;
      const parts: string[] = [];
      for (let i = 0; i < chunks; i += 1) {
        const part = await secureStore.getItemAsync(`${base}.${i}`, OPTIONS);
        if (part == null) {
          await wipeRecord(base, chunks);
          return null;
        }
        parts.push(part);
      }
      const cred = parseStoredCred(parts.join(''));
      if (!cred || !sameRef(cred, ref)) {
        await wipeRecord(base, chunks);
        return null;
      }
      return cred;
    },

    save(cred) {
      return lockedWrite(cred, () => saveBody(cred));
    },

    saveIfUnchanged(cred, stamp) {
      return lockedCas(cred, stamp, () => saveBody(cred));
    },

    remove(ref) {
      return lockedWrite(ref, () => removeBody(ref));
    },
  };
}

export function createMemoryCredentialStore(
  initial: StoredCred[] = [],
): CredentialStore {
  const records = new Map<string, StoredCred>();
  for (const cred of initial)
    records.set(credentialKeyBase(cred), cloneCred(cred));
  return {
    async list() {
      return [...records.values()].map((c) => ({
        provider: c.provider,
        accountId: c.accountId,
      }));
    },
    async load(ref) {
      const found = records.get(credentialKeyBase(ref));
      return found ? cloneCred(found) : null;
    },
    save(cred) {
      return lockedWrite(cred, async () => {
        records.set(credentialKeyBase(cred), cloneCred(cred));
      });
    },
    saveIfUnchanged(cred, stamp) {
      return lockedCas(cred, stamp, async () => {
        records.set(credentialKeyBase(cred), cloneCred(cred));
      });
    },
    remove(ref) {
      return lockedWrite(ref, async () => {
        records.delete(credentialKeyBase(ref));
      });
    },
  };
}
