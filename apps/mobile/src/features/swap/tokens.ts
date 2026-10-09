/** Swap tokens — Solana mints only (IA: no EVM). */
import { formatCompactTokenAmount } from '@/src/ui/format/numberCraft';

/**
 * The two tokens Corso can read a balance for, and so the only two it can pay
 * *with*. What you receive is any mint search returns, which is the point:
 * buying a token you do not hold is the business, not an edge case.
 */
export type SwapTokenSymbol = 'SOL' | 'USDC';

export type SwapToken = {
  /** Free text — a searched token's symbol is whatever its mint says it is. */
  symbol: string;
  mint: string;
  decimals: number;
};

/** Wrapped SOL — same mint across clusters. */
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * USDC mint by cluster.
 * Jupiter Meta liquidity is mainnet-first; on devnet quotes may fail honestly.
 */
export const USDC_MINT_MAINNET =
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const USDC_MINT_DEVNET =
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export function usdcMintForCluster(
  cluster: 'devnet' | 'mainnet-beta',
): string {
  return cluster === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
}

export function tokenForSymbol(
  symbol: SwapTokenSymbol,
  cluster: 'devnet' | 'mainnet-beta',
): SwapToken {
  if (symbol === 'SOL') {
    return { symbol: 'SOL', mint: SOL_MINT, decimals: 9 };
  }
  return {
    symbol: 'USDC',
    mint: usdcMintForCluster(cluster),
    decimals: 6,
  };
}

/**
 * Provable mint decimals from the on-chain mint-account cache.
 *
 * Used by the outer-fee gate to bind the `decimals` byte of a
 * `TransferChecked` (binding requirement 9). Returns null when decimals are
 * missing, stale, or unprovable — fee-bearing swaps fail closed rather than
 * trusting a provider-supplied number.
 */
export { provableMintDecimals as decimalsForKnownMint } from '@/src/features/tokens/mintDecimals';

export function formatAtomicAmount(
  atomic: string | number,
  decimals: number,
): string {
  const asBig =
    typeof atomic === 'number' ? BigInt(Math.trunc(atomic)) : BigInt(atomic);
  if (asBig < 0n) throw new Error('Invalid amount');
  const base = 10n ** BigInt(decimals);
  const whole = asBig / base;
  const frac = asBig % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

/** Presentation-only compact amount. Parsing/signing keep full atomic precision. */
export function formatAtomicDisplayAmount(
  atomic: string | number,
  decimals: number,
): string {
  const full = formatAtomicAmount(atomic, decimals);
  return formatCompactTokenAmount(full)?.compact ?? full;
}

/**
 * Parse a decimal amount string into atomic units for the token decimals.
 */
export function amountToAtomic(
  amount: string,
  decimals: number,
): string | null {
  const trimmed = amount.trim();
  if (!trimmed || trimmed === '.') return null;
  const pattern = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);
  if (!pattern.test(trimmed)) return null;

  const [wholePart, fracPart = ''] = trimmed.split('.');
  const whole = wholePart === '' ? 0n : BigInt(wholePart);
  const fracPadded = `${fracPart}${'0'.repeat(decimals)}`.slice(0, decimals);
  const atomic = whole * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
  if (atomic <= 0n) return null;
  return atomic.toString();
}

export function feeBpsToPercentLabel(bps: number): string {
  const pct = bps / 100;
  const fixed = pct.toFixed(2).replace(/\.?0+$/, '');
  return `${fixed}%`;
}

export function resolveDisplayCorsoFeeBps(
  corsoFeeBps: number | null | undefined,
  fallbackBps: number | null,
): number | null {
  if (corsoFeeBps == null) {
    if (
      fallbackBps == null ||
      !Number.isInteger(fallbackBps) ||
      fallbackBps < 0 ||
      fallbackBps > 10_000
    ) {
      return null;
    }
    return fallbackBps;
  }
  if (
    !Number.isInteger(corsoFeeBps) ||
    corsoFeeBps < 0 ||
    corsoFeeBps > 10_000
  ) {
    return null;
  }
  return corsoFeeBps;
}
