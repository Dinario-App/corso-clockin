import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import { isCanonicalBoundedU64DecimalString } from '@/src/features/tokenFacts/boundedU64';
import type {
  TokenFactsResponse,
  TokenFactsSourceStatus,
  TokenProgramKind,
} from '@/src/features/tokenFacts/types';

export type ReviewedOutputTokenFactsSnapshot = Readonly<{
  quoteDigest: string;
  cluster: PriceCluster;
  mint: string;
  tokenProgram: TokenProgramKind | null;
  token2022ExtensionTypeIds?: readonly number[] | null;
  permanentDelegate?: boolean | null;
  defaultAccountFrozen?: boolean | null;
  chainStatus: TokenFactsSourceStatus;
  chainAsOfMs: number | null;
  freshnessTtlSec: number;
  transferFeeConfigured: boolean | null;
  transferHookConfigured: boolean | null;
  transferFeeBasisPoints: number | null;
  transferFeeMaximum: string | null;
  transferFeeEpoch: number | null;
  transferFeeOlderBasisPoints: number | null;
  transferFeeOlderMaximum: string | null;
  transferFeeOlderEpoch: number | null;
  transferFeeNewerBasisPoints: number | null;
  transferFeeNewerMaximum: string | null;
  transferFeeNewerEpoch: number | null;
}>;

/** Client-owned maximum age accepted by the raw-signing gate. */
export const SIGNING_FACTS_MAX_TTL_SEC = 5 * 60;

const SNAPSHOT_KEYS = [
  'quoteDigest',
  'cluster',
  'mint',
  'tokenProgram',
  'chainStatus',
  'chainAsOfMs',
  'freshnessTtlSec',
  'transferFeeConfigured',
  'transferHookConfigured',
  'transferFeeBasisPoints',
  'transferFeeMaximum',
  'transferFeeEpoch',
  'transferFeeOlderBasisPoints',
  'transferFeeOlderMaximum',
  'transferFeeOlderEpoch',
  'transferFeeNewerBasisPoints',
  'transferFeeNewerMaximum',
  'transferFeeNewerEpoch',
] as const;

const OPTIONAL_SNAPSHOT_KEYS = ['token2022ExtensionTypeIds', 'permanentDelegate', 'defaultAccountFrozen'] as const;

const NULLABLE_SNAPSHOT_BPS_KEYS = [
  'transferFeeBasisPoints',
  'transferFeeOlderBasisPoints',
  'transferFeeNewerBasisPoints',
] as const;

const NULLABLE_SNAPSHOT_U64_KEYS = [
  'transferFeeMaximum',
  'transferFeeOlderMaximum',
  'transferFeeNewerMaximum',
] as const;

const NULLABLE_SNAPSHOT_EPOCH_KEYS = [
  'transferFeeEpoch',
  'transferFeeOlderEpoch',
  'transferFeeNewerEpoch',
] as const;

export function freezeReviewedOutputTokenFacts(args: {
  facts: TokenFactsResponse;
  quoteDigest: string;
}): ReviewedOutputTokenFactsSnapshot {
  const chain = args.facts.sources.chain;
  return Object.freeze({
    quoteDigest: args.quoteDigest,
    cluster: args.facts.cluster,
    mint: args.facts.mint,
    tokenProgram: chain.fields.tokenProgram,
    token2022ExtensionTypeIds: chain.fields.token2022ExtensionTypeIds == null ? null : Object.freeze([...chain.fields.token2022ExtensionTypeIds]),
    permanentDelegate: chain.fields.permanentDelegate,
    defaultAccountFrozen: chain.fields.defaultAccountFrozen,
    chainStatus: chain.status,
    chainAsOfMs: chain.asOfMs,
    freshnessTtlSec: Math.min(
      args.facts.cacheTtlSec,
      SIGNING_FACTS_MAX_TTL_SEC,
    ),
    transferFeeConfigured: chain.fields.transferFee,
    transferHookConfigured: chain.fields.transferHook,
    transferFeeBasisPoints: chain.fields.transferFeeBasisPoints,
    transferFeeMaximum: chain.fields.transferFeeMaximum,
    transferFeeEpoch: chain.fields.transferFeeEpoch,
    transferFeeOlderBasisPoints: chain.fields.transferFeeOlderBasisPoints,
    transferFeeOlderMaximum: chain.fields.transferFeeOlderMaximum,
    transferFeeOlderEpoch: chain.fields.transferFeeOlderEpoch,
    transferFeeNewerBasisPoints: chain.fields.transferFeeNewerBasisPoints,
    transferFeeNewerMaximum: chain.fields.transferFeeNewerMaximum,
    transferFeeNewerEpoch: chain.fields.transferFeeNewerEpoch,
  });
}

