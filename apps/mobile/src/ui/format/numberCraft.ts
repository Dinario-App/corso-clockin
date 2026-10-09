const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'] as const;

type ParsedDecimal = {
  whole: string;
  fraction: string;
};

function parseDecimal(value: string): ParsedDecimal | null {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) return null;
  return { whole: match[1]!, fraction: match[2] ?? '' };
}

function groupWhole(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Group an already-normalized unsigned decimal without changing its value. */
export function groupDecimalDigits(value: string): string | null {
  const parsed = parseDecimal(value);
  if (!parsed) return null;
  const grouped = groupWhole(parsed.whole);
  return parsed.fraction ? `${grouped}.${parsed.fraction}` : grouped;
}

export function formatFiatAmount(value: string): string | null {
  const grouped = groupDecimalDigits(value);
  return grouped == null ? null : `$${grouped}`;
}

function subscriptInteger(value: number): string {
  return String(value)
    .split('')
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)] ?? '')
    .join('');
}

function roundToCents(parsed: ParsedDecimal): string {
  const fraction = `${parsed.fraction}000`;
  let cents = BigInt(parsed.whole) * 100n + BigInt(fraction.slice(0, 2));
  if (Number(fraction[2]) >= 5) cents += 1n;
  const whole = cents / 100n;
  const minor = (cents % 100n).toString().padStart(2, '0');
  return `${groupWhole(whole.toString())}.${minor}`;
}

/** USD price formatting, including compact leading-zero notation below a cent. */
export function formatPriceUsd(value: string): string | null {
  const parsed = parseDecimal(value);
  if (!parsed) return null;
  if (BigInt(parsed.whole) === 0n && !/[1-9]/.test(parsed.fraction)) return null;

  const leadingZeros = parsed.fraction.match(/^0*/)?.[0].length ?? 0;
  if (parsed.whole === '0' && leadingZeros >= 3) {
    const significant = parsed.fraction.slice(leadingZeros, leadingZeros + 4);
    if (!significant) return null;
    return `$0.0${subscriptInteger(leadingZeros)}${significant}`;
  }

  if (parsed.whole === '0' && leadingZeros === 2) {
    const significant = parsed.fraction
      .slice(leadingZeros, leadingZeros + 4)
      .replace(/0+$/, '');
    return significant ? `$0.00${significant}` : null;
  }

  return `$${roundToCents(parsed)}`;
}

export type CompactTokenAmount = {
  compact: string;
  full: string;
  truncated: boolean;
};

export type WindowDelta = {
  text: string;
  direction: 'up' | 'down' | 'flat';
};

function scaledInteger(parsed: ParsedDecimal, scale: number): bigint {
  return BigInt(`${parsed.whole}${parsed.fraction.padEnd(scale, '0')}`);
}

function decimalFromScaledInteger(value: bigint, scale: number): string {
  if (scale === 0) return value.toString();
  const digits = value.toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

/** Exact first-to-last USD delta with a one-decimal absolute percentage. */
export function formatWindowDelta(
  firstUsd: string,
  lastUsd: string,
): WindowDelta | null {
  const first = parseDecimal(firstUsd);
  const last = parseDecimal(lastUsd);
  if (!first || !last) return null;

  const scale = Math.max(first.fraction.length, last.fraction.length);
  const firstUnits = scaledInteger(first, scale);
  const lastUnits = scaledInteger(last, scale);
  if (firstUnits <= 0n || lastUnits <= 0n) return null;

  const deltaUnits = lastUnits - firstUnits;
  const direction = deltaUnits > 0n
    ? 'up'
    : deltaUnits < 0n
      ? 'down'
      : 'flat';
  const absoluteDelta = deltaUnits < 0n ? -deltaUnits : deltaUnits;
  const money = absoluteDelta === 0n
    ? '$0.00'
    : formatPriceUsd(decimalFromScaledInteger(absoluteDelta, scale));
  if (money == null) return null;

  // Percentage tenths: abs(delta) / first * 100%, rounded half-up.
  const percentTenths =
    (absoluteDelta * 1_000n * 2n + firstUnits) / (firstUnits * 2n);
  const percent = `${percentTenths / 10n}.${percentTenths % 10n}%`;
  const sign = direction === 'up' ? '+' : direction === 'down' ? '-' : '';
  return { text: `${sign}${money} (${percent})`, direction };
}

/** Keep all whole digits and at most three significant fractional digits. */
export function formatCompactTokenAmount(
  value: string,
): CompactTokenAmount | null {
  const parsed = parseDecimal(value);
  if (!parsed) return null;
  const groupedWhole = groupWhole(parsed.whole);
  const full = parsed.fraction
    ? `${groupedWhole}.${parsed.fraction}`
    : groupedWhole;

  const firstSignificant = parsed.fraction.search(/[1-9]/);
  const end = firstSignificant < 0
    ? parsed.fraction.length
    : Math.min(parsed.fraction.length, firstSignificant + 3);
  const compactFraction = parsed.fraction.slice(0, end).replace(/0+$/, '');
  const compact = compactFraction
    ? `${groupedWhole}.${compactFraction}`
    : groupedWhole;
  return { compact, full, truncated: compact !== full };
}
