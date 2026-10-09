import { withAlpha } from '@/src/ui/controls/colorAlpha';
import { accent, colors } from '@/src/ui/tokens';
import { COMPOSER_PLACEHOLDER_INK } from './composerDeskPaint';

export const COMPOSER_REST_HEIGHT = 96;
export const COMPOSER_RADIUS = 28;
export const COMPOSER_PADDING_TOP = 12;
export const COMPOSER_PADDING_BOTTOM = 8;
export const COMPOSER_PADDING_HORIZONTAL = 8;
/** Row 2: `+` · `Auto ▾` · spacer · mic · primary. The 34pt controls centre in it. */
export const COMPOSER_ACTION_ROW_HEIGHT = 36;
export const COMPOSER_ACTION_ROW_GAP = 8;
export const COMPOSER_INPUT_FONT_SIZE = 17;
export const COMPOSER_INPUT_LINE_HEIGHT = 22;
export const COMPOSER_INPUT_PADDING_HORIZONTAL = 10;
export const COMPOSER_INPUT_PADDING_VERTICAL = 0;
/** Lines the input may grow to before it scrolls inside itself. */
export const COMPOSER_MAX_LINES = 6;
/** The idle input row: whatever 96 leaves after padding and the action row. */
export const COMPOSER_INPUT_REST_HEIGHT =
  COMPOSER_REST_HEIGHT -
  COMPOSER_PADDING_TOP -
  COMPOSER_PADDING_BOTTOM -
  COMPOSER_ACTION_ROW_HEIGHT;
export const COMPOSER_DOCK_GUTTER = 14;
/** A downward drag past this many dp on the card re-summons the tab bar. */
export const COMPOSER_SWIPE_DOWN_DP = 24;

export const COMPOSER_ATTACH_MENU_RADIUS = 18;
export const COMPOSER_MODEL_MENU_RADIUS = 20;
export const COMPOSER_MODEL_MENU_WIDTH = 296;
export const COMPOSER_CONNECT_MONOGRAM_SIZE = 20;
export const COMPOSER_CONNECT_MONOGRAM_GAP = 4;
const COMPOSER_MODEL_MENU_PAD_X = 6;
/** Connect row pad (same 8 as a model row). */
const COMPOSER_CONNECT_ROW_PAD = 8;
/** Connect row gap (same 11 as a model row). */
const COMPOSER_CONNECT_ROW_GAP = 11;
const COMPOSER_CONNECT_CHEVRON = 12;

/**
 * How much of the picker is left for "Connect your AI" + the benefit caption
 * after the three 20pt wells and the chevron. Used to prove 369 fit.
 */
export function resolveConnectRowLabelMaxWidth(
  menuWidth = COMPOSER_MODEL_MENU_WIDTH,
): number {
  const marks =
    COMPOSER_CONNECT_MONOGRAM_SIZE * 3 + COMPOSER_CONNECT_MONOGRAM_GAP * 2;
  return (
    menuWidth -
    COMPOSER_MODEL_MENU_PAD_X * 2 -
    COMPOSER_CONNECT_ROW_PAD * 2 -
    marks -
    COMPOSER_CONNECT_CHEVRON -
    COMPOSER_CONNECT_ROW_GAP * 2
  );
}

export const COMPOSER_DOCK_SCRIM_COLORS = [
  withAlpha(colors.canvas, 0),
  withAlpha(colors.canvas, 0.88),
  withAlpha(colors.canvas, 0.96),
] as const;
export const COMPOSER_DOCK_SCRIM_LOCATIONS = [0, 0.26, 1] as const;
export const COMPOSER_DOCK_SCRIM_BASE = withAlpha(colors.canvas, 1).replace(
  /^rgba\((.+), 1\)$/,
  'rgb($1)',
);
export const COMPOSER_DOCK_SCRIM_BASE_TRANSPARENT = withAlpha(colors.canvas, 0);
export const COMPOSER_DOCK_SCRIM_BLEED = 24;
export const COMPOSER_PRIMARY_SIZE = 34;
export const COMPOSER_WELL_SIZE = 34;
export const COMPOSER_SPEAK_HEIGHT = 34;

/**
 * Input height for a measured content height. Grows a whole line at a time
 * (never a fractional pixel that jitters), floors at the rest line, caps at
 * `COMPOSER_MAX_LINES`.
 */
