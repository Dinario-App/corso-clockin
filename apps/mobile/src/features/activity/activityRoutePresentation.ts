import { copy } from '@/constants/copy';
import { isFeeRateLabel } from '@/src/lib/feeRateLabel';
import {
  resolveActivityDetailState,
  resolveActivityListState,
  type ActivityDetailSourceState,
  type ActivityListRowPresentation,
  type ActivityListSourceState,
} from './activityLabels.js';
import type { ActivityFilter, ActivityItem } from './types.js';

export type ActivityListFrame =
  | 'F106'
  | 'F107'
  | 'F108'
  | 'F109'
  | 'F110'
  | 'F111'
  | 'F112'
  | 'F113';

export type ActivityDetailFrame =
  | 'F114'
  | 'F115'
  | 'F116'
  | 'F117'
  | 'F118'
  | 'F119';

export type ActivityToastFrame = 'F120';

export const ACTIVITY_FILTER_ORDER: readonly ActivityFilter[] = [
  'all',
  'pending',
  'sent',
  'received',
] as const;

export const ACTIVITY_DETAIL_FEE_LABEL = 'Network fee';

export const ACTIVITY_FORBIDDEN_LABELS = [
  'Import recovery phrase',
  'Connect an existing wallet',
  'Connect wallet',
  'Seed Vault',
  'Passkey',
  'Switch account',
  'Disconnect',
  'Imported wallet',
  'Connected wallet',
  'Autopilot',
  'Daily cap',
  'Arm ',
  'Corso fee',
  '85 bps',
  '0.85%',
  'No fees',
  'No Corso fee',
  'Total fees',
  'Summary',
  'What this means',
  'PnL',
  'Performance',
  'Leaderboard',
  'Cancel transaction',
  'Reverse',
  'Recall',
  'Recover transaction',
  'Privy',
  'Squads',
  'Jupiter',
  'MoonPay',
] as const;

export function assertNoForbiddenActivityLabels(labels: unknown[]): void {
  for (const label of labels) {
    if (typeof label !== 'string') {
      continue;
    }
    const normalized = label.toLowerCase();
    if (
      isFeeRateLabel(label) ||
      ACTIVITY_FORBIDDEN_LABELS.some((forbidden) => normalized.includes(forbidden.toLowerCase()))
    ) {
      throw new Error(`Forbidden Activity label: ${label}`);
    }
  }
}

export function assertActivityFeeLabelIsNetworkOnly(label: unknown): string {
  if (label !== ACTIVITY_DETAIL_FEE_LABEL) {
    throw new Error(
      `Activity detail fee label must stay ${ACTIVITY_DETAIL_FEE_LABEL}`,
    );
  }
  return label;
}

export function assertLockedActivityFilterSet(labels: unknown[]): void {
  const expected = [
    copy.activity.filterAll,
    copy.activity.filterPending,
    copy.activity.filterSent,
    copy.activity.filterReceived,
  ];
  if (labels.length !== expected.length) {
    throw new Error('Activity filter set must be exactly four segments');
  }
  expected.forEach((label, index) => {
    if (labels[index] !== label) {
      throw new Error(`Activity filter ${index} must be ${label}`);
    }
  });
}

export type ActivityListChrome = {
  frame: ActivityListFrame;
  state: ActivityListSourceState;
  showRows: boolean;
  message: string | null;
};

export function resolveActivityListChrome(input: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  itemCount: number;
  filteredCount: number;
  filter: ActivityFilter;
}): ActivityListChrome {
  const state = resolveActivityListState({
    status: input.status,
    itemCount: input.itemCount,
    filteredCount: input.filteredCount,
  });

  if (state === 'loading') {
    return {
      frame: 'F112',
      state,
      showRows: false,
      message: copy.activity.loading,
    };
  }
  if (state === 'error') {
    return {
      frame: 'F113',
      state,
      showRows: false,
      message: copy.activity.error,
    };
  }
  if (state === 'empty') {
    return { frame: 'F110', state, showRows: false, message: copy.activity.empty };
  }
  if (state === 'filtered-empty') {
    return {
      frame: 'F111',
      state,
      showRows: false,
      message: copy.activity.emptyFiltered,
    };
  }

  return {
    frame: listFilterFrame(input.filter),
    state,
    showRows: true,
    message: null,
  };
}

