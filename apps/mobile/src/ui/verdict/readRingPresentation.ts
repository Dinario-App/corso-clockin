import { colors, safetyPalette } from '@/src/ui/tokens';
import type { ReadRingMark } from '@/src/features/tokenVitals/readRingCatalog';
import type {
  SafetyFlagLevel,
  SafetyVerdictLevel,
} from '@/src/features/tokenVitals/types';

/* ─── Paint ───────────────────────────────────────────────────────────────── */

export const READ_RING_INK = 'rgba(255, 255, 255, 0.52)';

export const READ_RING_TRACK = colors.line;

/** Every colour the ring and the grid may paint. No hue outside this map. */
export const READ_RING_PAINT = Object.freeze({
  ink: READ_RING_INK,
  track: READ_RING_TRACK,
  info: colors.inkTertiary,
  notRead: colors.inkQuaternary,
  warn: safetyPalette.caution,
  danger: safetyPalette.danger,
});

export function resolveArcColor(level: SafetyFlagLevel | null): string {
  if (level === 'danger') return READ_RING_PAINT.danger;
  if (level === 'warn') return READ_RING_PAINT.warn;
  return READ_RING_PAINT.ink;
}

export function resolveMarkColor(mark: ReadRingMark): string {
  switch (mark) {
    case 'danger':
      return READ_RING_PAINT.danger;
    case 'warn':
      return READ_RING_PAINT.warn;
    case 'info':
      return READ_RING_PAINT.info;
    case 'not_read':
      return READ_RING_PAINT.notRead;
    case 'clean':
    case 'unknown':
    default:
      return READ_RING_PAINT.ink;
  }
}

/** Filled marks are solid; the two ring marks are hollow strokes. */
export function isHollowMark(mark: ReadRingMark): boolean {
  return mark === 'unknown' || mark === 'not_read';
}

export function resolveCentreDotColor(
  verdict: SafetyVerdictLevel,
): string | null {
  if (verdict === 'green') return safetyPalette.clear;
  if (verdict === 'amber') return READ_RING_PAINT.warn;
  if (verdict === 'red') return READ_RING_PAINT.danger;
  return null;
}

/* ─── The arc state ───────────────────────────────────────────────────────── */

export type ReadRingArcState = 'read' | 'not_read';

export function resolveArcState(check: {
  answered: boolean;
}): ReadRingArcState {
  return check.answered ? 'read' : 'not_read';
}

/* ─── Geometry ────────────────────────────────────────────────────────────── */

/** The three places the ring is drawn, with their sizes. */
export const READ_RING_SIZE = Object.freeze({
  /** On the verdict card, beside the word. */
  card: Object.freeze({ size: 46, stroke: 3.2 }),
  /** On token detail, wrapped around the 48 dp token art. */
  face: Object.freeze({ size: 62, stroke: 3.4, art: 48 }),
  /** On a Discover row, wrapped around the 30 dp ticker well. */
  discover: Object.freeze({ size: 46, stroke: 2.8 }),
});

export type ReadRingPlacement = keyof typeof READ_RING_SIZE;

/** The gap between arcs, in degrees. Clockwise from 12 o'clock. */
export const READ_RING_GAP_DEG = 9;
/** An unread arc is a thinner track, so a gap reads as absence, not as grey. */
export const READ_RING_TRACK_STROKE_RATIO = 0.55;

export type ReadRingArc = {
  index: number;
  state: ReadRingArcState;
  /** The SVG path for the arc's sweep. */
  d: string;
  color: string;
  strokeWidth: number;
  /** Arc length in dp — the dash the draw-on reveals. */
  length: number;
  /** Where this arc starts and ends along the whole sweep, 0…1. */
  startFraction: number;
  endFraction: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pointOn(
  centre: number,
  radius: number,
  degrees: number,
): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: round2(centre + radius * Math.cos(radians)),
    y: round2(centre + radius * Math.sin(radians)),
  };
}

