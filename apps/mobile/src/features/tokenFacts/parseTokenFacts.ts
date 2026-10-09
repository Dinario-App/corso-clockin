/**
 * Fail-closed parse for `GET /v1/tokens/:mint/facts`.
 * Never invents defaults for missing upstream fields.
 */
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import { parseCanonicalBoundedU64DecimalString } from '@/src/features/tokenFacts/boundedU64';
import {
  TOKEN_FACTS_SCHEMA_VERSION,
  type AuthorityStatus,
  type RiskFlag,
  type RiskFlagCode,
  type RiskFlagSource,
  type RiskSeverity,
  type TokenFactsApiStatus,
  type TokenFactsChainFields,
  type TokenFactsJupiterFields,
  type TokenFactsResponse,
  type TokenFactsRugcheckFields,
  type TokenFactsSourceStatus,
  type TokenProgramKind,
} from '@/src/features/tokenFacts/types';

const API_STATUSES = new Set<TokenFactsApiStatus>([
  'ready',
  'partial',
  'unavailable',
  'disabled',
]);

const SOURCE_STATUSES = new Set<TokenFactsSourceStatus>([
  'ok',
  'missing',
  'unavailable',
]);

const AUTHORITY_STATUSES = new Set<AuthorityStatus>([
  'renounced',
  'present',
  'unknown',
]);

const TOKEN_PROGRAM_KINDS = new Set<TokenProgramKind>([
  'spl-token',
  'token-2022',
]);

const SOLANA_BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SOLANA_BASE58_CHAR_SET = new Set(SOLANA_BASE58_ALPHABET);
const SOLANA_BASE58_ALPHABET_MAP = new Map<string, number>(
  [...SOLANA_BASE58_ALPHABET].map((char, index) => [char, index]),
);

const RISK_SEVERITIES = new Set<RiskSeverity>(['info', 'warn', 'block']);

const RISK_FLAG_CODES = new Set<RiskFlagCode>([
  'unknown_mint',
  'freeze_authority_present',
  'mint_authority_present',
  'high_price_impact',
  'low_sol_for_fees',
  'low_sol_for_rent',
  'stale_quote',
  'fee_unverified',
  'insufficient_balance',
  'swap_program_unexpected',
  'step_up_required',
  'session_locked',
  'door_capability_limited',
  'empty_portfolio',
  'ramp_geo_or_disabled',
  'analytics_or_ai_disclosure',
]);

const RISK_FLAG_SOURCES = new Set<RiskFlagSource>([
  'balance',
  'quote',
  'send',
  'swap_semantics',
  'session',
  'ramp',
  'token_meta',
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  return undefined;
}

function parseNullableSolanaPubkey(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) {
    return undefined;
  }
  for (const char of value) {
    if (!SOLANA_BASE58_CHAR_SET.has(char)) return undefined;
  }
  const decoded = base58Decode(value);
  if (decoded == null || decoded.length !== 32) return undefined;
  return base58Encode(decoded) === value ? value : undefined;
}

function base58Decode(value: string): Uint8Array | null {
  let zeros = 0;
  while (zeros < value.length && value[zeros] === '1') zeros += 1;

  const bytes: number[] = [];
  for (let i = zeros; i < value.length; i += 1) {
    const digit = SOLANA_BASE58_ALPHABET_MAP.get(value[i]!);
    if (digit === undefined) return null;
    let carry = digit;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[zeros + bytes.length - 1 - i] = bytes[i]!;
  }
  return out;
}

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';

  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;

  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    out += SOLANA_BASE58_ALPHABET[digits[i]!]!;
  }
  return out;
}

function parseNullableBoolean(value: unknown): boolean | null | undefined {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  return undefined;
}

function parseNullableFiniteNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (isFiniteNumber(value)) return value;
  return undefined;
}

function parseNullableAuthority(value: unknown): AuthorityStatus | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string' && AUTHORITY_STATUSES.has(value as AuthorityStatus)) {
    return value as AuthorityStatus;
  }
  return undefined;
}

function parseNullableTokenProgram(
  value: unknown,
): TokenProgramKind | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string' && TOKEN_PROGRAM_KINDS.has(value as TokenProgramKind)) {
    return value as TokenProgramKind;
  }
  return undefined;
}

