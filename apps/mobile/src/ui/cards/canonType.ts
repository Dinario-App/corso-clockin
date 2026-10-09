import type { TextStyle } from 'react-native';
import { typography } from '@/src/ui/tokens';

export function canonWeight(weight: CanonWeight): TextStyle['fontWeight'] {
  return weight as TextStyle['fontWeight'];
}

export const CANON_WEIGHTS = [
  '400',
  '450',
  '500',
  '550',
  '560',
  '580',
  '600',
  '620',
  '640',
  '650',
  '660',
  '680',
  '900',
] as const;

export type CanonWeight = (typeof CANON_WEIGHTS)[number];

export const CANON_TYPE_SIZES = {
  askTitle: 26,
  /** Verdict word — 23/680, `-.02em`. */
  verdictWord: 23,
  /** Account balance, identity name — 16.5/660, `-.015em`. */
  identity: 16.5,
  /** Composer input / CTA / send — 15/450 · 650. */
  control: 15,
  /** Card title, brand — 14.5/620, `-.01em`. */
  cardTitle: 14.5,
  /** Menu + settings row label — 13.5/560–600, `-.01em`. */
  rowLabel: 13.5,
  /** Body / pill label — 13/550–560. */
  body: 13,
  /** Small label / meta — 12.5/500–600. */
  meta: 12.5,
  /** Sub-copy in menus and rows — 12/500. */
  sub: 12,
  /** Section header 11.5/600 `.13em` upper · micro risk tag 11.5/550. */
  micro: 11.5,
  /** Group label in menus — 10/640, `.12em`, uppercase. */
  groupLabel: 10,
  /** Footnote — 10.5/500. */
  footnote: 10.5,
} as const;

export function canonNumerals(): TextStyle['fontVariant'] {
  return [...typography.fontVariantNumerals] as TextStyle['fontVariant'];
}

/**
 * `-.01em` and friends, resolved to the points RN wants. CSS `em` is relative
 * to the element's own size, so tracking has to be computed per style rather
 * than declared once.
 */
export function canonTracking(fontSize: number, em: number): number {
  return Math.round(fontSize * em * 1000) / 1000;
}
