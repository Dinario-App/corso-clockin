import { copy } from '@/constants/copy';
import type { SwapReceiveQuoteStatus } from './swapReceiveDisplay';

export type ComposerDisclosureRow = {
  key: 'price' | 'corsoFee' | 'priceImpact' | 'slippage';
  label: string;
  value: string;
};

/** Keeps the compact composer hierarchy complete and review-independent. */
export function buildComposerDisclosureRows(args: {
  quoteStatus: SwapReceiveQuoteStatus;
  price: string;
  corsoFee: string;
  priceImpact: string;
  slippage: string;
}): ComposerDisclosureRow[] {
  return [
    ...(args.quoteStatus === 'ready'
      ? [{ key: 'price' as const, label: copy.swap.price, value: args.price }]
      : []),
    { key: 'corsoFee', label: copy.swap.corsoFee, value: args.corsoFee },
    {
      key: 'priceImpact',
      label: copy.swap.priceImpact,
      value: args.priceImpact,
    },
    { key: 'slippage', label: copy.swap.slippage, value: args.slippage },
  ];
}
