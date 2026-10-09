import { formatPriceUsd } from '@/src/ui/format/numberCraft';

/**
 * Significant digits kept below one cent. Four is enough to separate the
 * memecoin prices that differ in the fifth place, and short enough that the
 * price column stays one line beside a symbol and a percentage.
 */
/**
 * `184.22` → `$184.22`, `0.00001234` → `$0.00001234`, unparseable → null.
 *
 * `null` rather than a placeholder string, because the honesty rule is exact:
 * a row that cannot show a price does not become a row with "Not available" in
 * it, it stops the whole strip. The caller decides that; this function only
 * reports that it could not.
 */
export function formatMovingPrice(priceUsd: string): string | null {
  return formatPriceUsd(priceUsd);
}
