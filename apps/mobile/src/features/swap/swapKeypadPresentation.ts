export const SWAP_KEYPAD_COLUMNS = 3;

export const SWAP_KEYPAD_MAX_LENGTH = 16;

export type SwapKeypadKeyId =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'decimal'
  | 'delete';

export type SwapKeypadKey = {
  id: SwapKeypadKeyId;
  /** What the key draws. `delete` draws a glyph, not a word. */
  glyph: string;
  kind: 'digit' | 'fn';
};

export const SWAP_KEYPAD_KEYS: readonly SwapKeypadKey[] = [
  { id: '1', glyph: '1', kind: 'digit' },
  { id: '2', glyph: '2', kind: 'digit' },
  { id: '3', glyph: '3', kind: 'digit' },
  { id: '4', glyph: '4', kind: 'digit' },
  { id: '5', glyph: '5', kind: 'digit' },
  { id: '6', glyph: '6', kind: 'digit' },
  { id: '7', glyph: '7', kind: 'digit' },
  { id: '8', glyph: '8', kind: 'digit' },
  { id: '9', glyph: '9', kind: 'digit' },
  { id: 'decimal', glyph: '.', kind: 'fn' },
  { id: '0', glyph: '0', kind: 'digit' },
  { id: 'delete', glyph: '⌫', kind: 'fn' },
] as const;

const DIGITS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export function applySwapKeypadKey(
  current: string,
  key: SwapKeypadKeyId,
): string {
  if (key === 'delete') {
    return current.slice(0, -1);
  }

  if (key === 'decimal') {
    if (current.includes('.')) return current;
    if (current.length === 0) return '0.';
    if (current.length >= SWAP_KEYPAD_MAX_LENGTH) return current;
    return `${current}.`;
  }

  if (!DIGITS.has(key)) return current;

  /**
   * ⚠️ `'0'` is the only value replaced, and only when it is the whole field.
   * `'0.'` and `'10'` both end in a zero and neither may be swallowed.
   */
  if (current === '0') return key;
  if (current.length >= SWAP_KEYPAD_MAX_LENGTH) return current;
  return `${current}${key}`;
}
