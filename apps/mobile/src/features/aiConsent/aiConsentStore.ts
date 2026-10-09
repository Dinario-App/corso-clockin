import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import {
  isCredentialProvider,
  type CredentialProvider,
} from '@/src/features/aiConnect/types';
import { clearConsentScopedState } from './consentScopedClear';

/** Registered in `localClearRegistry.ts`. */
export const AI_CONSENT_STORAGE_KEY = 'corso.aiConsent.v1';
export const DEFAULT_ASSISTANT_CONSENT_VERSION = 1;
export const CONNECTED_AI_CONSENT_VERSION = 1;
/** `submitAsk` waits at most this long for the first read; a timeout reads as not consented. */
export const AI_CONSENT_HYDRATE_TIMEOUT_MS = 500;

const BLOB_VERSION = 1;
/** Written when the phone refuses the removal: it names no wallet, so it grants nothing. */
const TOMBSTONE = Object.freeze({ v: BLOB_VERSION, owner: null });

export type DefaultAssistantDecision = 'allowed' | 'declined';

export type AiConsentStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type DefaultAssistantRecord = Readonly<{
  decision: DefaultAssistantDecision;
  consentVersion: number;
  at: string;
}>;

type ConnectedRecord = Readonly<{ consentVersion: number; acceptedAt: string }>;

type AiConsentBlob = Readonly<{
  v: typeof BLOB_VERSION;
  owner: string;
  defaultAssistant?: DefaultAssistantRecord;
  connected: Readonly<Partial<Record<CredentialProvider, ConnectedRecord>>>;
}>;

/**
 * Why a record did not reach the phone. Only `write_failed` may lead to a
 * single-use permission.
 * - `write_failed`: the phone refused the write, for the wallet that asked.
 * - `read_failed`: the phone could not be read, so nothing is ever written.
 * - `not_hydrated`: the read for this wallet has not finished.
 * - `unbound`: no wallet is signed in.
 * - `stale_owner`: the wallet changed, or consent was cleared, while it waited.
 * - `withdrawn`: a forget or a "Not now" came after this Allow started, so the
 *   withdrawal wins even though this write failed later.
 * - `invalid`: not a decision or not a provider this store knows.
 */
export type AiConsentWriteFailure =
  | 'write_failed'
  | 'revoke_unsafe'
  | 'read_failed'
  | 'not_hydrated'
  | 'unbound'
  | 'stale_owner'
  | 'withdrawn'
  | 'invalid';

export type AiConsentWriteResult =
  | Readonly<{ persisted: true }>
  | Readonly<{ persisted: false; reason: AiConsentWriteFailure }>;

/**
 * Consent held for one send. `stillValid()` is true only while the same wallet
 * is bound, nothing was cleared, the consent was not withdrawn and (unless a
 * single-use permission paid for it) the record still reads current.
 */
export type AiConsentLease = Readonly<{
  kind: 'default_assistant' | 'connected';
  provider: CredentialProvider | null;
  owner: string;
  requestId: string;
  stillValid: () => boolean;
}>;

export type AiConsentOwnerBinding = Readonly<{
  owner: string;
  stillCurrent: () => boolean;
}>;

const PERSISTED: AiConsentWriteResult = Object.freeze({ persisted: true });

function notPersisted(reason: AiConsentWriteFailure): AiConsentWriteResult {
  return Object.freeze({ persisted: false, reason });
}

type Binding = Readonly<{ owner: string; generation: number }>;
/** A single-use permission. Always for one question: there is no unclaimed kind. */
type SingleUse = Readonly<{
  owner: string;
  generation: number;
  requestId: string;
}>;
/** The right to grant one: the Allow's wallet and generation, and the consent revision it started under. */
type Grantable = Readonly<{
  owner: string;
  generation: number;
  revision: number;
}>;
type RevisionKey = 'default' | CredentialProvider;

let boundOwner: string | null = null;
let boundStorage: AiConsentStorage = AsyncStorage;
/** The wallet whose read has finished. Readers need it to equal `boundOwner`. */
let hydratedOwner: string | null = null;
/** Session-only. A failed read makes every reader false and skips every write. */
let readFailed = false;
let blob: AiConsentBlob | null = null;
let hydration: Promise<void> | null = null;
/**
 * Bumped by every change of wallet and every clear. A read or a write that
 * started before one lands after it; it is dropped, never merged back in.
 */
