import { copy } from '@/constants/copy';
import {
  atomicToFiatMinor,
  formatFiatMinor,
  parseDecimalPrice,
  type PriceQuote,
  type PriceQuoteMap,
} from '@/src/features/balances/computeFiatTotal';
import { USDC_DECIMALS } from '@/src/features/balances/usdcConstants';
import { formatClosedBarStamp } from '@/src/features/home/asOfPresentation';
import { SOL_MINT } from '@/src/features/swap/tokens';
import { groupDecimalDigits } from '@/src/ui/format/numberCraft';
import type { ActivityItem } from './types';

const SOL_DECIMALS = 9;

type Amount = { mint: string; atomic: bigint; decimals: number };

/** The amount `formatActivityAmount` prints, as atomic units of one mint. */
function rowAmount(item: ActivityItem): Amount | null {
  if (item.status === 'failed') return null;
  if (
    item.amountSymbol === 'USDC' &&
    item.tokenAmountAtomic != null &&
    /^\d+$/.test(item.tokenAmountAtomic)
  ) {
    if (!item.tokenMint) return null;
    return {
      mint: item.tokenMint,
      atomic: BigInt(item.tokenAmountAtomic),
      decimals: USDC_DECIMALS,
    };
  }
  const lamports =
    item.kind === 'swap'
      ? item.signedLamports
      : (item.amountLamports ?? item.signedLamports);
  if (lamports == null || !Number.isSafeInteger(lamports)) return null;
  return {
    mint: SOL_MINT,
    atomic: BigInt(Math.abs(lamports)),
    decimals: SOL_DECIMALS,
  };
}

/** A quote for exactly this mint, well-formed and inside its own max age. */
export function freshQuote(
  quote: PriceQuote | null | undefined,
  mint: string,
  nowMs: number,
): PriceQuote | null {
  if (!quote || quote.mint !== mint) return null;
  if (!Number.isFinite(quote.asOfMs) || !Number.isFinite(quote.maxAgeMs)) {
    return null;
  }
  if (nowMs - quote.asOfMs > quote.maxAgeMs) return null;
  return parseDecimalPrice(quote.price) ? quote : null;
}

/** `$1,234.56` from cents. */
export function formatUsdMinor(minor: bigint): string {
  const [whole, cents] = formatFiatMinor(minor).split('.');
  return `$${groupDecimalDigits(whole)}.${cents}`;
}

/** `≈ $340.00`, or `null` when this row has no amount or no fresh price. */
export function activityRowFiatText(
  item: ActivityItem,
  quotes: PriceQuoteMap | undefined,
  nowMs: number,
): string | null {
  const amount = rowAmount(item);
  if (!amount) return null;
  const quote = freshQuote(quotes?.[amount.mint], amount.mint, nowMs);
  const price = quote ? parseDecimalPrice(quote.price) : null;
  if (!price) return null;
  const minor = atomicToFiatMinor(amount.atomic, amount.decimals, price);
  return minor === null ? null : `≈ ${formatUsdMinor(minor)}`;
}

/**
 * The list's one dating line. `Values as of 15:15` (the oldest price used),
 * `Values unavailable` when rows have amounts but nothing could be priced,
 * and `null` while prices are still loading or no row has an amount.
 */
export function activityValuesLine(
  items: readonly ActivityItem[],
  quotes: PriceQuoteMap | undefined,
  pricesSettled: boolean,
  nowMs: number,
): string | null {
  let oldest: number | null = null;
  let withAmount = 0;
  for (const item of items) {
    const amount = rowAmount(item);
    if (!amount) continue;
    withAmount += 1;
    const quote = freshQuote(quotes?.[amount.mint], amount.mint, nowMs);
    if (!quote) continue;
    oldest = oldest === null ? quote.asOfMs : Math.min(oldest, quote.asOfMs);
  }
  if (withAmount === 0) return null;
  if (oldest !== null) {
    const stamp = formatClosedBarStamp(oldest, nowMs);
    if (stamp) return copy.activity.valuesAsOf(stamp);
  }
  return pricesSettled ? copy.activity.valuesUnavailable : null;
}
