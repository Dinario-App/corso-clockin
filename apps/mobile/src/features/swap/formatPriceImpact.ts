import { copy } from '@/constants/copy';
import type { SwapRiskLeg } from '@/src/features/swap/swapRiskLeg';

const PRICE_IMPACT_DISPLAY = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Display-only projection of the exact provider string. The frozen intent keeps
 * and compares the original bytes; UI rows get a bounded value that cannot wrap
 * sixty decimal places or turn a real non-zero impact into numeric zero.
 */
function formatPriceImpactPercent(
  priceImpactPct: string | null | undefined,
): string | null {
  if (priceImpactPct == null) return null;
  const impact = Number(priceImpactPct);
  if (!Number.isFinite(impact)) return null;
  if (impact > 0 && impact < 0.01) return '<0.01%';
  if (impact < 0 && impact > -0.01) return '>-0.01%';
  return `${PRICE_IMPACT_DISPLAY.format(impact)}%`;
}

/** Route-card impact clause on Review (e.g. `0.01% impact`). */
export function formatSwapReviewImpact(
  priceImpactPct: string | null | undefined,
): string {
  const display = formatPriceImpactPercent(priceImpactPct);
  return display != null ? `${display} impact` : copy.swap.priceImpactUnknown;
}

/** Price impact row value on compose/review rows. */
export function formatSwapPriceImpactValue(
  priceImpactPct: string | null | undefined,
): string {
  return formatPriceImpactPercent(priceImpactPct) ?? copy.swap.priceImpactUnknown;
}

export function formatSwapReviewPriceImpact(
  priceImpactPct: string | null | undefined,
  subjectLeg: SwapRiskLeg = 'receive',
): string {
  const display = formatPriceImpactPercent(priceImpactPct);
  if (display == null) return copy.swap.priceImpactUnknown;
  const impact = Number(priceImpactPct);
  if (impact > 1) {
    const thinness =
      subjectLeg === 'pay'
        ? "There isn't much demand for this token right now."
        : "There isn't much of this token to buy.";
    return `This trade moves the price about ${display}. ${thinness}`;
  }
  return display;
}
