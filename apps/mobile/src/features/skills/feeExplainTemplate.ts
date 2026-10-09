import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { feeBpsToPercentLabel } from '@/src/features/swap/tokens';
import { TEMPLATE_IDS } from './templateIds';
import type {
  FeeExplainInput,
  FeeExplainLine,
  FeeExplainView,
} from './types';

const MAX_LINES = 3;

function isValidBps(value: number | null | undefined): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 10_000
  );
}

function isValidPriceImpactPct(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Bounded decimal string only — no scientific notation, no invent.
  return /^-?\d+(\.\d+)?$/.test(trimmed);
}

function formatNetworkFeeSol(lamports: number): string {
  const sol = lamports / LAMPORTS_PER_SOL;
  const raw = sol.toFixed(9).replace(/\.?0+$/, '');
  return raw;
}

/**
 * Resolve Corso fee bps for fee-explain display.
 * Prefer `corsoFeeBps`; do not invent 85 when all fee fields are missing.
 * When `feeDropped` is true, omit bps even if present.
 */
export function resolveExplainCorsoFeeBps(
  input: Pick<
    FeeExplainInput,
    'corsoFeeBps' | 'quoteFeeBps' | 'platformFeeBps' | 'feeDropped'
  >,
): number | null {
  if (input.feeDropped === true) return null;
  if (isValidBps(input.corsoFeeBps)) return input.corsoFeeBps;
  // Soft fallthrough only when Corso outer field absent but quote/platform agree.
  if (
    input.corsoFeeBps == null &&
    isValidBps(input.quoteFeeBps) &&
    isValidBps(input.platformFeeBps) &&
    input.quoteFeeBps === input.platformFeeBps
  ) {
    return input.quoteFeeBps;
  }
  return null;
}

/**
 * Compose fee-explainer lines from quote/fee/network rows.
 * Missing fields → omit line (never invent `$0.00`, 85 bps, or impact).
 */
export function composeFeeExplain(input: FeeExplainInput): FeeExplainView {
  const lines: FeeExplainLine[] = [];
  const feeDropped = input.feeDropped === true;
  const corsoFeeBps = resolveExplainCorsoFeeBps(input);

  if (feeDropped) {
    lines.push({
      templateId: TEMPLATE_IDS.FEE_DROPPED,
      text: 'A Corso fee could not be verified on this quote. Try again.',
    });
  } else if (corsoFeeBps != null && input.context === 'swap_review') {
    lines.push({
      templateId: TEMPLATE_IDS.FEE_CORSO_BPS,
      text: `Corso fee: ${feeBpsToPercentLabel(corsoFeeBps)} of this swap.`,
    });
  }

  if (
    input.context === 'swap_review' &&
    isValidPriceImpactPct(input.priceImpactPct)
  ) {
    lines.push({
      templateId: TEMPLATE_IDS.FEE_PRICE_IMPACT,
      text: `Price impact about ${input.priceImpactPct.trim()}%. Bigger swaps move the price more.`,
    });
  }

  if (
    typeof input.networkFeeLamports === 'number' &&
    Number.isFinite(input.networkFeeLamports) &&
    Number.isInteger(input.networkFeeLamports) &&
    input.networkFeeLamports >= 0
  ) {
    lines.push({
      templateId: TEMPLATE_IDS.FEE_NETWORK,
      text: `Network fee: ~${formatNetworkFeeSol(input.networkFeeLamports)} SOL.`,
    });
  }

  if (
    typeof input.solReserveLamports === 'number' &&
    Number.isFinite(input.solReserveLamports) &&
    Number.isInteger(input.solReserveLamports) &&
    input.solReserveLamports > 0 &&
    input.context === 'swap_review'
  ) {
    lines.push({
      templateId: TEMPLATE_IDS.FEE_SOL_RESERVE,
      text: 'Leave a little SOL for network fees and token accounts.',
    });
  }

  const capped = lines.slice(0, MAX_LINES);
  const templateId = capped[0]?.templateId ?? null;

  return {
    schemaVersion: 1,
    context: input.context,
    templateId,
    lines: capped,
    feeDropped,
    corsoFeeBps,
  };
}

export function composeCorsoFeeExplain(
  input: FeeExplainInput,
): FeeExplainLine[] {
  const view = composeFeeExplain({ ...input, context: 'swap_review' });
  const lines = view.lines.filter(
    (line) =>
      line.templateId === TEMPLATE_IDS.FEE_DROPPED ||
      line.templateId === TEMPLATE_IDS.FEE_CORSO_BPS,
  );
  if (!view.feeDropped && view.corsoFeeBps != null) {
    lines.push({
      templateId: TEMPLATE_IDS.FEE_CORSO_ON_TOP,
      text: "This is Corso's fee, on top of the route. It comes out of what you receive.",
    });
  }
  return lines;
}
