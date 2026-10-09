import type { TextStyle, ViewStyle } from 'react-native';
import { accent, colors, spacing, typography } from '@/src/ui/tokens';

export const CORSO_MARK_SIZE = 24;
/** HeaderRow chrome height — lockup vertically centres inside this box. */
export const CORSO_BRAND_LOCKUP_HEIGHT = 44;
/** Compact gap between mark and wordmark. Layout value, not a scale step. */
export const CORSO_BRAND_LOCKUP_MARK_WORDMARK_GAP = spacing.sm;
export const CORSO_BRAND_WORDMARK = 'Corso';
/** Trailing cursor of the `>Corso_` lockup (mark D). */
export const CORSO_BRAND_CURSOR = '_';
/**
 * Cursor blink, in the spirit of a terminal caret: a slow, low-contrast pulse,
 * never a hard on/off flash. Reduce Motion pins it to full opacity.
 */
export const CORSO_CURSOR_BLINK = Object.freeze({
  durationMs: 420,
  holdMs: 520,
  dimOpacity: 0.28,
});

export type CorsoCursorBlink = {
  enabled: boolean;
  durationMs: number;
  holdMs: number;
  dimOpacity: number;
};

/** The blink runs only when a caller opts in AND Reduce Motion is off. */
export function resolveCursorBlink(input: {
  blink?: boolean;
  reduceMotion?: boolean;
}): CorsoCursorBlink {
  return {
    enabled: input.blink === true && input.reduceMotion !== true,
    ...CORSO_CURSOR_BLINK,
  };
}

export type CorsoMarkPresentation = {
  size: number;
  containerStyle: ViewStyle;
  cursorLayerStyle: ViewStyle;
  inkColor: string;
  cursorColor: string;
  accessible: boolean;
  accessibilityElementsHidden: boolean;
  importantForAccessibility: 'auto' | 'no-hide-descendants' | 'yes' | 'no';
  accessibilityLabel?: string;
};

export type CorsoBrandLockupPresentation = {
  containerStyle: ViewStyle;
};

export function resolveCorsoMarkPresentation(input: {
  accessibilityLabel?: unknown;
}): CorsoMarkPresentation {
  return buildMarkPresentation(CORSO_MARK_SIZE, input.accessibilityLabel);
}

export const CORSO_MARK_DRAWN = Object.freeze({
  left: 28,
  top: 24,
  right: 86,
  bottom: 76,
});

export function resolveCorsoHeroMarkPresentation(input: {
  size: number;
  accessibilityLabel?: unknown;
}): CorsoMarkPresentation {
  const size =
    Number.isFinite(input.size) && input.size > 0
      ? input.size
      : CORSO_MARK_SIZE;
  return buildMarkPresentation(size, input.accessibilityLabel);
}

function buildMarkPresentation(
  size: number,
  label: unknown,
): CorsoMarkPresentation {
  const accessibilityLabel =
    label === undefined
      ? undefined
      : (() => {
          if (typeof label !== 'string') {
            return undefined;
          }
          const trimmed = label.trim();
          return trimmed.length > 0 ? trimmed : undefined;
        })();

  const decorative = accessibilityLabel === undefined;

  return {
    size,
    containerStyle: {
      width: size,
      height: size,
    },
    // The cursor rides its own absolutely-positioned layer so its opacity can
    // animate without touching the bracket.
    cursorLayerStyle: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: size,
      height: size,
    },
    inkColor: colors.ink,
    cursorColor: accent.brandCursor,
    accessible: !decorative,
    accessibilityElementsHidden: decorative,
    importantForAccessibility: decorative ? 'no-hide-descendants' : 'yes',
    accessibilityLabel,
  };
}

export function resolveCorsoBrandLockupPresentation(): CorsoBrandLockupPresentation {
  return {
    containerStyle: {
      height: CORSO_BRAND_LOCKUP_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    },
  };
}

/**
 * Wordmark lockup D geometry, derived from `assets/brand/corso-wordmark.svg`.
 * Ratios are held against the cap size so the lockup scales as one object.
 */
export const CORSO_WORDMARK_SIZE = 22;
/** Bracket box : cap size, from the outlined master (37.40 x 53.90 at 104pt). */
const WORDMARK_BRACKET_WIDTH_RATIO = 37.4 / 104;
const WORDMARK_BRACKET_HEIGHT_RATIO = 53.9 / 104;
/** Visual gap bracket -> word (40 at 104pt). */
const WORDMARK_GAP_RATIO = 40 / 104;
/** Tracking of the outlined master. */
const WORDMARK_TRACKING_EM = -0.035;

export type CorsoWordmarkPresentation = {
  containerStyle: ViewStyle;
  gapSpacerStyle: ViewStyle;
  bracketWidth: number;
  bracketHeight: number;
  inkColor: string;
  wordStyle: TextStyle;
  wordText: string;
  cursorStyle: TextStyle;
  cursorText: string;
  accessibilityLabel: string;
};

export function resolveCorsoWordmarkPresentation(): CorsoWordmarkPresentation {
  const size = CORSO_WORDMARK_SIZE;

  const word: TextStyle = {
    color: colors.ink,
    fontSize: size,
    lineHeight: Math.round(size * 1.2),
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: size * WORDMARK_TRACKING_EM,
  };

  return {
    containerStyle: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    gapSpacerStyle: {
      width: Math.round(size * WORDMARK_GAP_RATIO),
    },
    bracketWidth: Math.round(size * WORDMARK_BRACKET_WIDTH_RATIO),
    bracketHeight: Math.round(size * WORDMARK_BRACKET_HEIGHT_RATIO),
    inkColor: colors.ink,
    wordStyle: word,
    wordText: CORSO_BRAND_WORDMARK,
    cursorStyle: { ...word, color: accent.brandCursor },
    cursorText: CORSO_BRAND_CURSOR,
    accessibilityLabel: CORSO_BRAND_WORDMARK,
  };
}