let generation = 0;
let connectedAuthority = 0;
let singleUseDefault: SingleUse | null = null;
const singleUseConnected = new Map<CredentialProvider, SingleUse>();
/** Minted only by a `write_failed` record; turned into a permission once, by the grant. */
let grantableDefault: Grantable | null = null;
const grantableConnected = new Map<CredentialProvider, Grantable>();
/**
 * Bumped when consent is withdrawn without a clear (a forget, a decline), so
 * leases taken before it die and an Allow that started before it never grants.
 */
const revisions = new Map<RevisionKey, number>();
/**
 * A clear the phone refused: memory is empty but the old blob may still be on
 * disk. Until a later write or clear lands, a forget clears again rather than
 * trusting the empty memory.
 */
let clearUnfinished = false;
/** Disk writes and the clear run one at a time, so a clear never races a write already on its way. */
let diskQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

/* ─── Parsing ───────────────────────────────────────────────────────────────── */

function rec(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isStamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

function parseDefault(value: unknown): DefaultAssistantRecord | undefined {
  const body = rec(value);
  if (!body) return undefined;
  if (body.decision !== 'allowed' && body.decision !== 'declined')
    return undefined;
  if (!isVersion(body.consentVersion) || !isStamp(body.at)) return undefined;
  return {
    decision: body.decision,
    consentVersion: body.consentVersion,
    at: body.at,
  };
}

function parseConnected(
  value: unknown,
): Partial<Record<CredentialProvider, ConnectedRecord>> {
  const body = rec(value);
  const connected: Partial<Record<CredentialProvider, ConnectedRecord>> = {};
  if (!body) return connected;
  for (const [provider, entry] of Object.entries(body)) {
    const record = rec(entry);
    if (!isCredentialProvider(provider) || !record) continue;
    if (!isVersion(record.consentVersion) || !isStamp(record.acceptedAt))
      continue;
    connected[provider] = {
      consentVersion: record.consentVersion,
      acceptedAt: record.acceptedAt,
    };
  }
  return connected;
}

/**
 * Hostile-safe. Unknown fields are not copied and a malformed record is
 * dropped. A blob that is not `v: 1` with a wallet `owner` reads as none.
 * JSON that cannot be parsed throws: that is a read failure, not an empty
 * record, so it never gets overwritten.
 */
function parseAiConsentBlob(raw: string | null): AiConsentBlob | null {
  if (raw === null) return null;
  const body = rec(JSON.parse(raw) as unknown);
  if (!body || body.v !== BLOB_VERSION) return null;
  if (typeof body.owner !== 'string' || body.owner.length === 0) return null;
  const defaultAssistant = parseDefault(body.defaultAssistant);
  return {
    v: BLOB_VERSION,
    owner: body.owner,
    ...(defaultAssistant ? { defaultAssistant } : {}),
    connected: parseConnected(body.connected),
  };
}

/* ─── Bindings ──────────────────────────────────────────────────────────────── */

function emit(): void {
  for (const listener of listeners) listener();
}

function captured(): Binding | null {
  return boundOwner === null
    ? null
    : Object.freeze({ owner: boundOwner, generation });
}

function isCurrent(binding: Binding | null | undefined): binding is Binding {
  return (
    binding !== null &&
    binding !== undefined &&
    binding.owner === boundOwner &&
    binding.generation === generation
  );
}

function revisionOf(key: RevisionKey): number {
  return revisions.get(key) ?? 0;
}

function withdraw(key: RevisionKey): void {
  revisions.set(key, revisionOf(key) + 1);
  if (key !== 'default') connectedAuthority += 1;
}

/** Every single-use permission, and every right to grant one. */
function dropSingleUse(): void {
  singleUseDefault = null;
  singleUseConnected.clear();
  grantableDefault = null;
  grantableConnected.clear();
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** A live permission granted for exactly this question. */
function claimable(
  token: SingleUse | null | undefined,
  requestId: string | null | undefined,
): boolean {
  return (
    isCurrent(token) && isNonEmpty(requestId) && token.requestId === requestId
  );
}

/** Still the Allow's to grant: same wallet and generation, and nothing withdrawn since it started. */
function isGrantable(
  grant: Grantable | null | undefined,
  key: RevisionKey,
): grant is Grantable {
  return isCurrent(grant) && revisionOf(key) === grant.revision;
}

/* ─── Readers ───────────────────────────────────────────────────────────────── */

/** The blob, only when every check holds. */
function ownedBlob(): AiConsentBlob | null {
  if (boundOwner === null || hydratedOwner !== boundOwner || readFailed)
    return null;
  return blob !== null && blob.owner === boundOwner ? blob : null;
}

function grantsDefault(source: AiConsentBlob | null): boolean {
  const record = source?.defaultAssistant;
  return (
    record?.decision === 'allowed' &&
    record.consentVersion === DEFAULT_ASSISTANT_CONSENT_VERSION
  );
}

function grantsConnected(
  source: AiConsentBlob | null,
  provider: CredentialProvider,
): boolean {
  return (
    source?.connected[provider]?.consentVersion === CONNECTED_AI_CONSENT_VERSION
  );
}

export function hasDefaultModelConsent(requestId?: string): boolean {
  if (claimable(singleUseDefault, requestId)) return true;
  return grantsDefault(ownedBlob());
}

/**
 * For UI routing only (show the sheet, or the explainer). Anything that is not
 * a current, readable record for this wallet reads `'unset'`, so the sheet is
 * asked again.
 */
export function defaultConsentDecision(): 'unset' | DefaultAssistantDecision {
  const record = ownedBlob()?.defaultAssistant;
  if (!record || record.consentVersion !== DEFAULT_ASSISTANT_CONSENT_VERSION)
    return 'unset';
  return record.decision;
}

/**
 * May a question go to this connected AI? Pure, like `hasDefaultModelConsent`:
 * a single-use permission reads true only for the question it was granted for.
 */
export function hasConnectedConsent(
  provider: CredentialProvider,
  requestId?: string,
): boolean {
  if (claimable(singleUseConnected.get(provider), requestId)) return true;
  return grantsConnected(ownedBlob(), provider);
}

/** Capture the wallet a sheet is raised or answered for, to check again after any await. */
export function captureAiConsentOwner(): AiConsentOwnerBinding | null {
  const binding = captured();
  if (binding === null) return null;
  const authority = connectedAuthority;
  return Object.freeze({
    owner: binding.owner,
    stillCurrent: () => isCurrent(binding) && connectedAuthority === authority,
  });
}

export function subscribeAiConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* ─── Leases (for sends) ────────────────────────────────────────────────────── */

function makeLease(
  provider: CredentialProvider | null,
  owner: string,
  requestId: string,
  viaSingleUse: boolean,
): AiConsentLease {
  const epoch = generation;
  const key: RevisionKey = provider ?? 'default';
  const revision = revisionOf(key);
  return Object.freeze({
    kind: provider === null ? 'default_assistant' : 'connected',
    provider,
    owner,
    requestId,
    stillValid: () => {
      if (
        boundOwner !== owner ||
        generation !== epoch ||
        revisionOf(key) !== revision
      )
        return false;
      if (viaSingleUse) return true;
      return provider === null
        ? grantsDefault(ownedBlob())
        : grantsConnected(ownedBlob(), provider);
    },
  });
}

function isLeaseRequest(expectedOwner: unknown, requestId: unknown): boolean {
  return isNonEmpty(expectedOwner) && isNonEmpty(requestId);
}

export function acquireDefaultConsentLease(
  expectedOwner: string,
  requestId: string,
): AiConsentLease | null {
  if (!isLeaseRequest(expectedOwner, requestId)) return null;
  const token = singleUseDefault;
  if (token !== null) {
    singleUseDefault = null;
    emit();
  }
  if (boundOwner === null || expectedOwner !== boundOwner) return null;
  const owner = boundOwner;
  const persisted = grantsDefault(ownedBlob());
  const viaSingleUse = !persisted && claimable(token, requestId);
  if (!persisted && !viaSingleUse) return null;
  return makeLease(null, owner, requestId, viaSingleUse);
}

/**
 * The same, for one connected AI and one take (`requestId`). The ladder takes
 * one per provider per take and checks `stillValid()` before every dial and
 * before it accepts an answer.
 */
export function acquireConnectedConsentLease(
  provider: CredentialProvider,
  expectedOwner: string,
  requestId: string,
): AiConsentLease | null {
  if (
    !isCredentialProvider(provider) ||
    !isLeaseRequest(expectedOwner, requestId)
  )
    return null;
  const token = singleUseConnected.get(provider) ?? null;
  if (token !== null) {
    singleUseConnected.delete(provider);
    emit();
  }
  if (boundOwner === null || expectedOwner !== boundOwner) return null;
  const owner = boundOwner;
  const persisted = grantsConnected(ownedBlob(), provider);
  const viaSingleUse = !persisted && claimable(token, requestId);
  if (!persisted && !viaSingleUse) return null;
  return makeLease(provider, owner, requestId, viaSingleUse);
}

/* ─── Hydration ─────────────────────────────────────────────────────────────── */

/**
 * Bind the store to `owner` (the session's wallet address, or null) and read
 * the phone once. Idempotent per wallet: both layouts bind, one read happens.
 * A change of wallet drops the single-use permissions and the pending sheets.
 */
export function hydrateAiConsent(
  owner: string | null,
  storage: AiConsentStorage = AsyncStorage,
): Promise<void> {
  const next = owner !== null && owner.length > 0 ? owner : null;
  if (next === boundOwner && storage === boundStorage)
    return hydration ?? Promise.resolve();
  const ownerChanged = next !== boundOwner;
  generation += 1;
  const epoch = generation;
  boundOwner = next;
  boundStorage = storage;
  hydratedOwner = null;
  readFailed = false;
  blob = null;
  hydration = null;
  // Bound to the old generation, so dead either way.
  dropSingleUse();
  if (ownerChanged) {
    clearConsentScopedState();
  }
  emit();
  if (next === null) return Promise.resolve();

  const read = storage
    .getItem(AI_CONSENT_STORAGE_KEY)
    .then(
      (raw) => {
        if (epoch !== generation) return;
        try {
          const disk = parseAiConsentBlob(raw);
          blob = disk !== null && disk.owner === next ? disk : null;
        } catch {
          readFailed = true;
        }
        hydratedOwner = next;
        emit();
      },
      () => {
        if (epoch !== generation) return;
        readFailed = true;
        hydratedOwner = next;
        emit();
      },
    )
    .finally(() => {
      if (hydration === read) hydration = null;
    });
  hydration = read;
  return read;
}

/** The layouts' one line: keep consent bound to the signed-in wallet (the `threadsStore.ts` hook pattern). */
export function useAiConsentPersistence(owner: string | null): void {
  useEffect(() => {
    void hydrateAiConsent(owner);
  }, [owner]);
}

/**
 * Wait for the read in flight, at most `timeoutMs`. Never rejects. After a
 * timeout the readers are still false.
 */
export function ensureAiConsentHydrated(
  timeoutMs: number = AI_CONSENT_HYDRATE_TIMEOUT_MS,
): Promise<void> {
  const pending = hydration;
  if (!pending) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, Math.max(0, timeoutMs));
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    pending.then(done, done);
  });
}