function parseAsOfMs(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (!isFiniteNumber(value) || value < 0) return undefined;
  return value;
}

function parseNullableSafeInteger(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  return undefined;
}

function parseNullableTransferFeeBps(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 10_000
  ) {
    return value;
  }
  return undefined;
}

function parseNullablePercentage(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-9
  ) {
    return undefined;
  }
  return value;
}

function parseNullableU64DecimalString(value: unknown): string | null | undefined {
  return parseCanonicalBoundedU64DecimalString(value);
}


function parseChainFields(raw: unknown): TokenFactsChainFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const decimals = parseNullableFiniteNumber(f.decimals);
  const supply = Object.hasOwn(f, 'supply')
    ? parseNullableU64DecimalString(f.supply)
    : null;
  const top20ConcentrationPct = Object.hasOwn(f, 'top20ConcentrationPct')
    ? parseNullablePercentage(f.top20ConcentrationPct)
    : null;
  const mintAuthority = parseNullableAuthority(f.mintAuthority);
  const freezeAuthority = parseNullableAuthority(f.freezeAuthority);
  const tokenProgram = parseNullableTokenProgram(f.tokenProgram);
  const ids = f.token2022ExtensionTypeIds;
  const token2022ExtensionTypeIds = ids === undefined || ids === null ? null :
    Array.isArray(ids) && ids.every((id) => Number.isInteger(id) && id >= 0 && id <= 65535) && new Set(ids).size === ids.length
      ? [...ids] as number[] : undefined;
  const transferFee = parseNullableBoolean(f.transferFee);
  const transferHook = parseNullableBoolean(f.transferHook);
  const transferHookAuthority = Object.hasOwn(f, 'transferHookAuthority')
    ? parseNullableSolanaPubkey(f.transferHookAuthority)
    : null;
  const transferHookProgramId = Object.hasOwn(f, 'transferHookProgramId')
    ? parseNullableSolanaPubkey(f.transferHookProgramId)
    : null;
  const permanentDelegate = parseNullableBoolean(f.permanentDelegate);
  const permanentDelegateAddress = Object.hasOwn(f, 'permanentDelegateAddress')
    ? parseNullableSolanaPubkey(f.permanentDelegateAddress)
    : null;
  const defaultAccountFrozen = parseNullableBoolean(f.defaultAccountFrozen);
  if (
    token2022ExtensionTypeIds === undefined ||
    decimals === undefined ||
    supply === undefined ||
    top20ConcentrationPct === undefined ||
    mintAuthority === undefined ||
    freezeAuthority === undefined ||
    tokenProgram === undefined ||
    transferFee === undefined ||
    transferHook === undefined ||
    transferHookAuthority === undefined ||
    transferHookProgramId === undefined ||
    permanentDelegate === undefined ||
    permanentDelegateAddress === undefined ||
    defaultAccountFrozen === undefined
  ) {
    return null;
  }

  if (transferHook === false && transferHookProgramId != null) {
    return null;
  }
  if (permanentDelegate === false && permanentDelegateAddress != null) {
    return null;
  }

  const transferFeeBasisPoints = Object.hasOwn(f, 'transferFeeBasisPoints')
    ? parseNullableTransferFeeBps(f.transferFeeBasisPoints)
    : null;
  const transferFeeMaximum = Object.hasOwn(f, 'transferFeeMaximum')
    ? parseNullableU64DecimalString(f.transferFeeMaximum)
    : null;
  const transferFeeEpoch = Object.hasOwn(f, 'transferFeeEpoch')
    ? parseNullableSafeInteger(f.transferFeeEpoch)
    : null;
  const transferFeeOlderBasisPoints = Object.hasOwn(
    f,
    'transferFeeOlderBasisPoints',
  )
    ? parseNullableTransferFeeBps(f.transferFeeOlderBasisPoints)
    : null;
  const transferFeeOlderMaximum = Object.hasOwn(f, 'transferFeeOlderMaximum')
    ? parseNullableU64DecimalString(f.transferFeeOlderMaximum)
    : null;
  const transferFeeOlderEpoch = Object.hasOwn(f, 'transferFeeOlderEpoch')
    ? parseNullableSafeInteger(f.transferFeeOlderEpoch)
    : null;
  const transferFeeNewerBasisPoints = Object.hasOwn(
    f,
    'transferFeeNewerBasisPoints',
  )
    ? parseNullableTransferFeeBps(f.transferFeeNewerBasisPoints)
    : null;
  const transferFeeNewerMaximum = Object.hasOwn(f, 'transferFeeNewerMaximum')
    ? parseNullableU64DecimalString(f.transferFeeNewerMaximum)
    : null;
  const transferFeeNewerEpoch = Object.hasOwn(f, 'transferFeeNewerEpoch')
    ? parseNullableSafeInteger(f.transferFeeNewerEpoch)
    : null;

  if (
    transferFeeBasisPoints === undefined ||
    transferFeeMaximum === undefined ||
    transferFeeEpoch === undefined ||
    transferFeeOlderBasisPoints === undefined ||
    transferFeeOlderMaximum === undefined ||
    transferFeeOlderEpoch === undefined ||
    transferFeeNewerBasisPoints === undefined ||
    transferFeeNewerMaximum === undefined ||
    transferFeeNewerEpoch === undefined
  ) {
    return null;
  }

  return {
    decimals,
    supply,
    top20ConcentrationPct,
    mintAuthority,
    freezeAuthority,
    tokenProgram,
    token2022ExtensionTypeIds,
    transferFee,
    transferHook,
    transferHookAuthority,
    transferHookProgramId,
    permanentDelegate,
    permanentDelegateAddress,
    defaultAccountFrozen,
    transferFeeBasisPoints,
    transferFeeMaximum,
    transferFeeEpoch,
    transferFeeOlderBasisPoints,
    transferFeeOlderMaximum,
    transferFeeOlderEpoch,
    transferFeeNewerBasisPoints,
    transferFeeNewerMaximum,
    transferFeeNewerEpoch,
  };
}

