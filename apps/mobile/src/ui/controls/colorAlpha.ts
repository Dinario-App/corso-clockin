const HEX6 = /^#([0-9a-fA-F]{6})$/;
const HEX3 = /^#([0-9a-fA-F]{3})$/;
const RGB_FN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

/**
 * `token` at `alpha`, as an `rgba()` string React Native accepts everywhere a
 * colour is taken (fill, border, shadow, gradient stop).
 *
 * An `rgba()` input keeps its channels and takes the new alpha — the caller is
 * asking for "this colour, that opaque", not "this colour, dimmed twice".
 *
 * @throws if the token is not a colour this system uses. A silent fallback here
 * would paint a wrong-but-plausible colour, which is exactly the class of bug
 * the azure-discipline guard exists to catch.
 */
export function withAlpha(token: string, alpha: number): string {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
    throw new RangeError(`withAlpha alpha must be 0–1, got ${String(alpha)}`);
  }

  const { r, g, b } = parseChannels(token);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function parseChannels(token: string): { r: number; g: number; b: number } {
  const six = HEX6.exec(token);
  if (six) {
    const n = Number.parseInt(six[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const three = HEX3.exec(token);
  if (three) {
    const [a, b, c] = three[1];
    return {
      r: Number.parseInt(`${a}${a}`, 16),
      g: Number.parseInt(`${b}${b}`, 16),
      b: Number.parseInt(`${c}${c}`, 16),
    };
  }

  const fn = RGB_FN.exec(token);
  if (fn) {
    return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]) };
  }

  throw new TypeError(`withAlpha cannot read the colour token ${token}`);
}
