import {
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
  usdcMintForCluster,
} from '@/src/features/swap/tokens';

/** Circle USDC decimals on Solana — reject any other decimals claim. */
export const USDC_DECIMALS = 6;

export { USDC_MINT_MAINNET, USDC_MINT_DEVNET, usdcMintForCluster };

/** True when mint is in the bounded native-USDC set (mainnet or known Circle devnet). */
export function isBoundedUsdcMint(mint: string): boolean {
  return mint === USDC_MINT_MAINNET || mint === USDC_MINT_DEVNET;
}