function parseJupiterFields(raw: unknown): TokenFactsJupiterFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const name = parseNullableString(f.name);
  const symbol = parseNullableString(f.symbol);
  const icon = parseNullableString(f.icon);
  const holderCount = parseNullableFiniteNumber(f.holderCount);
  const topHoldersPct = parseNullableFiniteNumber(f.topHoldersPct);
  const liquidityUsd = parseNullableFiniteNumber(f.liquidityUsd);
  const isVerified = parseNullableBoolean(f.isVerified);
  const organicScore = parseNullableFiniteNumber(f.organicScore);
  const isSus = parseNullableBoolean(f.isSus);
  if (
    name === undefined ||
    symbol === undefined ||
    icon === undefined ||
    holderCount === undefined ||
    topHoldersPct === undefined ||
    liquidityUsd === undefined ||
    isVerified === undefined ||
    organicScore === undefined ||
    isSus === undefined
  ) {
    return null;
  }
  return {
    name,
    symbol,
    icon,
    holderCount,
    topHoldersPct,
    liquidityUsd,
    isVerified,
    organicScore,
    isSus,
  };
}

function parseRugcheckFields(raw: unknown): TokenFactsRugcheckFields | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const lpLockedPct = parseNullableFiniteNumber(f.lpLockedPct);
  const lpLockedUsd = parseNullableFiniteNumber(f.lpLockedUsd);
  const totalMarketLiquidity = parseNullableFiniteNumber(f.totalMarketLiquidity);
  const riskLevel =
    f.riskLevel === null ||
    f.riskLevel === 'Good' ||
    f.riskLevel === 'Warning' ||
    f.riskLevel === 'Danger'
      ? f.riskLevel
      : undefined;
  const riskDescriptions = Array.isArray(f.riskDescriptions)
    ? f.riskDescriptions.every(
        (description) =>
          typeof description === 'string' && description.trim().length > 0,
      )
      ? [...f.riskDescriptions]
      : undefined
    : undefined;
  if (
    riskLevel === undefined ||
    riskDescriptions === undefined ||
    lpLockedPct === undefined ||
    lpLockedUsd === undefined ||
    totalMarketLiquidity === undefined
  ) {
    return null;
  }
  return {
    riskLevel,
    riskDescriptions,
    lpLockedPct,
    lpLockedUsd,
    totalMarketLiquidity,
  };
}

