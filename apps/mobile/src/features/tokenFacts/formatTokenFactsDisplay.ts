import { copy } from '@/constants/copy';
import { disclosureFlags } from '@/src/features/tokenFacts/disclosurePolicy';
import {
  resolveRugcheckReviewPresentation,
  type RugcheckReviewPresentation,
} from '@/src/features/tokenFacts/rugcheckReviewPresentation';
import { calculateInverseTransferFee } from '@/src/features/tokens/transferFeeMath';
import type {
  AuthorityStatus,
  TokenFactsHookStatus,
  TokenFactsResponse,
  TokenFactsSourceStatus,
} from '@/src/features/tokenFacts/types';

export type TokenFactsDisplayRow = {
  label: string;
  value: string;
  valueTone?: 'riskDanger';
};

export type TokenFactsPanelModel = {
  banner?: string;
  rows: TokenFactsDisplayRow[];
  /** Source-confirmed absence only; warnings and unknowns remain in rows. */
  collapsedRows?: TokenFactsDisplayRow[];
  notes?: string[];
  footnote?: string;
};

export type TokenIdentityPresentation = {
  mintLabel: string;
  verificationLabel: string;
  verificationTone: 'default' | 'riskDanger';
  liquidityLabel: string | null;
};

/** Exact-mint identity chrome for one picker row. No provider field is inferred. */
export function buildTokenIdentityPresentation(args: {
  mint: string;
  isVerified: boolean | null;
  liquidityUsd: number | null;
}): TokenIdentityPresentation {
  const tail = args.mint.slice(-5);
  const verification =
    args.isVerified === true
      ? {
          label: copy.tokenFacts.verified,
          tone: 'default' as const,
        }
      : args.isVerified === false
        ? {
            label: copy.tokenFacts.unverified,
            tone: 'riskDanger' as const,
          }
        : {
            label: copy.tokenFacts.verificationUnknown,
            tone: 'riskDanger' as const,
          };

  return {
    mintLabel: copy.tokenFacts.mintTail(tail),
    verificationLabel: verification.label,
    verificationTone: verification.tone,
    liquidityLabel:
      args.liquidityUsd != null &&
      Number.isFinite(args.liquidityUsd) &&
      args.liquidityUsd >= 0
        ? `${formatOptionalUsd(args.liquidityUsd)} liquidity`
        : null,
  };
}

export function formatAuthorityStatus(
  status: AuthorityStatus | null | undefined,
): string {
  if (status === 'renounced') return copy.tokenFacts.renounced;
  if (status === 'present') return copy.tokenFacts.active;
  return copy.tokenFacts.unknown;
}

export function formatOptionalUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return copy.tokenFacts.unknown;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatOptionalPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return copy.tokenFacts.unknown;
  const trimmed = value.toFixed(2).replace(/\.?0+$/, '');
  return `${trimmed}%`;
}

export function formatOptionalBoolean(
  value: boolean | null | undefined,
): string {
  if (value === true) return copy.tokenFacts.yes;
  if (value === false) return copy.tokenFacts.no;
  return copy.tokenFacts.unknown;
}

export function isTokenFactsStale(
  facts: TokenFactsResponse,
  nowMs: number,
): boolean {
  return nowMs - facts.asOfMs > facts.cacheTtlSec * 1000;
}

function chainField<T>(
  sourceStatus: TokenFactsSourceStatus,
  value: T | null,
  format: (next: T) => string,
): string {
  if (sourceStatus !== 'ok') return copy.tokenFacts.unknown;
  if (value === null) return copy.tokenFacts.unknown;
  return format(value);
}

function jupiterField<T>(
  sourceStatus: TokenFactsSourceStatus,
  value: T | null,
  format: (next: T) => string,
): string {
  if (sourceStatus !== 'ok') return copy.tokenFacts.unknown;
  if (value === null) return copy.tokenFacts.unknown;
  return format(value);
}

function rugcheckField<T>(
  sourceStatus: TokenFactsSourceStatus,
  value: T | null,
  format: (next: T) => string,
): string {
  if (sourceStatus !== 'ok') return copy.tokenFacts.unknown;
  if (value === null) return copy.tokenFacts.unknown;
  return format(value);
}

