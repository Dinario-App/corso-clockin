import type { ViewStyle } from 'react-native';
import {
  CORSO_ICON_NAMES,
  type CorsoIconName,
} from '@/src/ui/icons/corsoIconNames.js';
import {
  resolveTapTargetInsets,
  type TapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation.js';
import type { MaterialState } from '@/src/ui/glass/materialTokens.js';
import { colors } from '@/src/ui/tokens';
import { resolveDisabledPaint } from './disabledPresentation.js';

export const ICON_CIRCLE_BUTTON_SIZE = 44;
/** Full circle on the 44pt box. */
export const ICON_CIRCLE_BUTTON_RADIUS = ICON_CIRCLE_BUTTON_SIZE / 2;
export const ICON_CIRCLE_BUTTON_GLYPH_SIZE = 22;
/** Tap floor — the 44pt circle already meets it. */
export const ICON_CIRCLE_BUTTON_TAP_SIZE = 44;
/** Unread badge dot diameter — never a count. */
export const ICON_CIRCLE_BUTTON_BADGE_SIZE = 6;
/** Badge inset from top-right inside the circle. */
export const ICON_CIRCLE_BUTTON_BADGE_OFFSET = 4;

export type IconCircleVariant = 'ground' | 'float' | 'sheet';

export type IconCircleButtonFill = 'canvas' | 'surface';
export type IconCircleButtonBadge = 'none' | 'unread';

export type IconCircleButtonPresentation = {
  /** The pressable box: the 44pt circle. */
  containerStyle: ViewStyle;
  /** The 44pt disc the material or flat fill draws into. */
  circleStyle: ViewStyle;
  /** `rest` at rest, `hi` when the control's surface is open. */
  materialState: MaterialState;
  /** `'pill'` on ground; `null` for the opaque float/sheet fills. */
  material: 'pill' | null;
  /** Opaque fill for float/sheet; `null` when the pill material paints. */
  backgroundColor: string | null;
  /** Soft shadow on float only. */
  elevated: boolean;
  size: typeof ICON_CIRCLE_BUTTON_SIZE;
  radius: typeof ICON_CIRCLE_BUTTON_RADIUS;
  glyph: CorsoIconName;
  glyphSize: number;
  glyphColor: string;
  badgeVisible: boolean;
  badgeStyle: ViewStyle;
  hitSlop: TapTargetInsets;
  accessibilityRole: 'button';
  accessibilityLabel: string;
};

/** Reject unknown fill variants before glyph normalization. */
export function assertIconCircleButtonFill(
  fill: unknown,
): asserts fill is IconCircleButtonFill {
  if (fill !== 'canvas' && fill !== 'surface') {
    throw new Error(`Invalid IconCircleButton fill: ${String(fill)}`);
  }
}

/** Reject unknown circle variants before glyph normalization. */
export function assertIconCircleButtonVariant(
  variant: unknown,
): asserts variant is IconCircleVariant {
  if (variant !== 'ground' && variant !== 'float' && variant !== 'sheet') {
    throw new Error(`Invalid IconCircleButton variant: ${String(variant)}`);
  }
}

/** Reject unknown badge variants before glyph normalization. */
export function assertIconCircleButtonBadge(
  badge: unknown,
): asserts badge is IconCircleButtonBadge {
  if (badge !== 'none' && badge !== 'unread') {
    throw new Error(`Invalid IconCircleButton badge: ${String(badge)}`);
  }
}

/** Fail closed on glyphs outside the CorsoIcon registry. */
export function assertIconCircleButtonGlyph(glyph: unknown): CorsoIconName {
  if (
    typeof glyph !== 'string' ||
    !Object.prototype.hasOwnProperty.call(CORSO_ICON_NAMES, glyph)
  ) {
    throw new Error(`Invalid IconCircleButton glyph: ${String(glyph)}`);
  }
  return glyph as CorsoIconName;
}

/** Trim valid strings; null for empty, whitespace-only, or non-string input. */
export function normalizeIconCircleButtonAccessibilityLabel(
  label: unknown,
): string | null {
  if (typeof label !== 'string') {
    return null;
  }
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function resolveVariantPaint(variant: IconCircleVariant): {
  material: 'pill' | null;
  backgroundColor: string | null;
  elevated: boolean;
} {
  switch (variant) {
    case 'ground':
      return { material: 'pill', backgroundColor: null, elevated: false };
    case 'float':
      return {
        material: null,
        backgroundColor: colors.surfaceFloat,
        elevated: true,
      };
    case 'sheet':
      return {
        material: null,
        backgroundColor: colors.surfaceFloat,
        elevated: false,
      };
  }
}

export function resolveIconCircleButtonPresentation(input: {
  glyph: unknown;
  fill?: unknown;
  badge?: unknown;
  variant?: unknown;
  disabled?: unknown;
  accessibilityLabel: unknown;
}): IconCircleButtonPresentation | null {
  const fill =
    input.fill === undefined
      ? 'canvas'
      : (() => {
          assertIconCircleButtonFill(input.fill);
          return input.fill;
        })();

  const variant =
    input.variant === undefined
      ? 'ground'
      : (() => {
          assertIconCircleButtonVariant(input.variant);
          return input.variant;
        })();

  const badge =
    input.badge === undefined
      ? 'none'
      : (() => {
          assertIconCircleButtonBadge(input.badge);
          return input.badge;
        })();

  const disabled = input.disabled === true;

  const glyph = assertIconCircleButtonGlyph(input.glyph);

  const accessibilityLabel = normalizeIconCircleButtonAccessibilityLabel(
    input.accessibilityLabel,
  );
  if (accessibilityLabel === null) {
    return null;
  }

  const badgeVisible = badge === 'unread';
  const paint = resolveVariantPaint(variant);
  const glyphColor = disabled
    ? resolveDisabledPaint('circle').glyph
    : colors.ink;

  const containerStyle: ViewStyle = {
    width: ICON_CIRCLE_BUTTON_SIZE,
    height: ICON_CIRCLE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  const circleStyle: ViewStyle = {
    width: ICON_CIRCLE_BUTTON_SIZE,
    height: ICON_CIRCLE_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const badgeStyle: ViewStyle = {
    position: 'absolute',
    top: ICON_CIRCLE_BUTTON_BADGE_OFFSET,
    right: ICON_CIRCLE_BUTTON_BADGE_OFFSET,
    width: ICON_CIRCLE_BUTTON_BADGE_SIZE,
    height: ICON_CIRCLE_BUTTON_BADGE_SIZE,
    borderRadius: ICON_CIRCLE_BUTTON_BADGE_SIZE / 2,
    backgroundColor: colors.ink,
  };

  return {
    containerStyle,
    circleStyle,
    materialState: fill === 'surface' ? 'hi' : 'rest',
    material: paint.material,
    backgroundColor: paint.backgroundColor,
    elevated: paint.elevated,
    size: ICON_CIRCLE_BUTTON_SIZE,
    radius: ICON_CIRCLE_BUTTON_RADIUS,
    glyph,
    glyphSize: ICON_CIRCLE_BUTTON_GLYPH_SIZE,
    glyphColor,
    badgeVisible,
    badgeStyle,
    hitSlop: resolveTapTargetInsets({
      visualWidth: ICON_CIRCLE_BUTTON_SIZE,
      visualHeight: ICON_CIRCLE_BUTTON_SIZE,
    }),
    accessibilityRole: 'button',
    accessibilityLabel,
  };
}
