import type { PressableProps, TextStyle, ViewStyle } from 'react-native';
import {
  assertIconCircleButtonBadge,
  assertIconCircleButtonFill,
  ICON_CIRCLE_BUTTON_SIZE,
  type IconCircleButtonBadge,
  type IconCircleButtonFill,
  normalizeIconCircleButtonAccessibilityLabel,
} from '@/src/ui/controls/iconCircleButtonPresentation.js';
import {
  CORSO_BRAND_LOCKUP_MARK_WORDMARK_GAP,
  CORSO_MARK_SIZE,
} from '@/src/ui/brand/corsoBrandLockupPresentation.js';
import {
  CORSO_ICON_NAMES,
  type CorsoIconName,
} from '@/src/ui/icons/corsoIconNames.js';
import {
  SCREEN_HEADER_BACK_GLYPH,
  SCREEN_HEADER_BACK_HIT_SIZE,
  resolveScreenHeader,
} from './screenHeaderPresentation.js';
import { spacing } from '@/src/ui/tokens';

/**
 * The narrowest device the app supports (iPhone SE, 320pt). Only the title-fit
 * guard reads it — the row itself is fluid.
 */
export const HEADER_ROW_NARROWEST_DEVICE_WIDTH = 320;
export const HEADER_ROW_RIGHT_ICON_GAP = 12;
export const HEADER_ROW_BACK_GLYPH: CorsoIconName = SCREEN_HEADER_BACK_GLYPH;
/**
 * Reserved left width for brand-lockup collision math — mark + gap + the
 * `CORSO_WORDMARK_SIZE` wordmark. Layout value; the lockup still hugs its
 * content in the row.
 */
export const HEADER_ROW_BRAND_LOCKUP_RESERVED_WIDTH =
  CORSO_MARK_SIZE + CORSO_BRAND_LOCKUP_MARK_WORDMARK_GAP + 56;

export type HeaderRowLeft = 'brand-lockup' | 'back-chevron' | 'none';
export type HeaderRowRight = 'none' | 'one-icon' | 'two-icons';

export type HeaderRowIconAction = {
  glyph: CorsoIconName;
  onPress: NonNullable<PressableProps['onPress']>;
  accessibilityLabel: string;
  fill?: IconCircleButtonFill;
  badge?: IconCircleButtonBadge;
  testID?: string;
};

export type HeaderRowPresentationInput = {
  left: unknown;
  right: unknown;
  title?: unknown;
  backAccessibilityLabel?: unknown;
  actions?: readonly HeaderRowIconAction[] | unknown;
};

export type HeaderRowPresentation = {
  containerStyle: ViewStyle;
  rightIconsRowStyle: ViewStyle;
  titleStyle: TextStyle;
  titleVisible: boolean;
  displayTitle: string;
  left: HeaderRowLeft;
  right: HeaderRowRight;
  backAccessibilityLabel: string | null;
  actions: HeaderRowIconAction[];
  titleAccessibilityRole: 'header';
};

export function assertHeaderRowLeft(left: unknown): asserts left is HeaderRowLeft {
  if (left !== 'brand-lockup' && left !== 'back-chevron' && left !== 'none') {
    throw new Error(`Invalid HeaderRow left: ${String(left)}`);
  }
}

export function assertHeaderRowRight(
  right: unknown,
): asserts right is HeaderRowRight {
  if (right !== 'none' && right !== 'one-icon' && right !== 'two-icons') {
    throw new Error(`Invalid HeaderRow right: ${String(right)}`);
  }
}

