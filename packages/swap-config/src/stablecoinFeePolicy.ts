export const FEE_WAIVER_STABLECOIN_MINTS = Object.freeze([
  // Circle USDC, Solana mainnet.
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  // Tether USDt, Solana mainnet.
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  // Paxos PayPal USD (PYUSD), Solana mainnet: https://docs.paxos.com/guides/stablecoin/pyusd/mainnet
  '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
] as const);

const feeWaiverStablecoinMints = new Set<string>(FEE_WAIVER_STABLECOIN_MINTS);

export function isFeeWaivedStablecoinMint(mint: string): boolean {
  return feeWaiverStablecoinMints.has(mint);
}

export function isStablecoinToStablecoinSwap(args: {
  inputMint: string;
  outputMint: string;
}): boolean {
  return (
    isFeeWaivedStablecoinMint(args.inputMint) &&
    isFeeWaivedStablecoinMint(args.outputMint)
  );
}

export function feeBpsForSwapPair(args: {
  inputMint: string;
  outputMint: string;
  configuredFeeBps: number;
}): number {
  return isStablecoinToStablecoinSwap(args) ? 0 : args.configuredFeeBps;
}
