import { SwapApiError } from '@/src/features/swap/swapApi';

export function assertOrderFeeIntegrity(order: {
  feeDropped: boolean;
}): void {
  if (order.feeDropped) {
    throw new SwapApiError(
      'swap_fee_dropped',
      'Corso fee could not be verified on this quote. Try again later.',
    );
  }
}
