import { USDC_DECIMALS } from '@/src/features/balances/usdcConstants';

const USDC_ATOMIC_PER_UNIT = 10n ** BigInt(USDC_DECIMALS);
export const SPL_TOKEN_U64_MAX = (1n << 64n) - 1n;

/**
 * Parse a user USDC amount string into atomic units (6 decimals).
 * Rejects scientific notation, negatives, zero, malformed input, and >6 dp.
 */
export function usdcAmountToAtomic(amount: string): bigint | null {
  const trimmed = amount.trim();
  if (!trimmed || trimmed === '.') return null;
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return null;

  const [wholePart, fracPart = ''] = trimmed.split('.');
  const whole = wholePart === '' ? 0n : BigInt(wholePart);
  const fracPadded = `${fracPart}000000`.slice(0, USDC_DECIMALS);
  const atomic = whole * USDC_ATOMIC_PER_UNIT + BigInt(fracPadded);

  if (atomic <= 0n || atomic > SPL_TOKEN_U64_MAX) return null;
  return atomic;
}

/** Format atomic USDC as a compact decimal string (no unit). */
export function atomicToUsdcString(atomic: bigint): string {
  if (atomic < 0n || atomic > SPL_TOKEN_U64_MAX) {
    throw new Error('Invalid USDC atomic amount');
  }
  const whole = atomic / USDC_ATOMIC_PER_UNIT;
  const frac = atomic % USDC_ATOMIC_PER_UNIT;
  if (frac === 0n) return whole.toString();
  const fracStr = frac
    .toString()
    .padStart(USDC_DECIMALS, '0')
    .replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}
