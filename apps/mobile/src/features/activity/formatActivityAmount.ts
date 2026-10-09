import { copy } from '@/constants/copy';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { formatAtomicDisplayAmount } from '@/src/features/swap/tokens';
import { USDC_DECIMALS } from '@/src/features/balances/usdcConstants';
import type { ActivityItem } from './types';

function formatSolSigned(lamports: number, sign: '+' | '−' | ''): string {
  const sol = Math.abs(lamports) / LAMPORTS_PER_SOL;
  const raw = sol.toFixed(9).replace(/\.?0+$/, '');
  return sign ? `${sign}${raw} SOL` : `${raw} SOL`;
}

/** Signed amount string for list rows (+/− SOL or USDC). */
export function formatActivityAmount(item: ActivityItem): string | null {
  // Pure / labelled USDC rows — honest atomic + decimals=6.
  if (
    item.amountSymbol === 'USDC' &&
    item.tokenAmountAtomic != null &&
    /^\d+$/.test(item.tokenAmountAtomic)
  ) {
    const raw = formatAtomicDisplayAmount(item.tokenAmountAtomic, USDC_DECIMALS);
    if (item.kind === 'received') return `+${raw} USDC`;
    if (item.kind === 'sent') return `−${raw} USDC`;
    return `${raw} USDC`;
  }

  if (item.kind === 'swap') {
    if (item.signedLamports == null) return null;
    return formatSolSigned(
      item.signedLamports,
      item.signedLamports >= 0 ? '+' : '−',
    );
  }

  const lamports = item.amountLamports;
  if (lamports == null) {
    if (item.signedLamports == null) return null;
    if (item.kind === 'received' || item.signedLamports > 0) {
      return formatSolSigned(item.signedLamports, '+');
    }
    return formatSolSigned(item.signedLamports, '−');
  }

  if (item.kind === 'received') return formatSolSigned(lamports, '+');
  if (item.kind === 'sent') return formatSolSigned(lamports, '−');
  return formatSolSigned(lamports, '');
}

export function formatFeeSol(feeLamports: number | null | undefined, unavailableLabel: string = copy.activity.costUnavailable): string {
  if (!Number.isSafeInteger(feeLamports) || feeLamports == null || feeLamports <= 0) return unavailableLabel;
  const atomic = BigInt(feeLamports);
  const whole = atomic / 1_000_000_000n;
  const fraction = (atomic % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''} SOL`;
}