export function isReviewedOutputTokenFactsSnapshot(
  value: unknown,
): value is ReviewedOutputTokenFactsSnapshot {
  if (!value || typeof value !== 'object' || !Object.isFrozen(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (
    keys.some((key) => !new Set<string>([...SNAPSHOT_KEYS, ...OPTIONAL_SNAPSHOT_KEYS]).has(key)) ||
    !SNAPSHOT_KEYS.every((key) => Object.hasOwn(record, key))
  ) {
    return false;
  }
  return (
    OPTIONAL_SNAPSHOT_KEYS.every((key) => {
      if (!Object.hasOwn(record, key)) return true;
      const value = record[key];
      if (key !== 'token2022ExtensionTypeIds') return value === null || typeof value === 'boolean';
      return value === null || (Array.isArray(value) && Object.isFrozen(value) && value.every((id) => Number.isInteger(id) && id >= 0 && id <= 65535) && new Set(value).size === value.length);
    }) &&
    typeof record.quoteDigest === 'string' &&
    /^[0-9a-f]{64}$/.test(record.quoteDigest) &&
    (record.cluster === 'mainnet-beta' || record.cluster === 'devnet') &&
    typeof record.mint === 'string' &&
    record.mint.length > 0 &&
    (record.tokenProgram === 'spl-token' ||
      record.tokenProgram === 'token-2022' ||
      record.tokenProgram === null) &&
    (record.chainStatus === 'ok' ||
      record.chainStatus === 'missing' ||
      record.chainStatus === 'unavailable') &&
    (record.chainAsOfMs === null ||
      (typeof record.chainAsOfMs === 'number' &&
        Number.isSafeInteger(record.chainAsOfMs) &&
        record.chainAsOfMs >= 0)) &&
    typeof record.freshnessTtlSec === 'number' &&
    Number.isSafeInteger(record.freshnessTtlSec) &&
    record.freshnessTtlSec > 0 &&
    record.freshnessTtlSec <= SIGNING_FACTS_MAX_TTL_SEC &&
    (typeof record.transferFeeConfigured === 'boolean' ||
      record.transferFeeConfigured === null) &&
    (typeof record.transferHookConfigured === 'boolean' ||
      record.transferHookConfigured === null) &&
    NULLABLE_SNAPSHOT_BPS_KEYS.every((key) => {
      const value = record[key];
      return (
        value === null ||
        (typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          value >= 0 &&
          value <= 10_000)
      );
    }) &&
    NULLABLE_SNAPSHOT_U64_KEYS.every((key) => {
      const value = record[key];
      return (
        value === null ||
        (typeof value === 'string' && isCanonicalBoundedU64DecimalString(value))
      );
    }) &&
    NULLABLE_SNAPSHOT_EPOCH_KEYS.every((key) => {
      const value = record[key];
      return (
        value === null ||
        (typeof value === 'number' &&
          Number.isSafeInteger(value) &&
          value >= 0)
      );
    })
  );
}

export function isReviewedOutputTokenFactsFresh(
  snapshot: ReviewedOutputTokenFactsSnapshot,
  nowMs: number,
): boolean {
  return (
    Number.isSafeInteger(nowMs) &&
    snapshot.chainAsOfMs != null &&
    snapshot.chainAsOfMs <= nowMs &&
    nowMs - snapshot.chainAsOfMs <= snapshot.freshnessTtlSec * 1_000
  );
}

export function reviewedOutputTokenFactsSnapshotsEqual(
  left: ReviewedOutputTokenFactsSnapshot | null,
  right: ReviewedOutputTokenFactsSnapshot | null,
): boolean {
  if (left === null || right === null) return left === right;
  return SNAPSHOT_KEYS.every((key) => left[key] === right[key]) &&
    left.permanentDelegate === right.permanentDelegate && left.defaultAccountFrozen === right.defaultAccountFrozen &&
    (left.token2022ExtensionTypeIds === right.token2022ExtensionTypeIds ||
      (Array.isArray(left.token2022ExtensionTypeIds) && Array.isArray(right.token2022ExtensionTypeIds) &&
       left.token2022ExtensionTypeIds.length === right.token2022ExtensionTypeIds.length &&
       left.token2022ExtensionTypeIds.every((id, index) => id === right.token2022ExtensionTypeIds![index])));
}

/** Validate the snapshot's live quote identity independently of tx semantics. */
export function assertReviewedOutputTokenFactsIntent(args: {
  snapshot: ReviewedOutputTokenFactsSnapshot;
  quoteDigest: string | null | undefined;
  cluster: PriceCluster | null | undefined;
  outputMint: string | null | undefined;
  nowMs?: number;
}): void {
  if (
    !isReviewedOutputTokenFactsSnapshot(args.snapshot) ||
    args.snapshot.quoteDigest !== args.quoteDigest ||
    args.snapshot.cluster !== args.cluster ||
    args.snapshot.mint !== args.outputMint
  ) {
    throw new Error(
      'Reviewed TokenFacts do not match the quote intent. Refusing to sign.',
    );
  }
  if (
    !isReviewedOutputTokenFactsFresh(
      args.snapshot,
      args.nowMs ?? Date.now(),
    )
  ) {
    throw new Error(
      'Reviewed TokenFacts are stale. Go back and review again.',
    );
  }
}
