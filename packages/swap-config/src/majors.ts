type BookCluster = 'devnet' | 'mainnet-beta' | null;
const usdcMintForCluster = (cluster: Exclude<BookCluster, null>) =>
  cluster === 'devnet'
    ? '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
    : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

export type HoldingSection = 'cash' | 'major' | 'sleeve' | 'hidden';

export type MajorAsset = {
  mint: string;
  decimals: number;
  displayName: string;
  symbol: string;
  wrapperDisclosureKey:
    | 'majorDetail.wrapperCbBtc'
    | 'majorDetail.wrapperEthPortal'
    | 'majorDetail.wrapperZecOmniBridge'
    | null;
};

export type CashStablecoin = {
  mint: string;
  displayName: string;
  symbol: string;
};

export const CASH_STABLECOINS = [
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    displayName: 'Tether USD',
    symbol: 'USDT',
  },
  {
    mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
    displayName: 'PayPal USD',
    symbol: 'PYUSD',
  },
] as const satisfies readonly CashStablecoin[];

export const MAJOR_ASSETS = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
    displayName: 'Solana',
    symbol: 'SOL',
    wrapperDisclosureKey: null,
  },
  {
    mint: 'cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij',
    decimals: 8,
    displayName: 'Coinbase Wrapped Bitcoin',
    symbol: 'cbBTC',
    wrapperDisclosureKey: 'majorDetail.wrapperCbBtc',
  },
  {
    mint: '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
    decimals: 8,
    displayName: 'Ether (Portal)',
    symbol: 'ETH',
    wrapperDisclosureKey: 'majorDetail.wrapperEthPortal',
  },
  {
    mint: 'A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS',
    decimals: 8,
    displayName: 'Zcash (OmniBridge)',
    symbol: 'ZEC',
    wrapperDisclosureKey: 'majorDetail.wrapperZecOmniBridge',
  },
] as const satisfies readonly MajorAsset[];

const MAJOR_MINTS: ReadonlySet<string> = new Set(
  MAJOR_ASSETS.map((asset) => asset.mint),
);
const CASH_STABLECOIN_MINTS: ReadonlySet<string> = new Set(
  CASH_STABLECOINS.map((asset) => asset.mint),
);

/**
 * Assign one visible-book section to a holding.
 *
 * `includeInHomeTotal` is main's visibility boundary. It must win before token
 * identity so a hidden/spam line cannot re-enter through Cash or Majors.
 */
export function classifyHolding(
  line: { mint: string; includeInHomeTotal: boolean },
  cluster: BookCluster,
): HoldingSection {
  if (!line.includeInHomeTotal) return 'hidden';
  if (cluster !== null && line.mint === usdcMintForCluster(cluster)) {
    return 'cash';
  }
  if (cluster === 'mainnet-beta' && CASH_STABLECOIN_MINTS.has(line.mint)) {
    return 'cash';
  }
  if (MAJOR_MINTS.has(line.mint)) return 'major';
  return 'sleeve';
}

export function getMajorAsset(
  mint: string | null | undefined,
): MajorAsset | null {
  if (!mint) return null;
  return MAJOR_ASSETS.find((asset) => asset.mint === mint) ?? null;
}

export function isMajorMint(mint: string | null | undefined): boolean {
  return getMajorAsset(mint) != null;
}
