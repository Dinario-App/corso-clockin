import { spacing } from '@/src/ui/tokens';

/**
 * 44 is the tap floor. It is `height`, not `minHeight`, and that is load-
 * bearing: the viewport arithmetic below floors a measured height
 * to a whole number of rows, and a row that could be taller than it claims
 * would make that arithmetic a guess.
 *
 * A compact list-row door uses the repository's 44pt row floor rather than the
 * 58pt standalone-control height. It remains below the geometry guard's
 * standalone band (45-119) and keeps the strip inside its height budget.
 */
export const MOVING_ROW_HEIGHT = 44;

/**
 * The `Moving` label's line box, pinned rather than inherited.
 *
 * ⚠️ Deliberately explicit. If the label's height came from font metrics, the
 * reserved height and the rendered height would agree only as long as Inter
 * loaded at the moment both were computed — and a font that swaps in late is
 * exactly the "~1-2s after Home paints" window where the height would shift. A pinned line
 * box makes the two heights equal by construction instead of by luck.
 */
export const MOVING_LABEL_LINE_HEIGHT = 16;

/** The label plus the gap under it. Everything above the first row. */
export const MOVING_LABEL_BLOCK_HEIGHT = MOVING_LABEL_LINE_HEIGHT + spacing.xs;

export function movingSlotHeight(rowCount: number): number {
  if (!Number.isFinite(rowCount) || rowCount <= 0) {
    return MOVING_LABEL_BLOCK_HEIGHT;
  }
  return MOVING_LABEL_BLOCK_HEIGHT + Math.floor(rowCount) * MOVING_ROW_HEIGHT;
}

const MOVING_NUMBER_FONT_SIZE = 14;

const MOVING_GLYPH_EM = {
  digit: 0.7,
  sign: 0.7,
  separator: 0.3,
  percent: 1.0,
} as const;

/**
 * Width, in dp, that `text` needs on one line in the change column's type.
 *
 * ⚠️ A model, and deliberately a slightly pessimistic one — anything it does not
 * recognise is charged the widest advance in the table. A model that
 * under-estimates would hand back exactly the wrap it exists to prevent.
 */
export function movingNumberWidth(text: string): number {
  let em = 0;
  for (const glyph of text) {
    if (glyph >= '0' && glyph <= '9') em += MOVING_GLYPH_EM.digit;
    else if (glyph === '+' || glyph === '-') em += MOVING_GLYPH_EM.sign;
    else if (glyph === '.' || glyph === ',') em += MOVING_GLYPH_EM.separator;
    else em += MOVING_GLYPH_EM.percent;
  }
  return em * MOVING_NUMBER_FONT_SIZE;
}

export const MOVING_NUMBER_COLUMN_WIDTH = 120;

export type MovingViewport = {
  /** Height to give the rows. Always a whole multiple of the row height. */
  height: number;
  visibleRows: number;
  /** False means render nothing at all — fail closed. */
  render: boolean;
};

export function resolveMovingViewport(args: {
  /** From `onLayout`. Null/NaN/negative means "not measured yet". */
  measuredHeight: number | null | undefined;
  rowCount: number;
}): MovingViewport {
  const empty: MovingViewport = {
    height: 0,
    visibleRows: 0,
    render: false,
  };

  const measured = args.measuredHeight;
  if (typeof measured !== 'number' || !Number.isFinite(measured)) return empty;
  if (!Number.isFinite(args.rowCount) || args.rowCount <= 0) return empty;

  const rowCount = Math.floor(args.rowCount);
  const visibleRows = Math.max(
    0,
    Math.min(rowCount, Math.floor(measured / MOVING_ROW_HEIGHT)),
  );

  if (visibleRows < 1) return empty;

  return {
    height: visibleRows * MOVING_ROW_HEIGHT,
    visibleRows,
    render: true,
  };
}