/** Trim valid strings; null for empty, whitespace-only, or non-string input. */
export function normalizeHeaderRowTitle(title: unknown): string | null {
  if (typeof title !== 'string') {
    return null;
  }
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function reservedLeftWidth(left: HeaderRowLeft): number {
  switch (left) {
    case 'brand-lockup':
      return HEADER_ROW_BRAND_LOCKUP_RESERVED_WIDTH;
    case 'back-chevron':
      return SCREEN_HEADER_BACK_HIT_SIZE;
    case 'none':
      return 0;
  }
}

function reservedRightWidth(right: HeaderRowRight): number {
  switch (right) {
    case 'none':
      return 0;
    case 'one-icon':
      return ICON_CIRCLE_BUTTON_SIZE;
    case 'two-icons':
      return ICON_CIRCLE_BUTTON_SIZE * 2 + HEADER_ROW_RIGHT_ICON_GAP;
  }
}

function expectedActionCount(right: HeaderRowRight): number {
  switch (right) {
    case 'none':
      return 0;
    case 'one-icon':
      return 1;
    case 'two-icons':
      return 2;
  }
}

function assertHeaderRowActionGlyph(glyph: unknown): CorsoIconName {
  if (
    typeof glyph !== 'string' ||
    !Object.prototype.hasOwnProperty.call(CORSO_ICON_NAMES, glyph)
  ) {
    throw new Error(`Invalid HeaderRow action glyph: ${String(glyph)}`);
  }
  return glyph as CorsoIconName;
}

function normalizeActions(
  actions: unknown,
  right: HeaderRowRight,
): HeaderRowIconAction[] | null {
  const expected = expectedActionCount(right);
  if (expected === 0) {
    if (actions === undefined || actions === null) {
      return [];
    }
    if (Array.isArray(actions) && actions.length === 0) {
      return [];
    }
    return null;
  }

  if (!Array.isArray(actions) || actions.length !== expected) {
    return null;
  }

  const normalized: HeaderRowIconAction[] = [];
  for (const action of actions) {
    if (action === null || typeof action !== 'object') {
      return null;
    }
    const record = action as Record<string, unknown>;
    const glyph = assertHeaderRowActionGlyph(record.glyph);
    if (typeof record.onPress !== 'function') {
      return null;
    }
    const accessibilityLabel = normalizeIconCircleButtonAccessibilityLabel(
      record.accessibilityLabel,
    );
    if (accessibilityLabel === null) {
      return null;
    }
    let fill: IconCircleButtonFill | undefined;
    if (record.fill !== undefined) {
      assertIconCircleButtonFill(record.fill);
      fill = record.fill;
    }
    let badge: IconCircleButtonBadge | undefined;
    if (record.badge !== undefined) {
      assertIconCircleButtonBadge(record.badge);
      badge = record.badge;
    }
    normalized.push({
      glyph,
      onPress: record.onPress as NonNullable<PressableProps['onPress']>,
      accessibilityLabel,
      ...(fill !== undefined ? { fill } : {}),
      ...(badge !== undefined ? { badge } : {}),
      ...(typeof record.testID === 'string' ? { testID: record.testID } : {}),
    });
  }

  return normalized;
}

function hasDuplicateAccessibilityLabels(labels: string[]): boolean {
  const seen = new Set<string>();
  for (const label of labels) {
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
}

export function resolveHeaderRowPresentation(
  input: HeaderRowPresentationInput,
): HeaderRowPresentation | null {
  assertHeaderRowLeft(input.left);
  const left = input.left;
  assertHeaderRowRight(input.right);
  const right = input.right;

  const displayTitle =
    input.title === undefined ? null : normalizeHeaderRowTitle(input.title);
  if (input.title !== undefined && displayTitle === null) {
    return null;
  }

  const backAccessibilityLabel =
    left === 'back-chevron'
      ? normalizeIconCircleButtonAccessibilityLabel(input.backAccessibilityLabel)
      : null;
  if (left === 'back-chevron' && backAccessibilityLabel === null) {
    return null;
  }
  if (left !== 'back-chevron' && input.backAccessibilityLabel !== undefined) {
    return null;
  }

  let actions: HeaderRowIconAction[];
  try {
    const normalized = normalizeActions(input.actions, right);
    if (normalized === null) {
      return null;
    }
    actions = normalized;
  } catch {
    return null;
  }

  const accessibilityLabels: string[] = [];
  if (backAccessibilityLabel !== null) {
    accessibilityLabels.push(backAccessibilityLabel);
  }
  for (const action of actions) {
    accessibilityLabels.push(action.accessibilityLabel);
  }
  if (hasDuplicateAccessibilityLabels(accessibilityLabels)) {
    return null;
  }

  const leftReserve = reservedLeftWidth(left);
  const rightReserve = reservedRightWidth(right);
  const titleVisible = displayTitle !== null;

  /*
   * Fail closed when the reserved chrome leaves no room for a title on the
   * narrowest supported device, rather than shipping a row whose title is
   * clipped to nothing. The row is fluid, so the floor — not the design
   * device — is what the guard has to answer for.
   *
   * The title is left-aligned now, so the chrome eats the row once each side
   * rather than twice: `max(left, right) * 2` was the symmetry an absolutely
   * centred overlay needed, and that overlay is gone.
   */
  const chrome = resolveScreenHeader();
  const narrowestTitleWidth =
    HEADER_ROW_NARROWEST_DEVICE_WIDTH -
    spacing.gutter * 2 -
    leftReserve -
    rightReserve;
  if (titleVisible && narrowestTitleWidth < 1) {
    return null;
  }

  const containerStyle: ViewStyle = chrome.rowStyle;

  const rightIconsRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HEADER_ROW_RIGHT_ICON_GAP,
  };

  const titleStyle: TextStyle = chrome.titleStyle;

  return {
    containerStyle,
    rightIconsRowStyle,
    titleStyle,
    titleVisible,
    displayTitle: displayTitle ?? '',
    left,
    right,
    backAccessibilityLabel,
    actions,
    titleAccessibilityRole: 'header',
  };
}
