import { copy } from '@/constants/copy';
import type { SwapOrderResponse } from '@/src/features/swap/swapApi';
import {
  feeBpsToPercentLabel,
  formatAtomicAmount,
  resolveDisplayCorsoFeeBps,
} from '@/src/features/swap/tokens';

export type CommittedFeeQuote = Pick<
  SwapOrderResponse,
  'corsoFeeBps' | 'feeMint' | 'platformFeeAmount' | 'feeDropped'
>;

/** A token the review surface already knows: mint, symbol, decimals. */
export type CommittedFeeUnit = Readonly<{
  mint: string;
  symbol: string;
  decimals: number;
}>;

export type CommittedFeeDisplay =
  /** The quote's committed fee, verbatim, plus the unit if the mint is known. */
  | {
      kind: 'fee';
      /** `platformFeeAmount` exactly as the quote emitted it. */
      amountAtomic: string;
      feeMint: string;
      bps: number;
      unit: CommittedFeeUnit | null;
    }
  /** No frozen quote yet. Render the same `'…'` as Route. */
  | { kind: 'resolving' }
  /** Asked and cannot say: `feeDropped`, or no committed amount on the quote. */
  | { kind: 'unavailable' };

const ATOMIC_DIGITS = /^\d+$/;

/**
 * Select what the Review fee row shows from the frozen intent.
 *
 * ⚠️ Validated, not computed. A malformed amount fails closed to
 * `unavailable` rather than being repaired; a valid one is returned as the
 * identical string.
 */
export function selectCommittedFeeDisplay(
  order: CommittedFeeQuote | null | undefined,
  units: readonly CommittedFeeUnit[],
): CommittedFeeDisplay {
  if (order == null) return { kind: 'resolving' };
  if (order.feeDropped) return { kind: 'unavailable' };
  const amountAtomic = order.platformFeeAmount;
  if (amountAtomic == null || !ATOMIC_DIGITS.test(amountAtomic)) {
    return { kind: 'unavailable' };
  }
  const feeMint = order.feeMint;
  if (feeMint == null) return { kind: 'unavailable' };
  // `null` fallback: the config is never consulted once a quote exists.
  const bps = resolveDisplayCorsoFeeBps(order.corsoFeeBps, null);
  if (bps == null) return { kind: 'unavailable' };
  const unit = units.find((candidate) => candidate.mint === feeMint) ?? null;
  return { kind: 'fee', amountAtomic, feeMint, bps, unit };
}

/** Render the fee row value. Unknown unit shows the percent alone. */
export function formatCommittedFeeDisplayValue(
  display: CommittedFeeDisplay,
  includePercent = true,
): string {
  switch (display.kind) {
    case 'resolving':
      return '…';
    case 'unavailable':
      return copy.home.balancePlaceholder;
    case 'fee': {
      const percent = feeBpsToPercentLabel(display.bps);
      if (display.unit == null) return percent;
      const amount = formatAtomicAmount(
        display.amountAtomic,
        display.unit.decimals,
      );
      const amountWithUnit = `${amount} ${display.unit.symbol}`;
      return includePercent
        ? copy.swap.corsoFeeCommitted(amountWithUnit, percent)
        : amountWithUnit;
    }
  }
}
