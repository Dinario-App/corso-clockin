import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { canonNumerals, canonTracking } from '@/src/ui/cards/canonType.js';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import {
  colors,
  kitType,
  kitWeight,
  radii,
  spacing,
  typography,
} from '@/src/ui/tokens';
import { ethena } from '@/constants/theme.ethena';

export const ACCOUNT_ROW_HEIGHT = 52;
export const ACCOUNT_ROW_LABEL_MAX_LINES = 2;
export const ACCOUNT_ROW_SUB_MAX_LINES = undefined;
export const ACCOUNT_ROW_VALUE_MAX_LINES = 2;
export const ACCOUNT_ROW_TEXT_MIN_SHARE = '50%' as const;
export const ACCOUNT_ROW_PADDING_VERTICAL = 0;
export const ACCOUNT_ROW_PADDING_HORIZONTAL = spacing.md;
export const ACCOUNT_ROW_GAP = 13;
/** The group card clips; the row itself is square inside it. */
export const ACCOUNT_ROW_RADIUS = 0;
export const ACCOUNT_ROW_ICON_WELL = null;
export const ACCOUNT_ROW_ICON_SIZE = 22;
export const ACCOUNT_ROW_CHEVRON_SIZE = 16;
export const ACCOUNT_ROW_CHEVRON_GLYPH: CorsoIconName = 'chevron-right';
/** pad 16 + icon 22 + gap 13. */
export const ACCOUNT_ROW_DIVIDER_INSET =
  ACCOUNT_ROW_PADDING_HORIZONTAL + ACCOUNT_ROW_ICON_SIZE + ACCOUNT_ROW_GAP;

export type AccountRowAccessory = 'chevron' | 'value' | 'switch' | 'none';

export type AccountRowFamily = 'grok' | 'desk';

export type AccountRowDivider = {
  color: string;
  insetLeft: number;
};

export type AccountRowPresentation = {
  containerStyle: ViewStyle;
  iconSlotStyle: ViewStyle;
  textColumnStyle: ViewStyle;
  labelStyle: TextStyle;
  subStyle: TextStyle;
  valueStyle: TextStyle;
  accessorySlotStyle: ViewStyle;
  dividerStyle: ViewStyle | null;
  labelText: string;
  subText: string | null;
  valueText: string | null;
  showChevron: boolean;
  showValue: boolean;
  showSwitchSlot: boolean;
  iconSize: number;
  iconColor: string;
  iconWell: null;
  valueColor: string;
  divider: AccountRowDivider | null;
  chevronGlyph: CorsoIconName;
  chevronSize: number;
  chevronColor: string;
  disabled: boolean;
  labelNumberOfLines: number;
  subNumberOfLines: number | undefined;
  valueNumberOfLines: number;
  /** Label, then sub, then value — what a screen reader announces. */
  accessibilityLabel: string;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveAccountRowPresentation(input: {
  label: unknown;
  sub?: unknown;
  accessory: AccountRowAccessory;
  value?: unknown;
  disabled?: unknown;
  /** Last row in a card — no hairline under it. */
  last?: unknown;
  family?: AccountRowFamily;
}): AccountRowPresentation | null {
  const labelText = normalizeText(input.label);
  if (labelText === null) return null;

  const subText = input.sub === undefined ? null : normalizeText(input.sub);
  if (input.sub !== undefined && subText === null) return null;

  let valueText: string | null = null;
  if (input.accessory === 'value') {
    valueText = normalizeText(input.value);
    if (valueText === null) return null;
  } else if (input.value !== undefined) {
    return null;
  }

  const disabled = input.disabled === true;
  const last = input.last === true;
  const valueColor =
    input.family === 'desk' ? ethena.ink.secondary : colors.inkSecondary;

  const divider: AccountRowDivider | null = last
    ? null
    : {
        color: colors.line,
        insetLeft: ACCOUNT_ROW_DIVIDER_INSET,
      };

  return {
    containerStyle: {
      minHeight: ACCOUNT_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: ACCOUNT_ROW_GAP,
      paddingVertical: ACCOUNT_ROW_PADDING_VERTICAL,
      paddingHorizontal: ACCOUNT_ROW_PADDING_HORIZONTAL,
      borderRadius: ACCOUNT_ROW_RADIUS,
      position: 'relative',
      opacity: disabled ? 0.4 : 1,
    },
    iconSlotStyle: {
      width: ACCOUNT_ROW_ICON_SIZE,
      height: ACCOUNT_ROW_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    textColumnStyle: {
      flex: 1,
      flexShrink: 1,
      minWidth: ACCOUNT_ROW_TEXT_MIN_SHARE,
      gap: 1,
    },
    labelStyle: {
      color: colors.ink,
      fontSize: kitType.headline,
      lineHeight: 22,
      letterSpacing: canonTracking(kitType.headline, -0.012),
      fontFamily: typography.face(kitWeight.regular),
      fontWeight: kitWeight.regular,
    },
    subStyle: {
      color: colors.inkTertiary,
      fontSize: kitType.caption,
      lineHeight: 17,
      fontFamily: typography.face(kitWeight.regular),
      fontWeight: kitWeight.regular,
    },
    valueStyle: {
      color: valueColor,
      fontSize: kitType.headline,
      lineHeight: 22,
      letterSpacing: canonTracking(kitType.headline, -0.012),
      fontFamily: typography.face(kitWeight.regular),
      fontWeight: kitWeight.regular,
      fontVariant: canonNumerals(),
      textAlign: 'right',
      flexShrink: 1,
    },
    accessorySlotStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: ACCOUNT_ROW_GAP,
      flexShrink: 1,
    },
    dividerStyle: divider
      ? {
          position: 'absolute',
          left: divider.insetLeft,
          right: 0,
          bottom: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: divider.color,
        }
      : null,
    labelText,
    subText,
    valueText,
    showChevron: input.accessory === 'chevron' || input.accessory === 'value',
    showValue: input.accessory === 'value',
    showSwitchSlot: input.accessory === 'switch',
    iconSize: ACCOUNT_ROW_ICON_SIZE,
    iconColor: colors.iconRow,
    iconWell: ACCOUNT_ROW_ICON_WELL,
    valueColor,
    divider,
    chevronGlyph: ACCOUNT_ROW_CHEVRON_GLYPH,
    chevronSize: ACCOUNT_ROW_CHEVRON_SIZE,
    chevronColor: colors.inkQuaternary,
    disabled,
    labelNumberOfLines: ACCOUNT_ROW_LABEL_MAX_LINES,
    subNumberOfLines: ACCOUNT_ROW_SUB_MAX_LINES,
    valueNumberOfLines: ACCOUNT_ROW_VALUE_MAX_LINES,
    accessibilityLabel: [labelText, subText, valueText]
      .filter((part): part is string => part !== null)
      .join(', '),
  };
}

export const ACCOUNT_CARD_RADIUS = radii.group;
export const ACCOUNT_CARD_PADDING_HORIZONTAL = 0;
export const ACCOUNT_CARD_PADDING_VERTICAL = 0;
