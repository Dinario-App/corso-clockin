import { PublicKey, type Connection } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@/src/features/security/swapProgramAllowlist';

/** Exact base mint account size (SPL Token + Token-2022 without extensions). */
export const SPL_MINT_ACCOUNT_SIZE = 82;
/** SPL multisig account size — not a mint; must never decode as decimals. */
export const SPL_MULTISIG_ACCOUNT_SIZE = 355;
/** @deprecated Use {@link SPL_MINT_ACCOUNT_SIZE}. */
export const MINT_ACCOUNT_MIN_BYTES = SPL_MINT_ACCOUNT_SIZE;
export const MINT_DECIMALS_OFFSET = 44;
export const MINT_INITIALIZED_OFFSET = 45;
/** Token-2022 `AccountType` discriminator offset (value `1` = Mint). */
export const TOKEN_2022_ACCOUNT_TYPE_OFFSET = 165;
export const TOKEN_2022_MINT_ACCOUNT_TYPE = 1;
/** Corso fee gate binds TransferChecked decimals to 0..18 inclusive. */
export const MAX_PROVABLE_DECIMALS = 18;
export const DEFAULT_MINT_DECIMALS_MAX_AGE_MS = 5 * 60 * 1000;

const ALLOWED_MINT_OWNERS = new Set([
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
]);

export type MintDecimalsRejectReason =
  | 'missing_account'
  | 'wrong_owner'
  | 'wrong_account_kind'
  | 'malformed_data'
  | 'not_initialized'
  | 'invalid_decimals'
  | 'rpc_unavailable';

export type DecodeMintDecimalsResult =
  | Readonly<{ ok: true; decimals: number }>
  | Readonly<{ ok: false; reason: MintDecimalsRejectReason }>;

export type MintAccountSnapshot = Readonly<{
  owner: string;
  data: Uint8Array;
  slot?: number;
}>;

export type MintAccountFetcher = (
  mint: string,
) => Promise<MintAccountSnapshot | null>;

export type MintDecimalsProof = Readonly<{
  mint: string;
  decimals: number;
  owner: string;
  slot?: number;
  provenAtMs: number;
}>;

export type MintDecimalsRejection = Readonly<{
  mint: string;
  reason: MintDecimalsRejectReason;
  provenAtMs: number;
}>;

type MintDecimalsCacheEntry = MintDecimalsProof | MintDecimalsRejection;

export class MintDecimalsCache {
  private readonly entries = new Map<string, MintDecimalsCacheEntry>();
  private readonly maxAgeMs: number;

  constructor(args: { maxAgeMs?: number } = {}) {
    this.maxAgeMs = args.maxAgeMs ?? DEFAULT_MINT_DECIMALS_MAX_AGE_MS;
  }

  get maxAge(): number {
    return this.maxAgeMs;
  }

  storeProof(proof: MintDecimalsProof): void {
    this.entries.set(proof.mint, Object.freeze({ ...proof }));
  }

  storeRejection(rejection: MintDecimalsRejection): void {
    this.entries.set(rejection.mint, Object.freeze({ ...rejection }));
  }

  getEntry(mint: string): MintDecimalsCacheEntry | null {
    return this.entries.get(mint) ?? null;
  }

  /**
   * Returns provable decimals when cached proof is fresh; otherwise null
   * (fail closed for missing, rejected, stale, or uncertain mint data).
   */
  getProvableDecimals(mint: string, nowMs: number): number | null {
    const entry = this.entries.get(mint);
    if (!entry) return null;
    if (nowMs < entry.provenAtMs) return null;
    if (nowMs - entry.provenAtMs > this.maxAgeMs) return null;
    if ('reason' in entry) return null;
    return entry.decimals;
  }

  clear(): void {
    this.entries.clear();
  }
}

let defaultCache = new MintDecimalsCache();

export function getMintDecimalsCache(): MintDecimalsCache {
  return defaultCache;
}

export function __replaceDefaultMintDecimalsCache(
  cache: MintDecimalsCache = new MintDecimalsCache(),
): void {
  defaultCache = cache;
}

function mintAuthorityOptionTag(data: Uint8Array): number {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(
    0,
    true,
  );
}

function hasMintAuthorityOptionHeader(data: Uint8Array): boolean {
  const tag = mintAuthorityOptionTag(data);
  return tag === 0 || tag === 1;
}

function isMintAccountLayout(owner: string, data: Uint8Array): boolean {
  if (data.length === SPL_MULTISIG_ACCOUNT_SIZE) {
    return false;
  }
  if (owner === TOKEN_PROGRAM_ID) {
    return data.length === SPL_MINT_ACCOUNT_SIZE;
  }
  if (owner === TOKEN_2022_PROGRAM_ID) {
    if (data.length === SPL_MINT_ACCOUNT_SIZE) {
      return true;
    }
    return (
      data.length > TOKEN_2022_ACCOUNT_TYPE_OFFSET &&
      data[TOKEN_2022_ACCOUNT_TYPE_OFFSET] === TOKEN_2022_MINT_ACCOUNT_TYPE &&
      hasMintAuthorityOptionHeader(data)
    );
  }
  return false;
}

