import { copy } from '@/constants/copy';
import { formatAtomicDisplayAmount } from '@/src/features/swap/tokens';

export type SwapReceiveQuoteStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The receive figure is numeric only when a live quote supplied it.
 * Idle, failed, and structurally incomplete ready states reuse the existing
 * unavailable placeholder; loading keeps the existing progress ellipsis.
 */
export function resolveSwapReceiveDisplay(input: {
  quoteStatus: SwapReceiveQuoteStatus;
  outAmount: string | null | undefined;
  receiveDecimals: number;
}): string {
  if (input.quoteStatus === 'loading') return '…';
  if (input.quoteStatus !== 'ready' || input.outAmount == null) {
    return copy.home.balancePlaceholder;
  }
  return formatAtomicDisplayAmount(input.outAmount, input.receiveDecimals);
}

export function resolveSwapReceiveTone(input: {
  quoteStatus: SwapReceiveQuoteStatus;
  outAmount: string | null | undefined;
}): 'figure' | 'placeholder' {
  if (input.quoteStatus !== 'ready' || input.outAmount == null) {
    return 'placeholder';
  }
  return 'figure';
}
