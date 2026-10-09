const LAMPORTS_PER_SOL = 1_000_000_000n;

/**
 * Parse a user SOL amount string into lamports.
 * Rejects scientific notation, negatives, and >9 decimal places.
 */
export function solAmountToLamports(amount: string): number | null {
  const trimmed = amount.trim();
  if (!trimmed || trimmed === '.') return null;
  if (!/^\d+(\.\d{0,9})?$/.test(trimmed)) return null;

  const [wholePart, fracPart = ''] = trimmed.split('.');
  const whole = wholePart === '' ? 0n : BigInt(wholePart);
  const fracPadded = `${fracPart}000000000`.slice(0, 9);
  const lamports = whole * LAMPORTS_PER_SOL + BigInt(fracPadded);

  if (lamports <= 0n) return null;
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(lamports);
}

/** Format lamports as a compact SOL string for fee / review rows (no unit). */
export function lamportsToSolString(lamports: number): string {
  if (!Number.isFinite(lamports) || lamports < 0) {
    throw new Error('Invalid lamports');
  }
  const sol = lamports / 1_000_000_000;
  return sol.toFixed(9).replace(/\.?0+$/, '');
}
