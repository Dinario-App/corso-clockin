export const TOKEN_CARD_AMOUNT_FONT_SIZE = 32;
export const TOKEN_CARD_AMOUNT_PLACEHOLDER_SIZE = 15;
export const TOKEN_CARD_AMOUNT_MIN_FONT_SIZE = 16;
export const TOKEN_CARD_AMOUNT_SIZES = [32, 28, 24, 20, 16] as const;

/**
 * Inter SemiBold advances, in em, pessimistic on purpose. Calibrated from
 * the Home headline table (digit 0.67) and rounded up so a model that
 * over-estimates costs a size step rather than wrapping a money figure.
 */
const TOKEN_CARD_GLYPH_EM = {
  digit: 0.67,
  separator: 0.28,
  other: 0.58,
} as const;

/** Amount/32 tracking from the AmountCard contract. */
const TOKEN_CARD_LETTER_SPACING = -0.4;

/** Width, in dp, that `text` needs on one line at `fontSize`. */
export function tokenCardAmountWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const glyph of text) {
    if (glyph >= '0' && glyph <= '9') em += TOKEN_CARD_GLYPH_EM.digit;
    else if (glyph === '.' || glyph === ',' || glyph === ' ') {
      em += TOKEN_CARD_GLYPH_EM.separator;
    } else em += TOKEN_CARD_GLYPH_EM.other;
  }
  const tracking = Math.max(0, [...text].length - 1) * TOKEN_CARD_LETTER_SPACING;
  return Math.max(0, em * fontSize + tracking);
}

/**
 * The largest rung on which `text` fits `usableWidthDp` in one line.
 * Unmeasured width returns the signed 32 so the first paint is at the
 * intended size; a later measurement may only go downward.
 */
export function resolveTokenCardAmountFontSize(args: {
  text: string;
  usableWidthDp: number | null | undefined;
}): number {
  const width = args.usableWidthDp;
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    return TOKEN_CARD_AMOUNT_FONT_SIZE;
  }
  for (const size of TOKEN_CARD_AMOUNT_SIZES) {
    if (tokenCardAmountWidth(args.text, size) <= width) return size;
  }
  return TOKEN_CARD_AMOUNT_MIN_FONT_SIZE;
}