/**
 * The eight arcs, in ring order. Each input carries only what the ring is
 * allowed to know: whether its source answered, and the level the server put
 * on it.
 */
export function resolveReadRingArcs(input: {
  checks: readonly { answered: boolean; level: SafetyFlagLevel | null }[];
  size: number;
  stroke: number;
  gapDeg?: number;
}): ReadRingArc[] {
  const count = input.checks.length;
  if (count === 0) return [];
  const gap = input.gapDeg ?? READ_RING_GAP_DEG;
  const centre = input.size / 2;
  const radius = input.size / 2 - input.stroke / 2 - 0.5;
  const sweep = 360 / count;
  return input.checks.map((check, index) => {
    const state = resolveArcState(check);
    const from = -90 + index * sweep + gap / 2;
    const to = -90 + (index + 1) * sweep - gap / 2;
    const start = pointOn(centre, radius, from);
    const end = pointOn(centre, radius, to);
    const strokeWidth =
      state === 'not_read'
        ? round2(input.stroke * READ_RING_TRACK_STROKE_RATIO)
        : input.stroke;
    return {
      index,
      state,
      d: `M${start.x} ${start.y}A${round2(radius)} ${round2(radius)} 0 0 1 ${end.x} ${end.y}`,
      color:
        state === 'not_read'
          ? READ_RING_PAINT.track
          : resolveArcColor(check.level),
      strokeWidth,
      length: round2((radius * (sweep - gap) * Math.PI) / 180),
      startFraction: round2(index / count),
      endFraction: round2((index + 1) / count),
    };
  });
}

/** The centre dot's radius: `max(3.5, size × .09)`. */
export function resolveCentreDotRadius(size: number): number {
  return round2(Math.max(3.5, size * 0.09));
}

/* ─── Motion ──────────────────────────────────────────────────────────────── */

export const READ_RING_DRAW_MS = 600;

export type ReadRingDrawPlan = {
  animated: boolean;
  durationMs: number;
  /** Always one: the whole ring is a single reveal. */
  steps: 1;
};

export function resolveReadRingDrawOn(input: {
  reduceMotion: boolean;
}): ReadRingDrawPlan {
  return input.reduceMotion
    ? { animated: false, durationMs: 0, steps: 1 }
    : { animated: true, durationMs: READ_RING_DRAW_MS, steps: 1 };
}

/* ─── The grid ────────────────────────────────────────────────────────────── */

export const CHECK_GRID = Object.freeze({
  columns: 2,
  columnGap: 12,
  rowPaddingVertical: 9,
  /** Label \u2192 value, and value \u2192 each second line, inside one cell. */
  lineGap: 3,
  labelSize: 13,
  labelLineHeight: 17,
  valueSize: 16,
  valueLineHeight: 20,
  valueWeight: '400' as const,
  extraSize: 13,
  extraLineHeight: 17,
  markSlot: 11,
  markGap: 7,
  /** The value and the second lines hang under the label, past its mark. */
  valueIndent: 18,
});

/** The grid's column width at a given card inner width. */
export function resolveCheckGridCellWidth(innerWidth: number): number {
  return round2(
    (innerWidth - CHECK_GRID.columnGap * (CHECK_GRID.columns - 1)) /
      CHECK_GRID.columns,
  );
}

export function resolveCheckGridRows<T>(cells: readonly T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let index = 0; index < cells.length; index += CHECK_GRID.columns) {
    const row: (T | null)[] = [];
    for (let column = 0; column < CHECK_GRID.columns; column += 1) {
      row.push(cells[index + column] ?? null);
    }
    rows.push(row);
  }
  return rows;
}

/** The not-run rows and the caption sit between the reason and the grid. */
export const READ_RING_CARD = Object.freeze({
  /** Ring → word column. */
  topRowGap: 10,
  coverageSize: 13,
  coverageLineHeight: 17,
  stampSize: 13,
  gridMarginTop: 10,
  captionSize: 13,
  captionMarginTop: 8,
  footnoteSize: 13,
  footnoteMarginTop: 10,
});
