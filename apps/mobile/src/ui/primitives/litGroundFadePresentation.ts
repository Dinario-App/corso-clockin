import type { LitGround } from './litGround';
import type { ScrollEdgeFadePresentation } from './scrollEdgeFadePresentation';

/**
 * Where a scroll fade sits inside the ground it is drawn over, in dp: the
 * fade's own box (the scroller's wrapper) measured against the ground's view,
 * and the ground's size.
 */
export type LitGroundFadeGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  groundWidth: number;
  groundHeight: number;
};

/**
 * One column of a band: a vertical gradient whose colour at each stop is the
 * ground's colour at the column's centre, and whose alpha is the fade's.
 */
export type LitGroundFadeColumn = {
  key: string;
  left: number;
  width: number;
  colors: [string, string, ...string[]];
  locations: [number, number, ...number[]];
};

/** One edge of the fade: where it sits in the fade's box, and its columns. */
export type LitGroundFadeBand = {
  edge: 'top' | 'bottom';
  /** Offset of the band's top inside the fade's box. */
  top: number;
  height: number;
  columns: LitGroundFadeColumn[];
};

/**
 * How wide a column is, in dp. The ground changes by under 0.05 of a level per
 * dp across the width, so a column's one colour is within 0.15 of a level of
 * the ground anywhere inside it.
 */
const COLUMN = 6;
const MAX_STOP_GAP = 3;

const ALPHA_LEVELS = 255;
/** Steps of whole 255ths that land on both ends of a full ramp: 255's divisors. */
const ALPHA_STEPS = [255, 85, 51, 17, 15, 5, 3, 1];

/** The ground's colour at a point of its box, at an alpha (`LitGround.colorAt`). */
type GroundColorAt = LitGround['colorAt'];

/**
 * The fade over a lit ground, as bands of narrow columns.
 *
 * Each column is one vertical gradient. Its alpha is the alpha the one-colour
 * fade has at that depth, CONTINUOUS and unchanged: full at the scroller's top
 * edge and none at the fade's foot; at the bottom a ramp, then a held cover.
 * Its stops sit on whole 255ths of alpha (`ALPHA_LEVELS`), so the ramp is the
 * same after the native colour conversion as before it.
 * What changes is the colour: at every stop it is the ground's own colour at
 * that point, as the ground itself reports it (`LitGround.colorAt`). Over bare
 * ground a column lays the ground's colour on the ground at any alpha, so
 * there is no edge to see; over content it hides exactly what the one-colour
 * fade hid.
 *
 * `null` when the ground cannot report its colour: the caller draws the
 * one-colour fade instead.
 */
export function resolveLitGroundFadeBands(
  fade: Pick<
    ScrollEdgeFadePresentation,
    'top' | 'bottom' | 'bottomCover' | 'bottomTotal'
  >,
  geometry: LitGroundFadeGeometry,
  colorAt: GroundColorAt,
): LitGroundFadeBand[] | null {
  let unreadable = false;

  const band = (
    edge: 'top' | 'bottom',
    top: number,
    height: number,
    /**
     * The fade's breakpoints inside the band, as [depth, alpha in 255ths]:
     * each leg is a full ramp (0 to 255 or back) or a held alpha.
     */
    ramp: [number, number][],
  ): LitGroundFadeBand => {
    // Each stop: a depth in the band, and its alpha in whole 255ths.
    const stops: { depth: number; level: number }[] = [];
    for (let i = 1; i < ramp.length; i += 1) {
      const [from, fromLevel] = ramp[i - 1]!;
      const [to, toLevel] = ramp[i]!;
      const length = to - from;
      if (length <= 0) continue;
      if (stops.length === 0) stops.push({ depth: from, level: fromLevel });
      if (fromLevel === toLevel) {
        // A held alpha: stops wherever the colour needs them, all at it.
        const count = Math.ceil(length / MAX_STOP_GAP);
        for (let j = 1; j <= count; j += 1) {
          stops.push({ depth: from + (length * j) / count, level: toLevel });
        }
        continue;
      }
      // A full ramp: the coarsest step of whole 255ths that keeps the stops
      // within MAX_STOP_GAP of each other.
      const step =
        ALPHA_STEPS.find((s) => (length * s) / ALPHA_LEVELS <= MAX_STOP_GAP) ?? 1;
      const direction = toLevel > fromLevel ? 1 : -1;
      for (let moved = step; moved <= ALPHA_LEVELS; moved += step) {
        stops.push({
          depth: from + (length * moved) / ALPHA_LEVELS,
          level: fromLevel + direction * moved,
        });
      }
    }
    const columns: LitGroundFadeColumn[] = [];
    for (let left = 0; left < geometry.width; left += COLUMN) {
      const width = Math.min(COLUMN, geometry.width - left);
      const x = geometry.x + left + width / 2;
      const colors = stops.map(({ depth, level }) => {
        const color = colorAt(
          x,
          geometry.y + top + depth,
          geometry.groundWidth,
          geometry.groundHeight,
          level / ALPHA_LEVELS,
        );
        if (color === null) unreadable = true;
        return color ?? '';
      });
      columns.push({
        key: `${edge}-${left}`,
        left,
        width,
        colors: colors as LitGroundFadeColumn['colors'],
        locations: stops.map(
          ({ depth }) => depth / height,
        ) as LitGroundFadeColumn['locations'],
      });
    }
    return { edge, top, height, columns };
  };

  const bands: LitGroundFadeBand[] = [];
  if (fade.top > 0) {
    bands.push(
      band('top', 0, fade.top, [
        [0, ALPHA_LEVELS],
        [fade.top, 0],
      ]),
    );
  }
  if (fade.bottomTotal > 0) {
    const ramp: [number, number][] =
      fade.bottom > 0
        ? [
            [0, 0],
            [fade.bottom, ALPHA_LEVELS],
            [fade.bottomTotal, ALPHA_LEVELS],
          ]
        : [
            [0, ALPHA_LEVELS],
            [fade.bottomTotal, ALPHA_LEVELS],
          ];
    bands.push(
      band(
        'bottom',
        geometry.height - fade.bottomTotal,
        fade.bottomTotal,
        ramp,
      ),
    );
  }
  return unreadable ? null : bands;
}

/** A measurement that can place the ground's paint: finite, and not empty. */
export function isUsableLitGroundFadeGeometry(
  geometry: LitGroundFadeGeometry,
): boolean {
  const values = [
    geometry.x,
    geometry.y,
    geometry.width,
    geometry.height,
    geometry.groundWidth,
    geometry.groundHeight,
  ];
  return (
    values.every((value) => Number.isFinite(value)) &&
    geometry.width > 0 &&
    geometry.height > 0 &&
    geometry.groundWidth > 0 &&
    geometry.groundHeight > 0
  );
}

export function sameLitGroundFadeGeometry(
  a: LitGroundFadeGeometry | null,
  b: LitGroundFadeGeometry | null,
): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.groundWidth === b.groundWidth &&
    a.groundHeight === b.groundHeight
  );
}