/**
 * Decode decimals from raw mint account bytes after owner validation.
 * Pure — no RPC.
 */
export function decodeMintDecimalsFromAccount(
  owner: string,
  data: Uint8Array,
): DecodeMintDecimalsResult {
  if (!ALLOWED_MINT_OWNERS.has(owner)) {
    return { ok: false, reason: 'wrong_owner' };
  }
  if (data.length < SPL_MINT_ACCOUNT_SIZE) {
    return { ok: false, reason: 'malformed_data' };
  }
  if (!isMintAccountLayout(owner, data)) {
    return { ok: false, reason: 'wrong_account_kind' };
  }
  if (data[MINT_INITIALIZED_OFFSET] !== 1) {
    return { ok: false, reason: 'not_initialized' };
  }
  const decimals = data[MINT_DECIMALS_OFFSET];
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > MAX_PROVABLE_DECIMALS
  ) {
    return { ok: false, reason: 'invalid_decimals' };
  }
  return { ok: true, decimals };
}

export function provableMintDecimals(
  mint: string,
  cache: MintDecimalsCache = defaultCache,
  nowMs: number = Date.now(),
): number | null {
  return cache.getProvableDecimals(mint, nowMs);
}

export async function fetchAndCacheMintDecimals(
  mint: string,
  fetcher: MintAccountFetcher,
  cache: MintDecimalsCache = defaultCache,
  args: { nowMs?: number } = {},
): Promise<number | null> {
  const nowMs = args.nowMs ?? Date.now();
  const snapshot = await fetcher(mint);
  if (snapshot == null) {
    cache.storeRejection({
      mint,
      reason: 'missing_account',
      provenAtMs: nowMs,
    });
    return null;
  }
  const decoded = decodeMintDecimalsFromAccount(snapshot.owner, snapshot.data);
  if (!decoded.ok) {
    cache.storeRejection({
      mint,
      reason: decoded.reason,
      provenAtMs: nowMs,
    });
    return null;
  }
  cache.storeProof({
    mint,
    decimals: decoded.decimals,
    owner: snapshot.owner,
    slot: snapshot.slot,
    provenAtMs: nowMs,
  });
  return decoded.decimals;
}

/**
 * Fetch multiple mints through the injected fetcher; returns a map of mint →
 * provable decimals (only entries that resolved).
 */
export async function fetchAndCacheMintDecimalsBatch(
  mints: readonly string[],
  fetcher: MintAccountFetcher,
  cache: MintDecimalsCache = defaultCache,
  args: { nowMs?: number } = {},
): Promise<ReadonlyMap<string, number>> {
  const resolved = new Map<string, number>();
  for (const mint of mints) {
    const decimals = await fetchAndCacheMintDecimals(mint, fetcher, cache, args);
    if (decimals != null) resolved.set(mint, decimals);
  }
  return resolved;
}

export function createConnectionMintAccountFetcher(
  connection: Pick<Connection, 'getAccountInfo'> &
    Partial<Pick<Connection, 'getAccountInfoAndContext'>>,
): MintAccountFetcher {
  return async (mint: string) => {
    if (
      typeof connection.getAccountInfo !== 'function' &&
      typeof connection.getAccountInfoAndContext !== 'function'
    ) {
      return null;
    }
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(mint);
    } catch {
      return null;
    }
    if (typeof connection.getAccountInfoAndContext === 'function') {
      const { context, value } = await connection.getAccountInfoAndContext(
        pubkey,
        'confirmed',
      );
      if (value == null) return null;
      return {
        owner: value.owner.toBase58(),
        data: value.data,
        slot: context.slot,
      };
    }
    const info = await connection.getAccountInfo(pubkey, 'confirmed');
    if (info == null) return null;
    return {
      owner: info.owner.toBase58(),
      data: info.data,
    };
  };
}

export type SwapOrderCorsoFeeFields = Readonly<{
  corsoFeeBps?: number | null;
  quoteFeeBps?: number | null;
  platformFeeBps?: number | null;
  feeMint?: string | null;
  feeDestination?: string | null;
  platformFeeAmount?: string | null;
}>;

/** Matches `declaresCorsoFee` in assertSwapSemantics — outer-fee shape only. */
export function swapOrderDeclaresCorsoFee(order: SwapOrderCorsoFeeFields): boolean {
  const reviewedCorsoFeeBps = order.corsoFeeBps ?? 0;
  const reviewedQuoteFeeBps = order.quoteFeeBps ?? 0;
  return (
    (order.platformFeeBps ?? 0) === 0 &&
    (reviewedCorsoFeeBps !== 0 ||
      reviewedQuoteFeeBps !== 0 ||
      order.feeMint != null ||
      order.feeDestination != null ||
      order.platformFeeAmount != null)
  );
}

export function swapOrderRequiresOutputMintDecimals(
  order: SwapOrderCorsoFeeFields,
): boolean {
  return swapOrderDeclaresCorsoFee(order);
}

export function createMintAccountFetcher(
  getAccount: (
    mint: string,
  ) => Promise<MintAccountSnapshot | null> | MintAccountSnapshot | null,
): MintAccountFetcher {
  return async (mint: string) => getAccount(mint);
}
