/**
 * Display formatting for fiat totals — separate from compute so locale can evolve.
 * Unknown / loading / unavailable never render as `$0.00`.
 */
import type { FiatTotalStatus } from './computeFiatTotal';
import { formatFiatAmount } from '@/src/ui/format/numberCraft';

const DEFAULT_PLACEHOLDER = 'Not available';

/**
 * Format a computed fiat total for display.
 * Known zero (`status: 'zero'`) may render `$0.00`.
 * Null / unavailable / loading always use the placeholder — never invent `$0.00`.
 */
export function formatFiatTotal(
  amount: string | null,
  status: FiatTotalStatus,
  placeholder: string = DEFAULT_PLACEHOLDER,
): string {
  if (status === 'loading' || status === 'unavailable') {
    return placeholder;
  }

  if (status === 'zero') {
    return '$0.00';
  }

  // fully_priced | partially_priced — only render when amount is present.
  if (amount === null || amount === '') {
    return placeholder;
  }

  return formatFiatAmount(amount) ?? placeholder;
}
