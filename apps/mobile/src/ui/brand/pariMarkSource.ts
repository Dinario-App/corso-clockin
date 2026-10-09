export const PARI_MARK_VIEW_BOX = '0 0 100 100';

export const PARI_MARK_FILL = '#F4F1EC';

export const PARI_MARK_PATHS = [
  'M22 22H73.47L22 73.47Z',
  'M78 78H26.53L78 26.53Z',
] as const;

function kitTriangleVertices(
  d: string,
): ReadonlyArray<readonly [number, number]> {
  const numbers: number[] = [];
  let value = 0;
  let fraction = 0;
  let places = 0;
  let inNumber = false;
  const push = () => {
    const scale = places > 1 ? 10 ** (places - 1) : 1;
    numbers.push(value + fraction / scale);
    inNumber = false;
  };
  for (let i = 0; i < d.length; i += 1) {
    const code = d.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      const digit = code - 48;
      if (!inNumber) {
        value = 0;
        fraction = 0;
        places = 0;
        inNumber = true;
      }
      if (places > 0) {
        fraction = fraction * 10 + digit;
        places += 1;
      } else {
        value = value * 10 + digit;
      }
    } else if (code === 46 && inNumber && places === 0) {
      places = 1;
    } else if (inNumber) {
      push();
    }
  }
  if (inNumber) push();
  if (
    numbers.length !== 5 ||
    numbers.some((entry) => !Number.isFinite(entry))
  ) {
    throw new Error(d);
  }
  const x0 = numbers[0] ?? 0;
  const y0 = numbers[1] ?? 0;
  const x1 = numbers[2] ?? 0;
  const x2 = numbers[3] ?? 0;
  const y2 = numbers[4] ?? 0;
  return [
    [x0, y0],
    [x1, y0],
    [x2, y2],
  ];
}

/** Axis-aligned extent of the path vertices. The viewBox margin is not ink. */
export function pariMarkInkBox(paths: readonly string[]): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const d of paths) {
    for (const [x, y] of kitTriangleVertices(d)) {
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
    }
  }
  return { left, top, right, bottom };
}

/** Ink extent of `PARI_MARK_PATHS` in the viewBox. Derived, not typed. */
export const PARI_MARK_INK = Object.freeze(pariMarkInkBox(PARI_MARK_PATHS));
