import type { TextStyle, ViewStyle } from 'react-native';
import { colors, typography } from '@/src/ui/tokens';

export const META_ROW_WIDTH = 353;
export const META_ROW_HEIGHT = 38;
/** Body/16 line height centred inside the 38pt row. */
export const META_ROW_LINE_HEIGHT = 22;
export const META_ROW_INFO_MARK = 'ⓘ';

export const META_ROW_EMPHASIS = ['default', 'warning'] as const;

export type MetaRowEmphasis = (typeof META_ROW_EMPHASIS)[number];

export type MetaRowPresentation = {
  containerStyle: ViewStyle;
  labelRowStyle: ViewStyle;
  labelStyle: TextStyle;
  infoMarkStyle: TextStyle;
  valueStyle: TextStyle;
  labelText: string;
  valueText: string;
  showInfoMark: boolean;
  accessibilityLabel: string;
};

function assertMetaRowText(
  value: unknown,
  field: 'label' | 'value',
): string {
  if (typeof value !== 'string') {
    throw new Error(`MetaRow ${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`MetaRow ${field} must be a non-empty string`);
  }
  return trimmed;
}

function assertMetaRowHasInfo(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== 'boolean') {
    throw new Error('MetaRow hasInfo must be a boolean when provided');
  }
  return value;
}

function assertMetaRowEmphasis(value: unknown): MetaRowEmphasis {
  if (value !== 'default' && value !== 'warning') {
    throw new Error('MetaRow emphasis must be default or warning');
  }
  return value;
}

export function resolveMetaRowPresentation(input: {
  label: unknown;
  value: unknown;
  hasInfo?: unknown;
  emphasis: unknown;
}): MetaRowPresentation {
  const labelText = assertMetaRowText(input.label, 'label');
  const valueText = assertMetaRowText(input.value, 'value');
  const showInfoMark = assertMetaRowHasInfo(input.hasInfo);
  const emphasis = assertMetaRowEmphasis(input.emphasis);

  const labelStyle: TextStyle = {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: META_ROW_LINE_HEIGHT,
    fontFamily: typography.face('400'),
    fontWeight: '400',
  };

  const infoMarkStyle: TextStyle = {
    ...labelStyle,
  };

  const valueStyle: TextStyle = {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: META_ROW_LINE_HEIGHT,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    textAlign: 'right',
  };

  return {
    containerStyle: {
      width: META_ROW_WIDTH,
      height: META_ROW_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    labelRowStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 1,
    },
    labelStyle,
    infoMarkStyle,
    valueStyle,
    labelText,
    valueText,
    showInfoMark,
    accessibilityLabel: `${labelText}, ${valueText}`,
  };
}
