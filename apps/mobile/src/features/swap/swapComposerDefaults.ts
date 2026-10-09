import type { SwapTokenSymbol } from './tokens';

export const SWAP_COMPOSER_DEFAULTS: Readonly<{
  paySymbol: SwapTokenSymbol;
  receiveSymbol: SwapTokenSymbol;
  amount: string;
}> = {
  paySymbol: 'SOL',
  receiveSymbol: 'USDC',
  amount: '',
};
