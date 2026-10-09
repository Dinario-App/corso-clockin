import AsyncStorage from '@react-native-async-storage/async-storage';
import { type DetailsSnapshot, parseDetailsSnapshot } from '@corso/why';
import type { ReceiptSignedIntent } from './receiptPresentation';

export const RECEIPT_SNAPSHOTS_KEY = 'corso.receiptSnapshots.v1';
export type ReceiptSnapshot = Readonly<{
  bookEffect: string | null;
  quoteAgeSeconds: number | null;
  savedAtMs: number;
  details?: DetailsSnapshot | null;
  intent?: ReceiptSignedIntent | null;
}>;
export type ReceiptSnapshotStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

let epoch = 0;
let pending: Promise<unknown> = Promise.resolve();
const intents = new Map<string, ReceiptSignedIntent>();

/** Capture before opening Sign; a clear invalidates every in-flight capture. */
export function receiptSnapshotEpoch(): number {
  return epoch;
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  pending = result.catch(() => undefined);
  return result;
}

function validSignature(signature: string): boolean {
  return (
    typeof signature === 'string' &&
    signature.length > 0 &&
    signature.trim() === signature
  );
}
const MAX_DECIMALS = 18;
const MAX_U64 = 18_446_744_073_709_551_615n;
const MAX_FEE_BPS = 10_000;
const MAX_DATE_MS = 8.64e15;
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function intIn(value: unknown, max: number): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) <= max
  );
}
function atomic(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{1,20}$/.test(value) &&
    BigInt(value) <= MAX_U64
  );
}
function atomicOrNull(value: unknown): value is string | null {
  return value === null || atomic(value);
}
function token(value: unknown): ReceiptSignedIntent['pay'] | null {
  if (!value || typeof value !== 'object') return null;
  const t = value as ReceiptSignedIntent['pay'];
  return nonEmpty(t.mint) &&
    typeof t.symbol === 'string' &&
    intIn(t.decimals, MAX_DECIMALS)
    ? { mint: t.mint, symbol: t.symbol, decimals: t.decimals }
    : null;
}
/** A copy of exactly the intent fields, or null when any field is malformed. */
function parseIntent(value: unknown): ReceiptSignedIntent | null {
  if (!value || typeof value !== 'object') return null;
  const i = value as ReceiptSignedIntent;
  const pay = token(i.pay);
  const receive = token(i.receive);
  if (
    !pay ||
    !receive ||
    !nonEmpty(i.owner) ||
    !nonEmpty(i.cluster) ||
    !atomic(i.inAmount) ||
    !atomic(i.outAmount) ||
    !intIn(i.corsoFeeBps, MAX_FEE_BPS) ||
    !atomicOrNull(i.platformFeeAmount) ||
    !(i.feeMint === null || nonEmpty(i.feeMint)) ||
    typeof i.feeDropped !== 'boolean' ||
    !(i.priceImpactPct === null || typeof i.priceImpactPct === 'string') ||
    !atomicOrNull(i.networkFeeLamports) ||
    !atomicOrNull(i.accountRentLamports) ||
    !(i.minReceivedAtomic === undefined || atomicOrNull(i.minReceivedAtomic)) ||
    (i.status !== 'confirmed' && i.status !== 'finalised') ||
    !intIn(i.savedAtMs, MAX_DATE_MS) ||
    (i.side !== 'buy' && i.side !== 'sell')
  )
    return null;
  return {
    owner: i.owner,
    cluster: i.cluster,
    pay,
    receive,
    inAmount: i.inAmount,
    outAmount: i.outAmount,
    corsoFeeBps: i.corsoFeeBps,
    platformFeeAmount: i.platformFeeAmount,
    feeMint: i.feeMint,
    feeDropped: i.feeDropped,
    priceImpactPct: i.priceImpactPct,
    networkFeeLamports: i.networkFeeLamports,
    accountRentLamports: i.accountRentLamports,
    ...(i.minReceivedAtomic !== undefined
      ? { minReceivedAtomic: i.minReceivedAtomic }
      : {}),
    status: i.status,
    savedAtMs: i.savedAtMs,
    side: i.side,
  };
}
function validSnapshot(value: unknown): value is ReceiptSnapshot {
  if (!value || typeof value !== 'object') return false;
  const item = value as ReceiptSnapshot;
  return (
    (item.bookEffect === null || typeof item.bookEffect === 'string') &&
    (item.quoteAgeSeconds === null ||
      intIn(item.quoteAgeSeconds, Number.MAX_SAFE_INTEGER)) &&
    intIn(item.savedAtMs, MAX_DATE_MS)
  );
}
/** A copy with `details` and `intent` kept only when they parse; old records have neither. */
function normalized(item: ReceiptSnapshot): ReceiptSnapshot {
  const base = {
    bookEffect: item.bookEffect,
    quoteAgeSeconds: item.quoteAgeSeconds,
    savedAtMs: item.savedAtMs,
    ...(item.intent !== undefined ? { intent: parseIntent(item.intent) } : {}),
  };
  if (item.details === undefined) return base;
  const details = parseDetailsSnapshot(
    item.details === null ? null : JSON.parse(JSON.stringify(item.details)),
  );
  return { ...base, details };
}
function records(raw: string | null): Record<string, ReceiptSnapshot> {
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return Object.create(null);
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => validSignature(key) && validSnapshot(value))
        .map(([key, value]) => [key, normalized(value as ReceiptSnapshot)]),
    );
  } catch {
    return Object.create(null);
  }
}

