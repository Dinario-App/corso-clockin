import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { canonNumerals, canonTracking } from '@/src/ui/cards/canonType.js';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import {
  ACCOUNT_ROW_CHEVRON_GLYPH,
  ACCOUNT_ROW_CHEVRON_SIZE,
  ACCOUNT_ROW_DIVIDER_INSET,
  ACCOUNT_ROW_GAP,
  ACCOUNT_ROW_HEIGHT,
  ACCOUNT_ROW_ICON_SIZE,
  ACCOUNT_ROW_ICON_WELL,
  ACCOUNT_ROW_LABEL_MAX_LINES,
  ACCOUNT_ROW_PADDING_HORIZONTAL,
  ACCOUNT_ROW_PADDING_VERTICAL,
  ACCOUNT_ROW_RADIUS,
  ACCOUNT_ROW_SUB_MAX_LINES,
  type AccountRowDivider,
  type AccountRowFamily,
} from '@/src/ui/rows/accountRowPresentation.js';
import {
  NETWORK_ROW_CHECK_GLYPH,
  NETWORK_ROW_CHECK_SIZE,
} from '@/src/ui/rows/networkRowPresentation.js';
import { colors, kitType, kitWeight, typography } from '@/src/ui/tokens';
import { ethena } from '@/constants/theme.ethena';

export const SETTINGS_ROW_WIDTH = null;
export const SETTINGS_ROW_MIN_HEIGHT = ACCOUNT_ROW_HEIGHT;
export const SETTINGS_ROW_ICON_WELL = ACCOUNT_ROW_ICON_WELL;
export const SETTINGS_ROW_ICON_SIZE = ACCOUNT_ROW_ICON_SIZE;
export const SETTINGS_ROW_GAP = ACCOUNT_ROW_GAP;
export const SETTINGS_ROW_PAD_H = ACCOUNT_ROW_PADDING_HORIZONTAL;
export const SETTINGS_ROW_DIVIDER_INSET = ACCOUNT_ROW_DIVIDER_INSET;
export const SETTINGS_ROW_CHEVRON_SIZE = ACCOUNT_ROW_CHEVRON_SIZE;
/** Locked CorsoIcon registry key for forward navigation rows. */
export const SETTINGS_ROW_CHEVRON_GLYPH: CorsoIconName =
  ACCOUNT_ROW_CHEVRON_GLYPH;
/** The selected-option check reuses the cluster picker's glyph and size. */
export const SETTINGS_ROW_CHECK_GLYPH: CorsoIconName = NETWORK_ROW_CHECK_GLYPH;
export const SETTINGS_ROW_CHECK_SIZE = NETWORK_ROW_CHECK_SIZE;
export const SETTINGS_ROW_LINE_HEIGHT = 22;

export const SETTINGS_ROW_ACCESSORIES = [
  'chevron',
  'value',
  'switch',
  'none',
  /** A selected option in a one-of list (Network). Neutral ink, never azure. */
  'check',
] as const;

export const SETTINGS_ROW_TONES = ['default', 'destructive'] as const;

export type SettingsRowAccessory = (typeof SETTINGS_ROW_ACCESSORIES)[number];
export type SettingsRowTone = (typeof SETTINGS_ROW_TONES)[number];
export type SettingsRowFamily = AccountRowFamily;

export type SettingsRowPresentation = {
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
  accessory: SettingsRowAccessory;
  tone: SettingsRowTone;
  disabled: boolean;
  showIcon: boolean;
  showChevron: boolean;
  showValue: boolean;
  showSwitchSlot: boolean;
  showCheck: boolean;
  checkGlyph: CorsoIconName;
  checkSize: number;
  checkColor: string;
  /** Present only on a `check` row: the row IS the selected option. */
  accessibilityState: { selected: true } | undefined;
  chevronGlyph: CorsoIconName;
  chevronSize: number;
  iconSize: number;
  iconColor: string;
  iconWell: null;
  valueColor: string;
  chevronColor: string;
  divider: AccountRowDivider | null;
  labelNumberOfLines: number;
  subNumberOfLines: number | undefined;
  accessibilityLabel: string;
};

function normalizeSettingsRowBoolean(
  value: unknown,
  defaultValue = false,
): boolean | null {
  if (value === undefined) {
    return defaultValue;
  }
  return typeof value === 'boolean' ? value : null;
}

function assertSettingsRowLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function assertSettingsRowAccessory(
  value: unknown,
): SettingsRowAccessory | null {
  if (
    value === 'chevron' ||
    value === 'value' ||
    value === 'switch' ||
    value === 'none' ||
    value === 'check'
  ) {
    return value;
  }
  return null;
}

function assertSettingsRowFamily(value: unknown): SettingsRowFamily | null {
  if (value === undefined) {
    return 'grok';
  }
  if (value === 'grok' || value === 'desk') {
    return value;
  }
  return null;
}

