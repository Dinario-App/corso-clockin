import type { TextStyle, ViewStyle } from 'react-native';
import { colors, typography } from '@/src/ui/tokens';

export const TOKEN_MARK_PAIR_SIZE = 36;
export const TOKEN_MARK_DEFAULT_SIZE = 40;
export const TOKEN_MARK_PROMOTED_SIZE = 48;
export const TOKEN_MARK_SIZES = [
  TOKEN_MARK_PAIR_SIZE,
  TOKEN_MARK_DEFAULT_SIZE,
  TOKEN_MARK_PROMOTED_SIZE,
] as const;
export const TOKEN_MARK_SIZE = TOKEN_MARK_DEFAULT_SIZE;
export const TOKEN_MARK_RADIUS = TOKEN_MARK_DEFAULT_SIZE / 2;
/** Fail-closed upper bound for untrusted ticker strings. */
export const TOKEN_MARK_TICKER_MAX_LENGTH = 32;

export type TokenMarkTicker = string;
export type TokenMarkSize = (typeof TOKEN_MARK_SIZES)[number];

export type TokenMarkPresentation = {
  ticker: TokenMarkTicker;
  displayLabel: string;
  containerStyle: ViewStyle;
  textStyle: TextStyle;
  accessible: true;
  accessibilityRole: 'image';
  accessibilityLabel: string;
};

const TOKEN_MARK_UNICODE_HAZARD =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]/u;

/**
 * Code points that survive NFKC trim/uppercase yet render blank or
 * accessibility-blank on the TokenMark disc. Bounded denylist only.
 */
const TOKEN_MARK_BLANK_GLYPHS = new Set<number>([
  0x00ad, // SOFT HYPHEN
  0x034f, // COMBINING GRAPHEME JOINER
  0x115f, // HANGUL CHOSEONG FILLER
  0x1160, // HANGUL JUNGSEONG FILLER (NFKC target of U+FFA0)
  0x180e, // MONGOLIAN VOWEL SEPARATOR
  0x2800, // BRAILLE PATTERN BLANK
  0x3164, // HANGUL FILLER
  0xffa0, // HALFWIDTH HANGUL FILLER
]);

function toCodePoints(value: string): string[] {
  return Array.from(value);
}

function hasUnicodeHazard(value: string): boolean {
  return TOKEN_MARK_UNICODE_HAZARD.test(value);
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) {
        return true;
      }
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      index += 1;
      continue;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function isBlankTickerGlyph(codePoint: string): boolean {
  const code = codePoint.codePointAt(0);
  return code !== undefined && TOKEN_MARK_BLANK_GLYPHS.has(code);
}

/** True when every scalar would render an empty/invisible disc label. */
function hasOnlyBlankTickerGlyphs(value: string): boolean {
  const codePoints = toCodePoints(value);
  return codePoints.length > 0 && codePoints.every(isBlankTickerGlyph);
}

function throwInvalidTokenMarkTicker(ticker: unknown): never {
  throw new Error(`Invalid TokenMark ticker: ${String(ticker)}`);
}

export function normalizeTokenMarkDisplayLabel(ticker: string): string {
  const canonical = normalizeTokenMarkTicker(ticker);
  return toCodePoints(canonical).slice(0, 2).join('');
}

export function normalizeTokenMarkTicker(ticker: unknown): TokenMarkTicker {
  if (typeof ticker !== 'string') {
    throwInvalidTokenMarkTicker(ticker);
  }

  if (ticker.length > TOKEN_MARK_TICKER_MAX_LENGTH) {
    throwInvalidTokenMarkTicker(ticker);
  }

  if (hasLoneSurrogate(ticker)) {
    throwInvalidTokenMarkTicker(ticker);
  }

  const normalized = ticker.normalize('NFKC').trim();
  if (normalized.length === 0) {
    throwInvalidTokenMarkTicker(ticker);
  }

  if (hasUnicodeHazard(normalized)) {
    throwInvalidTokenMarkTicker(ticker);
  }

  const canonical = normalized.toUpperCase();
  if (
    canonical.length === 0 ||
    canonical.length > TOKEN_MARK_TICKER_MAX_LENGTH
  ) {
    throwInvalidTokenMarkTicker(ticker);
  }

  if (hasUnicodeHazard(canonical)) {
    throwInvalidTokenMarkTicker(ticker);
  }

  if (hasOnlyBlankTickerGlyphs(canonical)) {
    throwInvalidTokenMarkTicker(ticker);
  }

  return canonical;
}

export function assertTokenMarkTicker(
  ticker: unknown,
): asserts ticker is TokenMarkTicker {
  normalizeTokenMarkTicker(ticker);
}

export function assertTokenMarkSize(size: unknown): asserts size is TokenMarkSize {
  if (
    size !== TOKEN_MARK_PAIR_SIZE &&
    size !== TOKEN_MARK_DEFAULT_SIZE &&
    size !== TOKEN_MARK_PROMOTED_SIZE
  ) {
    throw new Error(`Invalid TokenMark size: ${String(size)}`);
  }
}

function normalizeAccessibilityLabel(label: unknown): string {
  if (typeof label !== 'string') {
    throw new Error('TokenMark accessibilityLabel must be a non-empty string');
  }

  const trimmed = label.trim();
  if (trimmed.length === 0) {
    throw new Error('TokenMark accessibilityLabel must be a non-empty string');
  }

  return trimmed;
}

export function resolveTokenMarkPresentation(input: {
  ticker: unknown;
  accessibilityLabel: unknown;
  size?: unknown;
}): TokenMarkPresentation {
  const ticker = normalizeTokenMarkTicker(input.ticker);
  const size = input.size === undefined ? TOKEN_MARK_DEFAULT_SIZE : input.size;
  assertTokenMarkSize(size);
  const accessibilityLabel = normalizeAccessibilityLabel(
    input.accessibilityLabel,
  );

  return {
    ticker,
    displayLabel: normalizeTokenMarkDisplayLabel(ticker),
    containerStyle: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textStyle: {
      color: colors.ink,
      fontSize: typography.body,
      lineHeight: 20,
      fontFamily: typography.face('600'),
      fontWeight: '600',
    },
    accessible: true,
    accessibilityRole: 'image',
    accessibilityLabel,
  };
}