export function resolveComposerInputHeight(contentHeight: number): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    return COMPOSER_INPUT_REST_HEIGHT;
  }
  if (contentHeight < COMPOSER_INPUT_LINE_HEIGHT * 2) {
    return COMPOSER_INPUT_REST_HEIGHT;
  }
  const lines = Math.max(
    1,
    Math.ceil(contentHeight / COMPOSER_INPUT_LINE_HEIGHT),
  );
  const capped = Math.min(lines, COMPOSER_MAX_LINES);
  const grown =
    COMPOSER_INPUT_REST_HEIGHT + (capped - 1) * COMPOSER_INPUT_LINE_HEIGHT;
  return Math.max(COMPOSER_INPUT_REST_HEIGHT, grown);
}

/** Whole-card height for an input height: padding + input + the un-compressible action row. */
export function resolveComposerHeight(inputHeight: number): number {
  return (
    COMPOSER_PADDING_TOP +
    Math.max(COMPOSER_INPUT_REST_HEIGHT, inputHeight) +
    COMPOSER_ACTION_ROW_HEIGHT +
    COMPOSER_PADDING_BOTTOM
  );
}

/**
 * `speak` draws the white Speak pill; `send`, `busy` and `off` draw the 34pt
 * circle (`busy` holds a spinner, the other two an arrow).
 */
export type ComposerPrimaryMode = 'speak' | 'send' | 'busy' | 'off';

export type ComposerPrimaryPresentation = {
  mode: ComposerPrimaryMode;
  fill: string;
  glyphColor: string;
  glow: string | null;
  disabled: boolean;
  accessibilityLabel: string;
};

export function resolveComposerPrimary(input: {
  text: string;
  busy: boolean;
  askEnabled: boolean;
  labels: { speak: string; send: string; disabled: string };
}): ComposerPrimaryPresentation {
  const hasText = input.text.trim().length > 0;
  if (!input.askEnabled) {
    return {
      mode: 'off',
      fill: colors.surfaceSendOff,
      glyphColor: colors.inkSecondary,
      glow: null,
      disabled: true,
      accessibilityLabel: input.labels.disabled,
    };
  }
  if (input.busy) {
    return {
      mode: 'busy',
      fill: accent.composeSend,
      glyphColor: accent.onComposeSend,
      glow: null,
      disabled: true,
      accessibilityLabel: input.labels.send,
    };
  }
  if (hasText) {
    return {
      mode: 'send',
      fill: accent.composeSend,
      glyphColor: accent.onComposeSend,
      glow: null,
      disabled: false,
      accessibilityLabel: input.labels.send,
    };
  }
  return {
    mode: 'speak',
    fill: accent.composeSend,
    glyphColor: accent.onComposeSend,
    glow: null,
    disabled: false,
    accessibilityLabel: input.labels.speak,
  };
}

export type ComposerFieldPresentation = {
  placeholder: string;
  placeholderColor: string;
  editable: boolean;
  /** The honest line above the dock when Ask is switched off. Null when on. */
  disabledNotice: string | null;
};

/**
 * FLAG_ASK off = an honest empty state, not a pretend input. The field says
 * Ask is off, cannot be typed into, and the notice above it says the money is
 * fine — the same reassurance `copy.ask.unavailable` gives on a 503.
 *
 * The placeholder is `ethenaInk.secondary`: 7.62:1 on the float card.
 */
export function resolveComposerField(input: {
  askEnabled: boolean;
  busy: boolean;
  voiceEditable: boolean;
  copy: {
    placeholder: string;
    disabledPlaceholder: string;
    disabledNotice: string;
  };
}): ComposerFieldPresentation {
  if (!input.askEnabled) {
    return {
      placeholder: input.copy.disabledPlaceholder,
      placeholderColor: COMPOSER_PLACEHOLDER_INK,
      editable: false,
      disabledNotice: input.copy.disabledNotice,
    };
  }
  return {
    placeholder: input.copy.placeholder,
    placeholderColor: COMPOSER_PLACEHOLDER_INK,
    editable: !input.busy && input.voiceEditable,
    disabledNotice: null,
  };
}

/** A downward drag on the card past the threshold is the re-summon gesture. */
export function isComposerSwipeDown(input: {
  dx: number;
  dy: number;
}): boolean {
  return (
    input.dy >= COMPOSER_SWIPE_DOWN_DP &&
    Math.abs(input.dy) > Math.abs(input.dx)
  );
}