function panelBanner(
  status: TokenFactsHookStatus,
  facts: TokenFactsResponse | null,
): string | undefined {
  if (status === 'idle' || status === 'loading') return copy.tokenFacts.loading;
  if (status === 'error') return copy.tokenFacts.unavailable;
  if (status === 'disabled' || facts?.status === 'disabled') {
    return copy.tokenFacts.disabled;
  }
  if (status === 'unavailable' || facts?.status === 'unavailable') {
    return copy.tokenFacts.unavailable;
  }
  return undefined;
}

function disclosureNotes(facts: TokenFactsResponse | null): string[] {
  if (!facts) return [];
  return disclosureFlags(facts.flags).map((flag) => flag.userLine);
}

function formatTransferFeeValue(
  sourceStatus: TokenFactsSourceStatus,
  fields: TokenFactsResponse['sources']['chain']['fields'],
): string {
  if (sourceStatus !== 'ok') return copy.tokenFacts.unknown;
  if (fields.transferFee !== true) {
    return formatOptionalBoolean(fields.transferFee);
  }
  if (fields.transferFeeBasisPoints != null) {
    return copy.tokenFacts.transferFeeConfigured(fields.transferFeeBasisPoints);
  }
  return copy.tokenFacts.yes;
}

function formatTransferHookProgramValue(
  sourceStatus: TokenFactsSourceStatus,
  fields: TokenFactsResponse['sources']['chain']['fields'],
): string {
  if (sourceStatus !== 'ok') return copy.tokenFacts.unknown;
  if (fields.transferHookProgramId != null) return fields.transferHookProgramId;
  if (fields.transferHook === true) return copy.tokenFacts.unknown;
  if (fields.transferHook === false) return copy.tokenFacts.none;
  return copy.tokenFacts.unknown;
}

function formatTransferHookAuthorityValue(
  sourceStatus: TokenFactsSourceStatus,
  fields: TokenFactsResponse['sources']['chain']['fields'],
): string {
  if (sourceStatus !== 'ok') return copy.tokenFacts.unknown;
  if (fields.transferHookAuthority != null) return fields.transferHookAuthority;
  if (fields.transferHook === true) return copy.tokenFacts.unknown;
  if (fields.transferHook === false) return copy.tokenFacts.none;
  return copy.tokenFacts.unknown;
}

function formatPermanentDelegateAddressValue(
  sourceStatus: TokenFactsSourceStatus,
  fields: TokenFactsResponse['sources']['chain']['fields'],
): string {
  if (sourceStatus !== 'ok') return copy.tokenFacts.unknown;
  if (fields.permanentDelegateAddress != null) {
    return fields.permanentDelegateAddress;
  }
  if (fields.permanentDelegate === true) return copy.tokenFacts.unknown;
  if (fields.permanentDelegate === false) return copy.tokenFacts.none;
  return copy.tokenFacts.unknown;
}

function transferFeeEstimateNote(
  fields: TokenFactsResponse['sources']['chain']['fields'],
  receiveAmountAtomic: bigint | null | undefined,
  receiveDecimals: number | null | undefined,
): string | null {
  if (
    fields.transferFee !== true ||
    fields.transferFeeBasisPoints == null ||
    fields.transferFeeMaximum == null ||
    receiveAmountAtomic == null ||
    receiveDecimals == null
  ) {
    return null;
  }
  const fee = calculateInverseTransferFee({
    postFeeAmount: receiveAmountAtomic,
    transferFeeBasisPoints: fields.transferFeeBasisPoints,
    maximumFee: BigInt(fields.transferFeeMaximum),
  });
  if (fee == null || fee === 0n) return null;
  const divisor = 10 ** receiveDecimals;
  const whole = fee / BigInt(divisor);
  const fraction = fee % BigInt(divisor);
  const fractionText = fraction
    .toString()
    .padStart(receiveDecimals, '0')
    .replace(/0+$/, '');
  const amountText =
    fractionText.length > 0 ? `${whole}.${fractionText}` : whole.toString();
  return copy.tokenFacts.transferFeeEstimated(amountText);
}

