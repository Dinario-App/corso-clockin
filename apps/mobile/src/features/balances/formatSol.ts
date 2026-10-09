import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { formatCompactTokenAmount } from '@/src/ui/format/numberCraft';

/**
 * Format lamports as a human SOL string (no fiat).
 * Trailing zeros trimmed after the decimal; always includes unit.
 */
export function formatSolBalance(lamports: number): string {
  if (!Number.isFinite(lamports) || lamports < 0) {
    throw new Error('Invalid lamports');
  }
  const sol = lamports / LAMPORTS_PER_SOL;
  // Up to 9 decimals (lamport precision), strip trailing zeros.
  const raw = sol.toFixed(9).replace(/\.?0+$/, '');
  const compact = formatCompactTokenAmount(raw);
  if (!compact) throw new Error('Invalid SOL display amount');
  return `${compact.compact} SOL`;
}

export function formatSolBalanceFull(lamports: number): string {
  if (!Number.isFinite(lamports) || lamports < 0) throw new Error('Invalid lamports');
  const raw = (lamports / LAMPORTS_PER_SOL).toFixed(9).replace(/\.?0+$/, '');
  const full = formatCompactTokenAmount(raw)?.full;
  if (!full) throw new Error('Invalid SOL display amount');
  return `${full} SOL`;
}

/** Home balance slot text — never invent $0.00 when unknown. */
export function homeBalanceLabel(state: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  lamports: number | null;
  placeholder: string;
}): string {
  if (state.status === 'ready' && state.lamports !== null) {
    return formatSolBalance(state.lamports);
  }
  return state.placeholder;
}
