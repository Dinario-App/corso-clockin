import { copy } from '@/constants/copy';

export type ComposerDisclosureRow = {
  key: 'route' | 'price' | 'corsoFee' | 'priceImpact' | 'slippage';
  label: string;
  value: string;
};

/** Keeps the compact composer hierarchy complete and review-independent. */
export function buildComposerDisclosureRows(args: {
  route: string;
  price: string;
  corsoFee: string;
  priceImpact: string;
  slippage: string;
}): ComposerDisclosureRow[] {
  return [
    { key: 'route', label: copy.swap.route, value: args.route },
    { key: 'price', label: copy.swap.price, value: args.price },
    { key: 'corsoFee', label: copy.swap.corsoFee, value: args.corsoFee },
    {
      key: 'priceImpact',
      label: copy.swap.priceImpact,
      value: args.priceImpact,
    },
    { key: 'slippage', label: copy.swap.slippage, value: args.slippage },
  ];
}
