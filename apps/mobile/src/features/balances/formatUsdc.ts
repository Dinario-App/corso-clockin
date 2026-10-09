import { formatAtomicAmount } from '@/src/features/swap/tokens';
import { USDC_DECIMALS } from './usdcConstants';
import { formatCompactTokenAmount } from '@/src/ui/format/numberCraft';

/**
 * Format USDC atomic units for Home / Assets (no fiat).
 * Accepts bigint, number (safe integer only), or decimal string of whole atomics.
 */
export function formatUsdcBalance(atomic: bigint | number | string): string {
  let asBig: bigint;
  if (typeof atomic === 'bigint') {
    asBig = atomic;
  } else if (typeof atomic === 'number') {
    if (!Number.isFinite(atomic) || !Number.isInteger(atomic) || atomic < 0) {
      throw new Error('Invalid USDC atomic amount');
    }
    asBig = BigInt(atomic);
  } else {
    if (!/^\d+$/.test(atomic)) {
      throw new Error('Invalid USDC atomic amount');
    }
    asBig = BigInt(atomic);
  }
  if (asBig < 0n) throw new Error('Invalid USDC atomic amount');
  const compact = formatCompactTokenAmount(
    formatAtomicAmount(asBig.toString(), USDC_DECIMALS),
  );
  if (!compact) throw new Error('Invalid USDC display amount');
  return `${compact.compact} USDC`;
}

export function formatUsdcBalanceFull(atomic: bigint | number | string): string {
  let asBig: bigint;
  if (typeof atomic === 'bigint') asBig = atomic;
  else if (typeof atomic === 'number' && Number.isSafeInteger(atomic) && atomic >= 0) asBig = BigInt(atomic);
  else if (typeof atomic === 'string' && /^\d+$/.test(atomic)) asBig = BigInt(atomic);
  else throw new Error('Invalid USDC atomic amount');
  const full = formatCompactTokenAmount(
    formatAtomicAmount(asBig.toString(), USDC_DECIMALS),
  )?.full;
  if (!full) throw new Error('Invalid USDC display amount');
  return `${full} USDC`;
}

/** Home/assets USDC slot — em dash until RPC confirms; never invent $0.00. */
export function homeUsdcLabel(state: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  atomic: bigint | null;
  placeholder: string;
}): string {
  if (state.status === 'ready' && state.atomic !== null) {
    return formatUsdcBalance(state.atomic);
  }
  return state.placeholder;
}