function parseSourceSlice<TFields>(
  raw: unknown,
  parseFields: (value: unknown) => TFields | null,
): { status: TokenFactsSourceStatus; asOfMs: number | null; fields: TFields } | null {
  if (!raw || typeof raw !== 'object') return null;
  const slice = raw as Record<string, unknown>;
  if (
    typeof slice.status !== 'string' ||
    !SOURCE_STATUSES.has(slice.status as TokenFactsSourceStatus)
  ) {
    return null;
  }
  const asOfMs = parseAsOfMs(slice.asOfMs);
  if (asOfMs === undefined) return null;
  if (slice.status === 'ok' && asOfMs === null) return null;
  const fields = parseFields(slice.fields);
  if (fields == null) return null;
  return {
    status: slice.status as TokenFactsSourceStatus,
    asOfMs,
    fields,
  };
}

function parseEvidence(raw: unknown): RiskFlag['evidence'] | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: RiskFlag['evidence'] = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key !== 'string' || key.length === 0) return null;
    if (
      value !== null &&
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      return null;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    out[key] = value;
  }
  return out;
}

function parseRiskFlag(raw: unknown): RiskFlag | null {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  if (
    typeof f.code !== 'string' ||
    !RISK_FLAG_CODES.has(f.code as RiskFlagCode) ||
    typeof f.severity !== 'string' ||
    !RISK_SEVERITIES.has(f.severity as RiskSeverity) ||
    typeof f.reason !== 'string' ||
    typeof f.userLine !== 'string' ||
    typeof f.source !== 'string' ||
    !RISK_FLAG_SOURCES.has(f.source as RiskFlagSource) ||
    typeof f.blocking !== 'boolean'
  ) {
    return null;
  }
  const evidence = parseEvidence(f.evidence);
  if (evidence == null) return null;
  return {
    code: f.code as RiskFlagCode,
    severity: f.severity as RiskSeverity,
    reason: f.reason,
    userLine: f.userLine,
    source: f.source as RiskFlagSource,
    blocking: f.blocking,
    evidence,
  };
}

/**
 * Parse and validate a TokenFacts API body. Returns null on any schema violation.
 */
export function parseTokenFactsResponse(
  raw: unknown,
  expected: { mint: string; cluster: PriceCluster },
): TokenFactsResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;

  if (body.schemaVersion !== TOKEN_FACTS_SCHEMA_VERSION) return null;
  if (typeof body.mint !== 'string' || body.mint.length === 0) return null;
  if (body.mint !== expected.mint) return null;
  if (body.cluster !== expected.cluster) return null;
  if (
    typeof body.status !== 'string' ||
    !API_STATUSES.has(body.status as TokenFactsApiStatus)
  ) {
    return null;
  }
  if (!isFiniteNumber(body.asOfMs) || body.asOfMs < 0) return null;
  if (!isFiniteNumber(body.cacheTtlSec) || body.cacheTtlSec < 0) return null;
  if (!body.sources || typeof body.sources !== 'object') return null;

  const sourcesRaw = body.sources as Record<string, unknown>;
  const chain = parseSourceSlice(sourcesRaw.chain, parseChainFields);
  const jupiter = parseSourceSlice(sourcesRaw.jupiter, parseJupiterFields);
  const rugcheck = parseSourceSlice(sourcesRaw.rugcheck, parseRugcheckFields);
  if (chain == null || jupiter == null || rugcheck == null) return null;

  if (!Array.isArray(body.flags)) return null;
  const flags: RiskFlag[] = [];
  for (const entry of body.flags) {
    const flag = parseRiskFlag(entry);
    if (flag == null) return null;
    flags.push(flag);
  }

  return {
    schemaVersion: TOKEN_FACTS_SCHEMA_VERSION,
    mint: body.mint,
    cluster: expected.cluster,
    status: body.status as TokenFactsApiStatus,
    asOfMs: body.asOfMs,
    cacheTtlSec: body.cacheTtlSec,
    sources: { chain, jupiter, rugcheck },
    flags,
  };
}

/** Map API status to hook-visible status (partial still carries data → ready). */
export function hookStatusFromApiStatus(
  status: TokenFactsApiStatus,
): 'ready' | 'unavailable' | 'disabled' {
  if (status === 'disabled') return 'disabled';
  if (status === 'unavailable') return 'unavailable';
  return 'ready';
}