/* ─── Writers ───────────────────────────────────────────────────────────────── */

function onDisk<T>(op: () => Promise<T>): Promise<T> {
  const run = diskQueue.then(op);
  diskQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Apply `change` in memory, then on the phone. Skipped while unbound, before
 * the read finishes, or after it failed. A record issued before the read
 * finishes waits for it (so the late read never overwrites it), then checks
 * the wallet again: one that changed in the meantime writes nothing.
 */
async function writeChange(
  change: (current: AiConsentBlob) => AiConsentBlob,
  revokeOnFailure: (restored: AiConsentBlob) => AiConsentBlob,
  isWithdrawal = false,
): Promise<AiConsentWriteResult> {
  const owner = boundOwner;
  const epoch = generation;
  if (owner === null) return notPersisted('unbound');
  if (hydration) await hydration;
  if (epoch !== generation || owner !== boundOwner)
    return notPersisted('stale_owner');
  if (readFailed) return notPersisted('read_failed');
  if (hydratedOwner !== owner) return notPersisted('not_hydrated');
  const previous = blob;
  const base: AiConsentBlob = previous ?? {
    v: BLOB_VERSION,
    owner,
    connected: {},
  };
  const next = change(base);
  if (next === base) return PERSISTED;
  blob = next;
  emit();

  const storage = boundStorage;
  const wrote = await onDisk(async () => {
    if (epoch !== generation) return false;
    await storage.setItem(AI_CONSENT_STORAGE_KEY, JSON.stringify(next));
    // The whole blob was replaced, so nothing a refused clear left behind remains.
    clearUnfinished = false;
    return true;
  }).catch(() => false);
  if (wrote) return PERSISTED;
  const fallback = previous === null ? null : revokeOnFailure(previous);
  if (epoch === generation && blob === next) {
    blob = fallback;
    emit();
  }
  const safeOnDisk =
    !isWithdrawal ||
    fallback === previous ||
    (await onDisk(async () => {
      if (epoch !== generation) return false;
      try {
        await storage.setItem(
          AI_CONSENT_STORAGE_KEY,
          JSON.stringify(fallback ?? TOMBSTONE),
        );
      } catch {
        try {
          await storage.removeItem(AI_CONSENT_STORAGE_KEY);
        } catch {
          try {
            await storage.setItem(
              AI_CONSENT_STORAGE_KEY,
              JSON.stringify(TOMBSTONE),
            );
          } catch {
            clearUnfinished = true;
            return false;
          }
        }
      }
      clearUnfinished = false;
      return true;
    }).catch(() => false));
  if (epoch !== generation || owner !== boundOwner)
    return notPersisted('stale_owner');
  return notPersisted(safeOnDisk ? 'write_failed' : 'revoke_unsafe');
}

function withoutDefault(source: AiConsentBlob): AiConsentBlob {
  const { defaultAssistant: _dropped, ...rest } = source;
  return rest;
}

function withoutConnected(
  source: AiConsentBlob,
  provider: CredentialProvider,
): AiConsentBlob {
  if (!source.connected[provider]) return source;
  const connected = { ...source.connected };
  delete connected[provider];
  return { ...source, connected };
}

export async function recordDefaultDecision(
  decision: DefaultAssistantDecision,
): Promise<AiConsentWriteResult> {
  if (decision !== 'allowed' && decision !== 'declined')
    return notPersisted('invalid');
  const binding = captured();
  grantableDefault = null;
  if (decision === 'declined') {
    withdraw('default');
    if (singleUseDefault !== null) {
      singleUseDefault = null;
      emit();
    }
  }
  const revision = revisionOf('default');
  const result = await writeChange(
    (current) => ({
      ...current,
      defaultAssistant: {
        decision,
        consentVersion: DEFAULT_ASSISTANT_CONSENT_VERSION,
        at: new Date().toISOString(),
      },
    }),
    (restored) =>
      grantsDefault(restored) ? withoutDefault(restored) : restored,
    decision === 'declined',
  );
  if (result.persisted || result.reason !== 'write_failed') return result;
  if (!isCurrent(binding)) return notPersisted('stale_owner');
  if (decision !== 'allowed') return result;
  if (revisionOf('default') !== revision) return notPersisted('withdrawn');
  grantableDefault = Object.freeze({ ...binding, revision });
  return result;
}

/** A connected sheet's "Allow". "Don't allow" has no recorder, on purpose. */
export async function recordConnectedAccepted(
  provider: CredentialProvider,
): Promise<AiConsentWriteResult> {
  if (!isCredentialProvider(provider)) return notPersisted('invalid');
  const binding = captured();
  const revision = revisionOf(provider);
  grantableConnected.delete(provider);
  const result = await writeChange(
    (current) => ({
      ...current,
      connected: {
        ...current.connected,
        [provider]: {
          consentVersion: CONNECTED_AI_CONSENT_VERSION,
          acceptedAt: new Date().toISOString(),
        },
      },
    }),
    (restored) => withoutConnected(restored, provider),
  );
  if (result.persisted || result.reason !== 'write_failed') return result;
  if (!isCurrent(binding)) return notPersisted('stale_owner');
  if (revisionOf(provider) !== revision) return notPersisted('withdrawn');
  grantableConnected.set(provider, Object.freeze({ ...binding, revision }));
  return result;
}

export async function forgetConnectedConsent(
  provider: CredentialProvider,
): Promise<void> {
  withdraw(provider);
  clearConsentScopedState({ kind: 'connected', provider });
  grantableConnected.delete(provider);
  if (singleUseConnected.delete(provider)) emit();
  const result = await writeChange(
    (current) => withoutConnected(current, provider),
    (restored) => withoutConnected(restored, provider),
    true,
  );
  if (result.persisted && !clearUnfinished) return;
  await clearAiConsentOnPhone();
}

/**
 * An "Allow" whose write came back `write_failed`: the question `requestId`
 * may go, once. Memory only. True when granted; false for anything else (no
 * such failure, another wallet or generation, a later "Not now", no question
 * id).
 */
export function grantSingleUseDefaultConsent(requestId: string): boolean {
  const grant = grantableDefault;
  grantableDefault = null;
  if (!isNonEmpty(requestId) || !isGrantable(grant, 'default')) return false;
  singleUseDefault = Object.freeze({
    owner: grant.owner,
    generation: grant.generation,
    requestId,
  });
  emit();
  return true;
}

/** True when the permission for `requestId` was used up. One for any other question is dropped, unused. */
export function consumeSingleUseDefaultConsent(requestId: string): boolean {
  const token = singleUseDefault;
  if (token === null) return false;
  singleUseDefault = null;
  emit();
  return claimable(token, requestId);
}

export function grantSingleUseConnectedConsent(
  provider: CredentialProvider,
  requestId: string,
): boolean {
  if (!isCredentialProvider(provider)) return false;
  const grant = grantableConnected.get(provider);
  grantableConnected.delete(provider);
  if (!isNonEmpty(requestId) || !isGrantable(grant, provider)) return false;
  singleUseConnected.set(
    provider,
    Object.freeze({
      owner: grant.owner,
      generation: grant.generation,
      requestId,
    }),
  );
  emit();
  return true;
}

export function consumeSingleUseConnectedConsent(
  provider: CredentialProvider,
  requestId: string,
): boolean {
  const token = singleUseConnected.get(provider);
  if (!token) return false;
  singleUseConnected.delete(provider);
  emit();
  return claimable(token, requestId);
}

/* ─── Clear ─────────────────────────────────────────────────────────────────── */

/**
 * Sign-out and Delete everything, through `localClearRegistry.ts`. Memory
 * first (the record, the single-use permissions, the pending sheets, and the
 * consent-scoped state registered from outside this module), then the phone. If
 * the phone refuses the removal, a not-consented tombstone is written over it,
 * so the same wallet signing back in reads nothing. Throws only if
 * both fail, so the registry can retry and report it.
 */
export async function clearAiConsentOnPhone(
  storage: AiConsentStorage = boundStorage,
): Promise<void> {
  generation += 1;
  hydration = null;
  blob = null;
  readFailed = false;
  // Memory is known empty for the wallet still bound.
  hydratedOwner = boundOwner;
  dropSingleUse();
  clearConsentScopedState();
  emit();
  await onDisk(async () => {
    try {
      await storage.removeItem(AI_CONSENT_STORAGE_KEY);
    } catch (refused) {
      try {
        await storage.setItem(
          AI_CONSENT_STORAGE_KEY,
          JSON.stringify(TOMBSTONE),
        );
      } catch {
        clearUnfinished = true;
        throw refused;
      }
    }
    clearUnfinished = false;
  });
}

export function __resetAiConsentForTests(
  storage: AiConsentStorage = AsyncStorage,
): void {
  generation += 1;
  boundOwner = null;
  boundStorage = storage;
  hydratedOwner = null;
  readFailed = false;
  blob = null;
  hydration = null;
  dropSingleUse();
  connectedAuthority += 1;
  revisions.clear();
  clearUnfinished = false;
  diskQueue = Promise.resolve();
  listeners.clear();
  clearConsentScopedState();
}