/** First write wins. Copy before awaiting disk so later market data cannot replace it. */
export async function saveReceiptSnapshot(
  signature: string,
  snapshot: ReceiptSnapshot,
  storage: ReceiptSnapshotStorage = AsyncStorage,
  expectedEpoch = receiptSnapshotEpoch(),
): Promise<boolean> {
  if (!validSignature(signature) || !validSnapshot(snapshot))
    throw new Error('Invalid receipt snapshot');
  const captured: ReceiptSnapshot = normalized(snapshot);
  return enqueue(async () => {
    if (expectedEpoch !== epoch) return false;
    const saved = records(await storage.getItem(RECEIPT_SNAPSHOTS_KEY));
    if (expectedEpoch !== epoch) return false;
    if (Object.hasOwn(saved, signature)) return true;
    Object.defineProperty(saved, signature, {
      value: captured,
      enumerable: true,
    });
    await storage.setItem(RECEIPT_SNAPSHOTS_KEY, JSON.stringify(saved));
    return expectedEpoch === epoch;
  });
}

/** No live-data fallback; unreadable or missing storage means no frozen block. */
export async function readReceiptSnapshot(
  signature: string,
  storage: ReceiptSnapshotStorage = AsyncStorage,
): Promise<ReceiptSnapshot | null> {
  if (!validSignature(signature)) return null;
  const readEpoch = epoch;
  try {
    return await enqueue(async () => {
      const saved = records(await storage.getItem(RECEIPT_SNAPSHOTS_KEY));
      if (readEpoch !== epoch || !Object.hasOwn(saved, signature)) return null;
      const found = saved[signature];
      return found.intent
        ? { ...found, intent: copyIntent(found.intent) }
        : { ...found };
    });
  } catch {
    return null;
  }
}

function copyIntent(intent: ReceiptSignedIntent): ReceiptSignedIntent {
  return { ...intent, pay: { ...intent.pay }, receive: { ...intent.receive } };
}

/** Memory for this session; the disk copy rides on the snapshot. Neither crosses wallet/cluster scope. */
export function rememberReceiptIntent(
  signature: string,
  intent: ReceiptSignedIntent,
  expectedEpoch = receiptSnapshotEpoch(),
): boolean {
  if (!validSignature(signature) || expectedEpoch !== epoch) return false;
  if (!intents.has(signature)) intents.set(signature, copyIntent(intent));
  return true;
}
/**
 * The session's memory copy first; after a cold restart, the copy saved on the
 * signature's snapshot. Either is what Review showed at Sign, never current.
 */
export function readReceiptIntent(
  signature: string,
  owner: string,
  cluster: string,
  snapshot: ReceiptSnapshot | null = null,
): ReceiptSignedIntent | null {
  const intent = intents.get(signature) ?? snapshot?.intent ?? null;
  return intent && intent.owner === owner && intent.cluster === cluster
    ? copyIntent(intent)
    : null;
}

export async function readReceiptIntents(
  signatures: readonly string[],
  owner: string,
  cluster: string,
  storage: ReceiptSnapshotStorage = AsyncStorage,
): Promise<Map<string, ReceiptSignedIntent>> {
  const readEpoch = epoch;
  let saved: Record<string, ReceiptSnapshot> = Object.create(null);
  try {
    saved = await enqueue(async () =>
      records(await storage.getItem(RECEIPT_SNAPSHOTS_KEY)),
    );
  } catch {
    // Memory copies still answer.
  }
  const out = new Map<string, ReceiptSignedIntent>();
  if (readEpoch !== epoch) return out;
  for (const signature of signatures) {
    if (!validSignature(signature)) continue;
    const snapshot = Object.hasOwn(saved, signature) ? saved[signature] : null;
    const intent = readReceiptIntent(signature, owner, cluster, snapshot);
    if (intent) out.set(signature, intent);
  }
  return out;
}

/** Invalidate memory now; serialize removal after pending writes to prevent resurrection. */
export async function clearReceiptSnapshotsOnSignOut(
  storage: ReceiptSnapshotStorage = AsyncStorage,
): Promise<void> {
  epoch += 1;
  intents.clear();
  await enqueue(() => storage.removeItem(RECEIPT_SNAPSHOTS_KEY));
}