/** Full facts rows for Swap Review and similar panels. */
export function buildSwapReviewFactsPanel(args: {
  status: TokenFactsHookStatus;
  facts: TokenFactsResponse | null;
  error: string | null;
  nowMs: number;
  receiveAmountAtomic?: bigint | string | null;
  receiveDecimals?: number | null;
  collapseAbsence?: boolean;
}): TokenFactsPanelModel {
  const { status, facts, nowMs } = args;
  const banner = panelBanner(status, facts);

  if (!facts || status === 'loading' || status === 'error') {
    return { banner, rows: [], notes: disclosureNotes(facts) };
  }

  if (status === 'disabled' || facts.status === 'disabled') {
    return { banner, rows: [], notes: disclosureNotes(facts) };
  }

  const chain = facts.sources.chain;
  const jupiter = facts.sources.jupiter;
  const rugcheck = facts.sources.rugcheck;
  const panelRisk = buildPickerRowRisk({ status, facts });

  // The raw source proves absence; display strings never decide safety.
  const fields = chain.fields;
  const hookAbsent = fields.transferHook === false &&
    fields.transferHookProgramId === null && fields.transferHookAuthority === null;
  const delegateAbsent = fields.permanentDelegate === false && fields.permanentDelegateAddress === null;
  const rows: (TokenFactsDisplayRow & { confirmedAbsent?: boolean })[] = [
    {
      label: copy.tokenFacts.mintAuthority,
      confirmedAbsent: fields.mintAuthority === 'renounced',
      value: chainField(chain.status, chain.fields.mintAuthority, formatAuthorityStatus),
    },
    {
      label: copy.tokenFacts.freezeAuthority,
      confirmedAbsent: fields.freezeAuthority === 'renounced',
      value: chainField(chain.status, chain.fields.freezeAuthority, formatAuthorityStatus),
    },
    {
      label: copy.tokenFacts.transferFee,
      confirmedAbsent: fields.transferFee === false && (fields.transferFeeBasisPoints === null || fields.transferFeeBasisPoints === 0),
      value: formatTransferFeeValue(chain.status, chain.fields),
    },
    {
      label: copy.tokenFacts.transferHook,
      confirmedAbsent: hookAbsent,
      value: chainField(chain.status, chain.fields.transferHook, formatOptionalBoolean),
    },
    {
      label: copy.tokenFacts.transferHookProgram,
      confirmedAbsent: hookAbsent,
      value: formatTransferHookProgramValue(chain.status, chain.fields),
    },
    {
      label: copy.tokenFacts.transferHookAuthority,
      confirmedAbsent: hookAbsent,
      value: formatTransferHookAuthorityValue(chain.status, chain.fields),
    },
    {
      label: copy.tokenFacts.permanentDelegate,
      confirmedAbsent: delegateAbsent,
      value: chainField(
        chain.status,
        chain.fields.permanentDelegate,
        formatOptionalBoolean,
      ),
    },
    {
      label: copy.tokenFacts.permanentDelegateAddress,
      confirmedAbsent: delegateAbsent,
      value: formatPermanentDelegateAddressValue(chain.status, chain.fields),
    },
    {
      label: copy.tokenFacts.defaultAccountFrozen,
      confirmedAbsent: fields.defaultAccountFrozen === false,
      value: chainField(
        chain.status,
        chain.fields.defaultAccountFrozen,
        formatOptionalBoolean,
      ),
    },
    {
      label: copy.tokenFacts.topHolders,
      value: jupiterField(
        jupiter.status,
        jupiter.fields.topHoldersPct,
        formatOptionalPercent,
      ),
    },
    {
      label: copy.tokenFacts.liquidity,
      value: jupiterField(
        jupiter.status,
        jupiter.fields.liquidityUsd,
        formatOptionalUsd,
      ),
    },
    {
      label: copy.tokenFacts.lpLocked,
      value: rugcheckField(
        rugcheck.status,
        rugcheck.fields.lpLockedPct,
        formatOptionalPercent,
      ),
      valueTone:
        panelRisk.dangerTone === 'riskDanger' ? 'riskDanger' : undefined,
    },
  ];

  const notes = disclosureNotes(facts);
  const receiveAtomic =
    args.receiveAmountAtomic == null
      ? null
      : typeof args.receiveAmountAtomic === 'string'
        ? BigInt(args.receiveAmountAtomic)
        : args.receiveAmountAtomic;
  const feeNote = transferFeeEstimateNote(
    chain.fields,
    receiveAtomic,
    args.receiveDecimals ?? null,
  );
  const allNotes = feeNote != null ? [...notes, feeNote] : notes;
  const footnotes: string[] = [];
  if (facts.status === 'partial') {
    footnotes.push(copy.tokenFacts.partial);
  }
  if (isTokenFactsStale(facts, nowMs)) {
    footnotes.push(copy.tokenFacts.stale);
  }

  const canCollapse = args.collapseAbsence === true && status === 'ready' &&
    facts.status === 'ready' && chain.status === 'ok' &&
    !isTokenFactsStale(facts, nowMs) && nowMs >= facts.asOfMs &&
    chain.asOfMs != null && nowMs >= chain.asOfMs &&
    nowMs - chain.asOfMs <= facts.cacheTtlSec * 1000;
  const plainRow = ({ confirmedAbsent: _absence, ...row }: typeof rows[number]) => row;
  const collapsedRows = canCollapse ? rows.filter(row => row.confirmedAbsent === true).map(plainRow) : [];
  const surfaceRows = rows.filter(row => !canCollapse || row.confirmedAbsent !== true).map(row => ({
    ...plainRow(row),
    ...(canCollapse && row.confirmedAbsent === false ? { valueTone: 'riskDanger' as const } : {}),
  }));
  return {
    banner,
    rows: surfaceRows,
    ...(collapsedRows.length > 0 ? { collapsedRows } : {}),
    notes: allNotes.length > 0 ? allNotes : undefined,
    footnote: footnotes.length > 0 ? footnotes.join(' ') : undefined,
  };
}

