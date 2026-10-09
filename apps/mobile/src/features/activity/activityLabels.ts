import type { ActivityFilter, ActivityItem, ActivityKind } from './types';
import { copy } from '@/constants/copy';
import { USDC_MINT_MAINNET } from '@/src/features/balances/usdcConstants';

export type ActivityListRowPresentation =
  | {
      variant: 'activity';
      type: 'sent' | 'received' | 'swapped';
      status: ActivityItem['status'];
      title: string;
      counterparty: string;
      time: string;
      signedAmount: string;
    }
  | {
      variant: 'generic';
      title: string;
      meta: string;
      statusLabel: string;
      amount?: string;
    };

function activityStatusLabel(status: ActivityItem['status']): string {
  if (status === 'pending') return copy.activity.statusPending;
  if (status === 'failed') return copy.activity.statusFailed;
  return copy.activity.statusConfirmed;
}

function isSignedActivityAmount(amount: string): boolean {
  return /^[+\-\u2212]/u.test(amount);
}

/** Fail closed when ActivityRow cannot truthfully represent kind or amount. */
export function resolveActivityListRow(
  item: ActivityItem,
  fields: { amount: string | null; counterparty: string; time: string },
): ActivityListRowPresentation {
  if (
    fields.amount !== null &&
    isSignedActivityAmount(fields.amount) &&
    (item.kind === 'sent' || item.kind === 'received' || item.kind === 'swap')
  ) {
    return {
      variant: 'activity',
      type: item.kind === 'swap' ? 'swapped' : item.kind,
      status: item.status,
      title: item.title,
      counterparty: fields.counterparty,
      time: fields.time,
      signedAmount: fields.amount,
    };
  }

  return {
    variant: 'generic',
    title: item.title,
    meta: [fields.counterparty, fields.time].filter(Boolean).join(' · '),
    statusLabel: activityStatusLabel(item.status),
    ...(fields.amount !== null ? { amount: fields.amount } : {}),
  };
}

export type ActivityListSourceState =
  | 'loading'
  | 'error'
  | 'empty'
  | 'filtered-empty'
  | 'sent'
  | 'received'
  | 'swap'
  | 'generic';

export function resolveActivityListState(input: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  itemCount: number;
  filteredCount: number;
  rowKind?: ActivityItem['kind'];
  hasAmount?: boolean;
}): ActivityListSourceState {
  if (input.status === 'loading' && input.itemCount === 0) return 'loading';
  if (input.status === 'error') return 'error';
  if (input.status === 'ready' && input.itemCount === 0) return 'empty';
  if (input.status === 'ready' && input.filteredCount === 0) return 'filtered-empty';
  if (input.hasAmount !== true) return 'generic';
  if (input.rowKind === 'sent' || input.rowKind === 'received' || input.rowKind === 'swap') {
    return input.rowKind;
  }
  return 'generic';
}

export type ActivityDetailSourceState =
  | 'loading'
  | 'signed-out'
  | 'unavailable'
  | 'missing'
  | 'sent'
  | 'received'
  | 'swap'
  | 'pending'
  | 'failed';

export function resolveActivityDetailState(input: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  item: ActivityItem | null;
  hasAddress?: boolean;
}): ActivityDetailSourceState {
  if (input.hasAddress === false) return 'signed-out';
  if (
    (input.status === 'idle' || input.status === 'loading') &&
    input.item === null
  ) {
    return 'loading';
  }
  if (input.status === 'error' && input.item === null) return 'unavailable';
  if (input.status === 'ready' && input.item === null) return 'missing';
  if (input.item === null) return 'unavailable';
  if (input.item.status === 'pending') return 'pending';
  if (input.item.status === 'failed') return 'failed';
  if (input.item.kind === 'received') return 'received';
  if (input.item.kind === 'swap') return 'swap';
  return 'sent';
}

export function matchesActivityFilter(
  item: ActivityItem,
  filter: ActivityFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return item.status === 'pending';
  if (filter === 'sent') return item.kind === 'sent';
  if (filter === 'received') return item.kind === 'received';
  return true;
}

export function activityKindLabel(kind: ActivityKind): string {
  switch (kind) {
    case 'sent':
      return 'Sent';
    case 'received':
      return 'Received';
    case 'swap':
      return 'Swap';
    default:
      return 'Transaction';
  }
}

export function activityTitle(kind: ActivityKind, symbol = 'SOL'): string {
  switch (kind) {
    case 'sent':
      return `Sent ${symbol}`;
    case 'received':
      return `Received ${symbol}`;
    case 'swap':
      return swappedTitle(symbol);
    default:
      return 'Transaction';
  }
}

function swappedTitle(symbol: string): string {
  return `Swapped ${symbol}`;
}

/**
 * Stored records that can lift a row's title past what the chain read alone
 * proves. Both are keyed by this row's signature; neither comes from the chain.
 */
export type ActivityRowLabelEvidence = {
  /** The swap intent saved at Sign for this signature, owner and cluster. */
  swap?: {
    pay: { mint: string; symbol: string };
    receive: { mint: string; symbol: string };
  } | null;
  /** A stored Corso ramp order whose delivery signature is this signature. */
  rampDelivery?: boolean;
};

const isUsdc = (mint: string | null | undefined) => mint === USDC_MINT_MAINNET;

/** A symbol fit for a label: present, and not a token passing itself off as USDC. */
function labelSymbol(token: { mint: string; symbol: string }): string | null {
  const symbol = token.symbol.trim();
  if (symbol === '') return null;
  if (symbol.toUpperCase() === 'USDC' && !isUsdc(token.mint)) return null;
  return symbol;
}

export function resolveActivityRowTitle(
  item: Pick<ActivityItem, 'kind' | 'status' | 'title' | 'tokenMint' | 'tokenAmountAtomic'>,
  evidence: ActivityRowLabelEvidence = {},
): string {
  if (item.status !== 'confirmed' || item.kind === 'unknown') return item.title;
  const swap = evidence.swap;
  if (swap) {
    const paidUsdc = isUsdc(swap.pay.mint);
    const gotUsdc = isUsdc(swap.receive.mint);
    if (paidUsdc && !gotUsdc) {
      const symbol = labelSymbol(swap.receive);
      return symbol === null ? item.title : `Bought ${symbol}`;
    }
    if (gotUsdc && !paidUsdc) {
      const symbol = labelSymbol(swap.pay);
      return symbol === null ? item.title : `Sold ${symbol}`;
    }
    const symbol = paidUsdc ? null : labelSymbol(swap.receive);
    return symbol === null ? item.title : swappedTitle(symbol);
  }
  if (
    item.kind === 'received' &&
    evidence.rampDelivery === true &&
    isUsdc(item.tokenMint) &&
    item.tokenAmountAtomic !== null
  ) {
    return 'Added cash';
  }
  return item.title;
}
