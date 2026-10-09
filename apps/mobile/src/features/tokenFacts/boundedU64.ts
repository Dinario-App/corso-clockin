export const MAX_U64 = 18_446_744_073_709_551_615n;

export const MAX_U64_DECIMAL_LENGTH = 20;

export function parseCanonicalBoundedU64DecimalString(
  value: unknown,
): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  if (value.length === 0 || value.length > MAX_U64_DECIMAL_LENGTH) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) return undefined;
  if (value.length > 1 && value.startsWith('0')) return undefined;
  try {
    const parsed = BigInt(value);
    if (parsed > MAX_U64) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function isCanonicalBoundedU64DecimalString(value: string): boolean {
  return parseCanonicalBoundedU64DecimalString(value) === value;
}