export function buildPickerRowRisk(args: {
  status: TokenFactsHookStatus;
  facts: TokenFactsResponse | null;
}): RugcheckReviewPresentation {
  const { status, facts } = args;
  const resolved =
    status === 'ready' &&
    facts != null &&
    facts.status !== 'disabled' &&
    facts.status !== 'unavailable' &&
    facts.sources.rugcheck.status === 'ok'
      ? facts.sources.rugcheck
      : null;

  return resolveRugcheckReviewPresentation({
    tier: resolved?.fields.riskLevel ?? null,
    descriptions: resolved?.fields.riskDescriptions ?? [],
  });
}

/** Compact one-line summary for token picker rows. */
export function buildPickerFactsSubtitle(args: {
  status: TokenFactsHookStatus;
  facts: TokenFactsResponse | null;
  error: string | null;
  nowMs: number;
  /** Picker identity line already supplies liquidity and verification. */
  includeIdentity?: boolean;
}): string {
  const { status, facts, nowMs } = args;

  if (status === 'idle' || status === 'loading') return copy.tokenFacts.loading;
  if (status === 'error') return copy.tokenFacts.unavailable;
  if (status === 'disabled' || facts?.status === 'disabled') {
    return copy.tokenFacts.disabled;
  }
  if (!facts) return copy.tokenFacts.unavailable;

  const parts: string[] = [];
  const name = facts.sources.jupiter.fields.name;
  const symbol = facts.sources.jupiter.fields.symbol;
  if (facts.sources.jupiter.status === 'ok' && name) {
    parts.push(symbol ? `${name} (${symbol})` : name);
  }

  if (args.includeIdentity !== false) {
    const liquidity = facts.sources.jupiter.fields.liquidityUsd;
    if (facts.sources.jupiter.status === 'ok' && liquidity != null) {
      parts.push(`${formatOptionalUsd(liquidity)} liquidity`);
    } else if (facts.sources.jupiter.status !== 'ok') {
      parts.push(`${copy.tokenFacts.liquidity} ${copy.tokenFacts.unknown.toLowerCase()}`);
    }

    const verified = facts.sources.jupiter.fields.isVerified;
    if (facts.sources.jupiter.status === 'ok' && verified === true) {
      parts.push(copy.tokenFacts.verified);
    }
  }

  const flagLines = disclosureNotes(facts);
  if (flagLines.length === 1) {
    parts.push(flagLines[0]!);
  } else if (flagLines.length > 1) {
    parts.push(copy.tokenFacts.flagSummary(flagLines.length));
  }

  if (facts.status === 'partial') {
    parts.push(copy.tokenFacts.partialShort);
  }
  if (isTokenFactsStale(facts, nowMs)) {
    parts.push(copy.tokenFacts.staleShort);
  }

  return parts.length > 0 ? parts.join(' · ') : copy.tokenFacts.unavailable;
}
