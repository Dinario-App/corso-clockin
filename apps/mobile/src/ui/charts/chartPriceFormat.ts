export const CHART_PRICE_SIGNIFICANT_FIGURES = 3;
const CENTS_DIGITS = 2;

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const;

type Decimal = { whole: string; fraction: string };

export type ChartChange = {
  text: string;
  direction: 'up' | 'down' | 'flat';
};

function parseDecimal(value: string): Decimal | null {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) return null;
  return { whole: match[1]!, fraction: match[2] ?? '' };
}

function isZero(value: Decimal): boolean {
  return value.whole === '0' && !/[1-9]/.test(value.fraction);
}

function groupWhole(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function subscriptInteger(value: number): string {
  return String(value)
    .split('')
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)] ?? '')
    .join('');
}

function leadingZeros(fraction: string): number {
  return fraction.match(/^0*/)?.[0].length ?? 0;
}

function scaledUnits(value: Decimal, scale: number): bigint {
  return BigInt(`${value.whole}${value.fraction.padEnd(scale, '0')}`);
}

function decimalFromUnits(units: bigint, scale: number): Decimal {
  const text = units.toString().padStart(scale + 1, '0');
  return scale === 0
    ? { whole: text, fraction: '' }
    : { whole: text.slice(0, -scale), fraction: text.slice(-scale) };
}

/** Round half-up to exactly `digits` fraction digits. */
function roundHalfUp(value: Decimal, digits: number): Decimal {
  const padded = value.fraction.padEnd(digits + 1, '0');
  const units = BigInt(`${value.whole}${padded.slice(0, digits)}`);
  return decimalFromUnits(Number(padded[digits]) >= 5 ? units + 1n : units, digits);
}

/** `extraDigits` widens the precision; the zone formatter uses it to split ends. */
function formatAt(value: Decimal, extraDigits: number): string {
  if (value.whole !== '0') {
    const rounded = roundHalfUp(value, CENTS_DIGITS + extraDigits);
    return `$${groupWhole(rounded.whole)}.${rounded.fraction}`;
  }
  const significant = CHART_PRICE_SIGNIFICANT_FIGURES + extraDigits;
  const rounded = roundHalfUp(value, leadingZeros(value.fraction) + significant);
  // 0.9996 rounds to 1.000: print it as the dollar price it became.
  if (rounded.whole !== '0') return formatAt(rounded, extraDigits);
  // A carry (0.09996 → 0.1000) moves the digits; it never adds a figure.
  const zeros = leadingZeros(rounded.fraction);
  const digits = rounded.fraction.slice(zeros, zeros + significant);
  return zeros >= 3
    ? `$0.0${subscriptInteger(zeros)}${digits}`
    : `$0.${'0'.repeat(zeros)}${digits}`;
}

/**
 * A chart price: three significant figures below $1 (trailing zeros kept, so
 * a scrubbed price never changes width), cents from $1 up. Three or more
 * leading zeros keep the app's subscript notation (`$0.0₄123`). `null` for
 * zero or anything that is not a plain decimal.
 */
export function formatChartPriceUsd(value: string): string | null {
  const parsed = parseDecimal(value);
  if (!parsed || isZero(parsed)) return null;
  return formatAt(parsed, 0);
}

/**
 * Low and high as chart prices, ordered, and distinct whenever the values
 * differ: both ends take one more digit until they print apart. Equal values
 * print the same text. `null` if either end is not a price.
 */
export function resolveChartPriceBoundsText(
  aUsd: string,
  bUsd: string,
): { lowText: string; highText: string } | null {
  const a = parseDecimal(aUsd);
  const b = parseDecimal(bUsd);
  if (!a || !b || isZero(a) || isZero(b)) return null;
  const scale = Math.max(a.fraction.length, b.fraction.length);
  const order = scaledUnits(a, scale) - scaledUnits(b, scale);
  const [low, high] = order <= 0n ? [a, b] : [b, a];
  if (order === 0n) {
    const text = formatAt(low, 0);
    return { lowText: text, highText: text };
  }
  // At the inputs' own precision nothing rounds, so two different values
  // always print apart by `extra === scale`.
  for (let extra = 0; ; extra += 1) {
    const lowText = formatAt(low, extra);
    const highText = formatAt(high, extra);
    if (lowText !== highText || extra >= scale) return { lowText, highText };
  }
}

/**
 * A price zone (`$0.0418 – $0.0436`). Its ends never print alike: a zone
 * whose ends really are equal is one price, printed once.
 */
export function formatChartZoneUsd(aUsd: string, bUsd: string): string | null {
  const bounds = resolveChartPriceBoundsText(aUsd, bUsd);
  if (!bounds) return null;
  return bounds.lowText === bounds.highText
    ? bounds.lowText
    : `${bounds.lowText} – ${bounds.highText}`;
}

function measureChange(fromUsd: string, toUsd: string) {
  const from = parseDecimal(fromUsd);
  const to = parseDecimal(toUsd);
  if (!from || !to) return null;
  const scale = Math.max(from.fraction.length, to.fraction.length);
  const fromUnits = scaledUnits(from, scale);
  const toUnits = scaledUnits(to, scale);
  if (fromUnits <= 0n || toUnits <= 0n) return null;
  const delta = toUnits - fromUnits;
  const direction: ChartChange['direction'] =
    delta > 0n ? 'up' : delta < 0n ? 'down' : 'flat';
  return {
    scale,
    fromUnits,
    absoluteUnits: delta < 0n ? -delta : delta,
    direction,
    // ASCII signs, like the shared window delta the legacy header prints.
    sign: direction === 'up' ? '+' : direction === 'down' ? '-' : '',
  };
}

export function formatChartPercentChange(
  fromUsd: string,
  toUsd: string,
): ChartChange | null {
  const change = measureChange(fromUsd, toUsd);
  if (!change) return null;
  const tenths =
    (change.absoluteUnits * 1_000n * 2n + change.fromUnits) / (change.fromUnits * 2n);
  return {
    text: `${change.sign}${groupWhole((tenths / 10n).toString())}.${tenths % 10n}%`,
    direction: change.direction,
  };
}

/** The dollar change in chart figures (`-$0.0189`), for the scrub readout. */
export function formatChartAmountChange(
  fromUsd: string,
  toUsd: string,
): ChartChange | null {
  const change = measureChange(fromUsd, toUsd);
  if (!change) return null;
  if (change.absoluteUnits === 0n) return { text: '$0.00', direction: 'flat' };
  const amount = formatAt(decimalFromUnits(change.absoluteUnits, change.scale), 0);
  return { text: `${change.sign}${amount}`, direction: change.direction };
}
