import type { TextStyle, ViewStyle } from 'react-native';
import { copy } from '@/constants/copy';
import { colors, spacing, typography } from '@/src/ui/tokens';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';

export const ACTIVITY_ROW_WIDTH = 353;
export const ACTIVITY_ROW_HEIGHT = 64;
export const ACTIVITY_ROW_ICON_SIZE = 22;
export const ACTIVITY_ROW_STATUS_ICON_SIZE = 12;
export const ACTIVITY_ROW_AMOUNT_FONT_VARIANT: TextStyle['fontVariant'] = [
  ...typography.fontVariantTabular,
];

export const ACTIVITY_ROW_TYPES = ['sent', 'received', 'swapped'] as const;
export const ACTIVITY_ROW_STATUSES = [
  'pending',
  'confirmed',
  'failed',
] as const;

export type ActivityRowType = (typeof ACTIVITY_ROW_TYPES)[number];
export type ActivityRowStatus = (typeof ACTIVITY_ROW_STATUSES)[number];

export type ActivityRowPresentation = {
  containerStyle: ViewStyle;
  iconWrapStyle: ViewStyle;
  iconName: CorsoIconName;
  iconSize: number;
  iconColor: string;
  contentStyle: ViewStyle;
  titleStyle: TextStyle;
  metaStyle: TextStyle;
  rightStyle: ViewStyle;
  amountStyle: TextStyle;
  statusRowStyle: ViewStyle;
  statusIconName: CorsoIconName;
  statusIconSize: number;
  statusIconColor: string;
  statusStyle: TextStyle;
  titleText: string;
  metaText: string;
  amountText: string;
  statusText: string;
  accessibilityRole: 'button';
  accessibilityLabel: string;
};

function assertStringField(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`ActivityRow ${field} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`ActivityRow ${field} must be a non-empty string`);
  }

  return trimmed;
}

function assertActivityRowType(value: unknown): ActivityRowType {
  if (value !== 'sent' && value !== 'received' && value !== 'swapped') {
    throw new Error('ActivityRow type must be sent, received, or swapped');
  }
  return value;
}

function assertActivityRowStatus(value: unknown): ActivityRowStatus {
  if (value !== 'pending' && value !== 'confirmed' && value !== 'failed') {
    throw new Error(
      'ActivityRow status must be pending, confirmed, or failed',
    );
  }
  return value;
}

function iconForType(type: ActivityRowType): CorsoIconName {
  switch (type) {
    case 'sent':
      return 'activity.sent';
    case 'received':
      return 'activity.received';
    case 'swapped':
      return 'activity.swap';
  }
}

function statusCopy(status: ActivityRowStatus): string {
  switch (status) {
    case 'pending':
      return copy.activity.statusPending;
    case 'confirmed':
      return copy.activity.statusConfirmed;
    case 'failed':
      return copy.activity.statusFailed;
  }
}

function statusIconForStatus(status: ActivityRowStatus): CorsoIconName {
  switch (status) {
    case 'pending':
      return 'spinner';
    case 'confirmed':
      return 'check';
    case 'failed':
      return 'warning';
  }
}

function assertSignedAmount(value: unknown): string {
  const amount = assertStringField(value, 'signedAmount');
  if (!/^[+\-\u2212]/u.test(amount)) {
    throw new Error(
      'ActivityRow signedAmount must start with +, -, or −',
    );
  }
  return amount;
}

/**
 * Pure presentation resolver for the 353x64 Activity row.
 * It owns the fail-closed runtime contract so screen wiring cannot invent
 * visible or spoken behavior for hostile row data.
 */
export function resolveActivityRowPresentation(input: {
  type: unknown;
  status: unknown;
  title: unknown;
  counterparty: unknown;
  time: unknown;
  signedAmount: unknown;
}): ActivityRowPresentation {
  const type = assertActivityRowType(input.type);
  const status = assertActivityRowStatus(input.status);
  const titleText = assertStringField(input.title, 'title');
  const counterpartyText = assertStringField(input.counterparty, 'counterparty');
  const timeText = assertStringField(input.time, 'time');
  const amountText = assertSignedAmount(input.signedAmount);
  const statusText = statusCopy(status);

  return {
    containerStyle: {
      width: ACTIVITY_ROW_WIDTH,
      height: ACTIVITY_ROW_HEIGHT,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconWrapStyle: {
      width: ACTIVITY_ROW_ICON_SIZE,
      height: ACTIVITY_ROW_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconName: iconForType(type),
    iconSize: ACTIVITY_ROW_ICON_SIZE,
    iconColor: colors.ink,
    contentStyle: {
      flex: 1,
      minWidth: 0,
    },
    titleStyle: {
      color: colors.ink,
      fontSize: typography.body,
      lineHeight: 22,
      fontFamily: typography.face('600'),
      fontWeight: '600',
    },
    metaStyle: {
      color: colors.muted,
      fontSize: typography.caption,
      lineHeight: 18,
      fontFamily: typography.face('400'),
      fontWeight: '400',
    },
    rightStyle: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      maxWidth: 124,
    },
    amountStyle: {
      color: colors.ink,
      fontSize: typography.body,
      lineHeight: 22,
      fontFamily: typography.face('600'),
      fontWeight: '600',
      fontVariant: ACTIVITY_ROW_AMOUNT_FONT_VARIANT,
      textAlign: 'right',
    },
    statusRowStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: spacing.xs,
    },
    statusIconName: statusIconForStatus(status),
    statusIconSize: ACTIVITY_ROW_STATUS_ICON_SIZE,
    statusIconColor: colors.ink,
    statusStyle: {
      color: colors.ink,
      fontSize: typography.caption,
      lineHeight: 18,
      fontFamily: typography.face('500'),
      fontWeight: '500',
      textAlign: 'right',
    },
    titleText,
    metaText: `${counterpartyText} · ${timeText}`,
    amountText,
    statusText,
    accessibilityRole: 'button',
    accessibilityLabel: `${titleText}, ${counterpartyText}, ${timeText}, ${amountText}, ${statusText}`,
  };
}
