import type { TextStyle, ViewStyle } from 'react-native';
import { colors, typography } from '@/src/ui/tokens';

export const ACTIVITY_DAY_HEADER_WIDTH = 353;
export const ACTIVITY_DAY_HEADER_HEIGHT = 24;
/** Micro/11 line height centred inside the 24pt row. */
export const ACTIVITY_DAY_HEADER_LABEL_LINE_HEIGHT = 24;

export type ActivityDayHeaderPresentation = {
  containerStyle: ViewStyle;
  labelStyle: TextStyle;
  labelText: string;
  accessibilityRole: 'header';
  accessibilityLabel: string;
};

function assertActivityDayHeaderLabel(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('ActivityDayHeader label must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('ActivityDayHeader label must be a non-empty string');
  }
  const alphabetic = trimmed.replace(/[^A-Za-z]/g, '');
  if (alphabetic.length > 0 && alphabetic === alphabetic.toUpperCase()) {
    throw new Error(
      'ActivityDayHeader label must not be all-uppercase alphabetic',
    );
  }
  return trimmed;
}

/**
 * Pure presentation resolver for the Activity day-group header row.
 * Scroll pinning and surrounding 8pt/12pt gaps belong to the Activity
 * list parent — not this primitive.
 */
export function resolveActivityDayHeaderPresentation(input: {
  label: unknown;
}): ActivityDayHeaderPresentation {
  const labelText = assertActivityDayHeaderLabel(input.label);

  return {
    containerStyle: {
      width: ACTIVITY_DAY_HEADER_WIDTH,
      height: ACTIVITY_DAY_HEADER_HEIGHT,
      justifyContent: 'center',
    },
    labelStyle: {
      color: colors.muted,
      fontSize: typography.micro,
      lineHeight: ACTIVITY_DAY_HEADER_LABEL_LINE_HEIGHT,
      fontFamily: typography.face('500'),
      fontWeight: '500',
      textAlign: 'left',
    },
    labelText,
    accessibilityRole: 'header',
    accessibilityLabel: labelText,
  };
}