function assertSettingsRowTone(value: unknown): SettingsRowTone | null {
  if (value === undefined) {
    return 'default';
  }
  if (value === 'default' || value === 'destructive') {
    return value;
  }
  return null;
}

export function resolveSettingsRowPresentation(input: {
  label: unknown;
  accessory: unknown;
  /** Optional: a row without a glyph draws no icon and lets the label lead. */
  glyph?: CorsoIconName;
  sub?: unknown;
  tone?: unknown;
  disabled?: unknown;
  value?: unknown;
  /** Last row in a pane — no hairline under it. */
  last?: unknown;
  /** `'desk'` on a tray on the desk ground — see `SettingsRowFamily`. */
  family?: unknown;
}): SettingsRowPresentation | null {
  const labelText = assertSettingsRowLabel(input.label);
  if (labelText === null) {
    return null;
  }

  const accessory = assertSettingsRowAccessory(input.accessory);
  if (accessory === null) {
    return null;
  }

  const tone = assertSettingsRowTone(input.tone);
  if (tone === null) {
    return null;
  }

  const family = assertSettingsRowFamily(input.family);
  if (family === null) {
    return null;
  }
  const valueColor =
    family === 'desk' ? ethena.ink.secondary : colors.inkSecondary;

  const disabled = normalizeSettingsRowBoolean(input.disabled);
  if (disabled === null) {
    return null;
  }

  const last = normalizeSettingsRowBoolean(input.last);
  if (last === null) {
    return null;
  }

  const subText =
    input.sub === undefined ? null : assertSettingsRowLabel(input.sub);
  if (input.sub !== undefined && subText === null) {
    return null;
  }

  let valueText: string | null = null;
  if (accessory === 'value') {
    const normalizedValue = assertSettingsRowLabel(input.value);
    if (normalizedValue === null) {
      return null;
    }
    valueText = normalizedValue;
  } else if (input.value !== undefined) {
    return null;
  }

  const labelColor = tone === 'destructive' ? colors.priceDown : colors.ink;

  const divider: AccountRowDivider | null = last
    ? null
    : {
        color: colors.line,
        insetLeft: SETTINGS_ROW_DIVIDER_INSET,
      };

  return {
    containerStyle: {
      alignSelf: 'stretch',
      minHeight: SETTINGS_ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SETTINGS_ROW_GAP,
      paddingVertical: ACCOUNT_ROW_PADDING_VERTICAL,
      paddingHorizontal: SETTINGS_ROW_PAD_H,
      borderRadius: ACCOUNT_ROW_RADIUS,
      position: 'relative',
      opacity: disabled ? 0.4 : 1,
    },
    iconSlotStyle: {
      width: SETTINGS_ROW_ICON_SIZE,
      height: SETTINGS_ROW_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    textColumnStyle: {
      flex: 1,
      flexShrink: 1,
      gap: 1,
    },
    labelStyle: {
      color: labelColor,
      fontSize: kitType.headline,
      lineHeight: SETTINGS_ROW_LINE_HEIGHT,
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
      lineHeight: SETTINGS_ROW_LINE_HEIGHT,
      letterSpacing: canonTracking(kitType.headline, -0.012),
      fontFamily: typography.face(kitWeight.regular),
      fontWeight: kitWeight.regular,
      fontVariant: canonNumerals(),
      textAlign: 'right',
      flexShrink: 0,
    },
    accessorySlotStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: ACCOUNT_ROW_GAP,
      flexShrink: 0,
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
    accessory,
    tone,
    disabled,
    showIcon: input.glyph !== undefined,
    showChevron: accessory === 'chevron',
    showValue: accessory === 'value',
    showSwitchSlot: accessory === 'switch',
    showCheck: accessory === 'check',
    checkGlyph: SETTINGS_ROW_CHECK_GLYPH,
    checkSize: SETTINGS_ROW_CHECK_SIZE,
    checkColor: colors.ink,
    accessibilityState: accessory === 'check' ? { selected: true } : undefined,
    chevronGlyph: SETTINGS_ROW_CHEVRON_GLYPH,
    chevronSize: SETTINGS_ROW_CHEVRON_SIZE,
    iconSize: SETTINGS_ROW_ICON_SIZE,
    iconColor: colors.iconRow,
    iconWell: SETTINGS_ROW_ICON_WELL,
    valueColor,
    chevronColor: colors.inkQuaternary,
    divider,
    labelNumberOfLines: ACCOUNT_ROW_LABEL_MAX_LINES,
    subNumberOfLines: ACCOUNT_ROW_SUB_MAX_LINES,
    accessibilityLabel: [labelText, subText, valueText]
      .filter((part): part is string => part !== null)
      .join(', '),
  };
}
