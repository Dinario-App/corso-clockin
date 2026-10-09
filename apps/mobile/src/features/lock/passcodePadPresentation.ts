import { PASSCODE_LENGTH } from '@/src/features/onboarding/passcodeEntry';
import { colors, kitType, kitWeight } from '@/src/ui/tokens';

export { PASSCODE_LENGTH };

/**
 * Six cells, 46 × 56, radius 14, gap 10. Geometry only: the fill, the rim and
 * the next ring's colour depend on where the cells stand (the ground or a
 * float sheet) and are resolved in `passcodeCellPaint.ts`.
 */
export const PASSCODE_CELL = {
  width: 46,
  height: 56,
  radius: 14,
  gap: 10,
  /** A filled cell holds one 12pt white dot. */
  dotSize: 12,
  dotColor: colors.ink,
  /**
   * The next cell carries a 1px inset ring, because an empty cell alone does
   * not say where the next digit lands.
   */
  nextRingWidth: 1,
} as const;

/** 6 × 46 + 5 × 10 — the row the stills centre at x 32…358. */
export const PASSCODE_CELLS_WIDTH =
  PASSCODE_LENGTH * PASSCODE_CELL.width +
  (PASSCODE_LENGTH - 1) * PASSCODE_CELL.gap;

export type PasscodeCellState = 'filled' | 'next' | 'empty';

export function resolvePasscodeCellState(
  index: number,
  filled: number,
): PasscodeCellState {
  if (index < filled) return 'filled';
  if (index === filled) return 'next';
  return 'empty';
}

/**
 * A 3 × 4 grid of 110 × 64 keys, bare 27/400 white type. The press state is a
 * 56pt `#1F1F1F` circle behind the digit, never a box around it.
 */
export const PASSCODE_KEYPAD = {
  columns: 3,
  keyWidth: 110,
  keyHeight: 64,
  glyphSize: 27,
  glyphWeight: kitWeight.regular,
  glyphColor: colors.ink,
  /** While a verify call is in flight the pad is inert, and reads as inert. */
  glyphDisabledColor: colors.inkTertiary,
  pressDiscSize: 56,
  pressDiscFill: colors.surfaceFloat,
  deleteIconSize: 26,
} as const;

/** Reading order: 1–9, then an empty slot · 0 · delete. Do not reorder. */
export const PASSCODE_KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '',
  '0',
  'delete',
] as const;

export type PasscodeKeySlot = (typeof PASSCODE_KEYS)[number];
export type PasscodeKey = Exclude<PasscodeKeySlot, ''>;

export const PASSCODE_KEYPAD_WIDTH =
  PASSCODE_KEYPAD.columns * PASSCODE_KEYPAD.keyWidth;
export const PASSCODE_KEYPAD_HEIGHT =
  (PASSCODE_KEYS.length / PASSCODE_KEYPAD.columns) * PASSCODE_KEYPAD.keyHeight;

/** The pad's type — white and grey, except the error line in `down`. */
export const PASSCODE_TYPE = {
  /** `copy.lock.passcodeHelper` — 15/400 grey1, centred, max width 300. */
  helper: {
    size: kitType.sub,
    weight: kitWeight.regular,
    lineHeight: 21,
    color: colors.inkSecondary,
    maxWidth: 300,
  },
  error: {
    size: kitType.sub,
    weight: kitWeight.regular,
    lineHeight: 21,
    color: colors.priceDown,
  },
  /** Setup title — 22/600, centred. */
  title: {
    size: kitType.title,
    weight: kitWeight.semibold,
    lineHeight: 28,
    color: colors.ink,
  },
  /** Setup body — 15/400 grey1. */
  body: {
    size: kitType.sub,
    weight: kitWeight.regular,
    lineHeight: 21,
    color: colors.inkSecondary,
  },
} as const;

/**
 * `Sheet content/Passcode`: 390 × 470 — helper at 0, cells at +66, an error
 * slot at +138, the keypad at +170. With the sheet header the sheet is 544pt.
 */
export const PASSCODE_SHEET_LAYOUT = {
  helperTop: 0,
  cellsTop: 66,
  errorTop: 138,
  keypadTop: 170,
  contentHeight: 470,
  sheetHeight: 544,
} as const;

/**
 * The spacings the components actually draw. The helper slot is two lines
 * tall whether the copy wraps or not, and the error slot is reserved whether
 * there is an error or not, so nothing under them moves when either changes.
 */
export const PASSCODE_SPACING = {
  helperSlot: 2 * PASSCODE_TYPE.helper.lineHeight,
  helperToCells: 24,
  cellsToError: 16,
  errorSlot: 32,
} as const;

export const PASSCODE_SETUP_LAYOUT = {
  titleTop: 230,
  bodyTop: 268,
  cellsTop: 334,
  keypadTop: 438,
  startOverTop: 712,
} as const;

export const PASSCODE_SETUP_SPACING = {
  titleToBody: 10,
  bodyToCells: 45,
} as const;

/** One 8pt horizontal shake when the cells clear; none under Reduce Motion. */
export const PASSCODE_SHAKE_DISTANCE = 8;
export const PASSCODE_SHAKE_STEP_MS = 55;

export function resolvePasscodeShake(reduceMotion: boolean): readonly number[] {
  if (reduceMotion) return [];
  return [PASSCODE_SHAKE_DISTANCE, -PASSCODE_SHAKE_DISTANCE, 0];
}

/**
 * The unlock sheet's text editor — a string in, a string out, and nothing a
 * `number-pad` could not also have typed. Verification stays where it was
 * (`unlockWithPasscode`); this only decides what is typeable.
 */
export function appendPasscodeDigit(value: string, key: unknown): string {
  if (typeof key !== 'string' || !/^[0-9]$/.test(key)) return value;
  if (value.length >= PASSCODE_LENGTH) return value;
  return value + key;
}

export function deletePasscodeDigit(value: string): string {
  return value.slice(0, -1);
}

export function isPasscodeComplete(value: string): boolean {
  return value.length === PASSCODE_LENGTH;
}
