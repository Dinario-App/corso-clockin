import { copy } from '@/constants/copy';
import { MAJOR_ASSETS, type MajorAsset } from '@/src/features/balances/majors';
import {
  majorConsumerName,
  majorWrapperLine,
} from '@/src/features/balances/majorNames';
import { resolveAcquireAccess } from '@/src/features/security/acquireAccessPresentation';
import type { JurisdictionGateInputs } from '@/src/features/security/jurisdictionGateInputs';
import {
  buildAssetSwapActions,
  type AssetSwapAction,
} from '@/src/features/swap/assetPrefill';
import { usdcMintForCluster } from '@/src/features/swap/tokens';
import {
  isCuratedMint,
  type CuratedBook,
} from '@/src/features/universe/curatedBook';

export type WealthPick = Readonly<{
  key: string;
  mint: string;
  symbol: string;
  name: string;
  /** The ticker line: USDC, or the major's wrapper line or symbol. */
  sub: string;
  href: AssetSwapAction['href'];
}>;

function isWealthPick(asset: MajorAsset): boolean {
  return (
    asset.symbol === 'SOL' || asset.symbol === 'cbBTC' || asset.symbol === 'ZEC'
  );
}

export function presentWealthPicks(args: {
  /** The resolved network. Unknown draws no pick: a mint is never guessed. */
  cluster: 'devnet' | 'mainnet-beta' | null;
  gateInputs: JurisdictionGateInputs | null;
  book: CuratedBook;
}): WealthPick[] {
  const { cluster } = args;
  if (cluster === null) return [];
  const candidates = [
    {
      mint: usdcMintForCluster(cluster),
      symbol: 'USDC',
      decimals: 6,
      name: copy.homeBook.cash,
      sub: 'USDC',
    },
    ...MAJOR_ASSETS.filter(isWealthPick).map((asset) => ({
      mint: asset.mint,
      symbol: asset.symbol,
      decimals: asset.decimals,
      name:
        asset.symbol === 'ZEC'
          ? copy.wealthV1.firstRun.pickZec.name
          : majorConsumerName(asset),
      sub:
        asset.symbol === 'ZEC'
          ? copy.wealthV1.firstRun.pickZec.wrapper
          : (majorWrapperLine(asset.symbol) ?? asset.symbol),
    })),
  ];
  const picks: WealthPick[] = [];
  for (const candidate of candidates) {
    const buy = buildAssetSwapActions({
      mint: candidate.mint,
      symbol: candidate.symbol,
      decimals: candidate.decimals,
      cluster,
      acquireAccess: resolveAcquireAccess({
        gateInputs: args.gateInputs,
        mint: candidate.mint,
        symbol: candidate.symbol,
        name: candidate.name,
      }),
      curated: isCuratedMint(args.book, candidate.mint),
    }).find((action) => action.direction === 'buy');
    if (!buy) continue;
    picks.push({
      key: candidate.symbol,
      mint: candidate.mint,
      symbol: candidate.symbol,
      name: candidate.name,
      sub: candidate.sub,
      href: buy.href,
    });
  }
  return picks;
}
