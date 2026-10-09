export const ALERT_CAP = 10;
export type Direction = 'above' | 'below';
export type SpotPrice = { price: string; asOfMs: number };
// Same decimal grammar and freshness budget as the existing price-alert route.
const SCALE = 18;
function scaled(raw: unknown): bigint | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{1,40})(?:\.(\d{1,18}))?$/.exec(raw);
  if (!m) return null;
  const value = BigInt(m[1] + (m[2] ?? '').padEnd(SCALE, '0'));
  return value > 0n ? value : null;
}
export function normalizeThreshold(raw: unknown): string | null {
  const value = scaled(raw);
  if (value === null) return null;
  const digits = value.toString().padStart(SCALE + 1, '0');
  const fraction = digits.slice(-SCALE).replace(/0+$/, '');
  return digits.slice(0, -SCALE) + (fraction ? '.' + fraction : '');
}
export function refusal(
  direction: Direction,
  threshold: string,
  spot: SpotPrice | null,
  now = Date.now(),
): 'price' | 'crossed' | 'invalid' | null {
  const target = scaled(threshold);
  if (target === null) return 'invalid';
  const observed = scaled(spot?.price);
  if (
    observed === null ||
    !spot ||
    !Number.isSafeInteger(spot.asOfMs) ||
    spot.asOfMs < 0 ||
    Math.abs(now - spot.asOfMs) > 60_000
  )
    return 'price';
  if (direction === 'above' ? observed >= target : observed <= target)
    return 'crossed';
  return null;
}

export function normalizePriceInput(
  raw: string,
  decimal = new Intl.NumberFormat()
    .formatToParts(1.1)
    .find((part) => part.type === 'decimal')?.value ?? '.',
) {
  return normalizeThreshold(
    decimal === ',' && /^\d+,\d+$/.test(raw) ? raw.replace(',', '.') : raw,
  );
}
export function isFreshPrice(spot: SpotPrice | null, now = Date.now()) {
  return (
    !!spot &&
    normalizeThreshold(spot.price) !== null &&
    Number.isSafeInteger(spot.asOfMs) &&
    spot.asOfMs >= 0 &&
    Math.abs(now - spot.asOfMs) <= 60000
  );
}
