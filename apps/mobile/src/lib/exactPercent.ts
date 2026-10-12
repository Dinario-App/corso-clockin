export function bpsToExactPercent(bps: number): string | null {
  if (!Number.isSafeInteger(bps) || bps < 0) return null;
  const whole = Math.trunc(bps / 100);
  const cents = bps % 100;
  if (cents === 0) return String(whole);
  const frac = String(cents).padStart(2, '0').replace(/0+$/, '');
  return `${whole}.${frac}`;
}

/**
 * The inverse, for a percent the person typed: "0.5" is 50 bps. Returns null
 * for anything that is not a plain non-negative number with at most two
 * decimals, because a bps limit cannot hold a finer step than 0.01%.
 */
export function exactPercentToBps(text: string): number | null {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*%?\s*$/.exec(text);
  if (match === null) return null;
  const whole = Number(match[1]);
  const frac = Number((match[2] ?? '').padEnd(2, '0'));
  const bps = whole * 100 + frac;
  return Number.isSafeInteger(bps) ? bps : null;
}
