import { copy } from '@/constants/copy';
import { SwapApiError } from '@/src/features/swap/swapApi';

function providerSaysNoRoute(message: string): boolean {
  const normalized = message.toLowerCase().replace(/[_-]+/g, ' ');
  return (
    normalized.includes('no route') ||
    normalized.includes('route not found') ||
    normalized.includes('could not find any route') ||
    normalized.includes('not tradable')
  );
}

/** Quote-stage errors are product copy, never provider or parser internals. */
export function swapQuoteErrorMessage(error: unknown): string {
  if (!(error instanceof SwapApiError)) return copy.swap.errorQuote;
  if (
    error.code === 'swap_provider_error' &&
    providerSaysNoRoute(error.message)
  ) {
    return copy.swap.noRoute;
  }
  if (
    error.code === 'swap_provider_error' ||
    error.code === 'swap_quote_invalid'
  ) {
    return copy.swap.errorQuote;
  }
  return error.message || copy.swap.errorQuote;
}