function listFilterFrame(filter: ActivityFilter): ActivityListFrame {
  if (filter === 'pending') return 'F107';
  if (filter === 'sent') return 'F108';
  if (filter === 'received') return 'F109';
  return 'F106';
}

export function resolveActivityErrorMessage(_rawError?: unknown): string {
  return copy.activity.error;
}

export type ActivityGenericRowText = {
  title: string;
  meta: string;
  trailing: string;
  accessibilityLabel: string;
};

export function resolveActivityGenericRowText(
  row: Extract<ActivityListRowPresentation, { variant: 'generic' }>,
): ActivityGenericRowText {
  const trailing = row.amount ?? row.statusLabel;
  const meta = row.amount ? `${row.meta} · ${row.statusLabel}` : row.meta;
  return {
    title: row.title,
    meta,
    trailing,
    accessibilityLabel: `${row.title}, ${meta}, ${trailing}`,
  };
}

export type ActivityDetailChrome = {
  /** `null` while the fetch has not resolved into a frame. */
  frame: ActivityDetailFrame | null;
  state: ActivityDetailSourceState;
  showDetail: boolean;
  message: string | null;
  statusLabel: string | null;
  statusEmphasis: 'default' | 'warning';
};

export function resolveActivityDetailChrome(input: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  item: ActivityItem | null;
  hasAddress?: boolean;
}): ActivityDetailChrome {
  const state = resolveActivityDetailState(input);

  if (state === 'signed-out') {
    return {
      frame: null,
      state,
      showDetail: false,
      message: copy.activity.signedOut,
      statusLabel: null,
      statusEmphasis: 'default',
    };
  }
  if (state === 'loading') {
    return {
      frame: null,
      state,
      showDetail: false,
      message: copy.activity.loading,
      statusLabel: null,
      statusEmphasis: 'default',
    };
  }
  if (state === 'unavailable') {
    return {
      frame: null,
      state,
      showDetail: false,
      message: resolveActivityErrorMessage(),
      statusLabel: null,
      statusEmphasis: 'default',
    };
  }
  if (state === 'missing') {
    return {
      frame: 'F119',
      state,
      showDetail: false,
      message: copy.activity.missing,
      statusLabel: null,
      statusEmphasis: 'default',
    };
  }

  const statusLabel = resolveActivityStatusLabel(input.item?.status);
  return {
    frame: detailItemFrame(state),
    state,
    showDetail: true,
    message: null,
    statusLabel,
    statusEmphasis: state === 'failed' ? 'warning' : 'default',
  };
}

function detailItemFrame(
  state: ActivityDetailSourceState,
): ActivityDetailFrame {
  if (state === 'pending') return 'F117';
  if (state === 'failed') return 'F118';
  if (state === 'received') return 'F116';
  if (state === 'swap') return 'F115';
  return 'F114';
}

export function resolveActivityStatusLabel(
  status: ActivityItem['status'] | undefined,
): string | null {
  if (status === 'pending') return copy.activity.statusPending;
  if (status === 'failed') return copy.activity.statusFailed;
  if (status === 'confirmed') return copy.activity.statusConfirmed;
  return null;
}

export type ActivityCopyToast = {
  frame: ActivityToastFrame;
  message: string;
} | null;

export function resolveActivityCopyToast(outcome: 'copied' | 'failed' | null): ActivityCopyToast {
  if (outcome === 'copied') {
    return { frame: 'F120', message: copy.activity.toastCopied };
  }
  if (outcome === 'failed') {
    return { frame: 'F120', message: copy.activity.toastCopyFailed };
  }
  return null;
}
