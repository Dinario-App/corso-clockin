import type { HoldingsBook } from '@/src/features/balances/holdingsBook';
import type { SessionType } from '@/src/features/session/types';
import {
  buildAssetSwapActions,
  type AssetSwapHref,
} from '@/src/features/swap/assetPrefill';
import { resolveHeldSellDoor } from '@/src/features/swap/heldSellDoor';
import { ACQUIRE_ACCESS_UNKNOWN } from '@/src/features/security/acquireAccessPresentation';
import type { TokenFactsResponse } from '@/src/features/tokenFacts/types';

export type SleeveSellChoice =
  | { kind: 'door'; href: AssetSwapHref }
  | { kind: 'error'; message: string }
  | { kind: 'absent' };

export function resolveSleeveSell(args: {
  mint: string;
  symbol: string;
  decimals: number;
  cluster: 'devnet' | 'mainnet-beta';
  walletType: SessionType | null;
  book: HoldingsBook;
  facts: TokenFactsResponse | null;
}): SleeveSellChoice {
  const heldSell = resolveHeldSellDoor({
    mint: args.mint,
    cluster: args.cluster,
    walletType: args.walletType,
    book: args.book,
    facts: args.facts,
  });
  if (heldSell.kind === 'withheld') {
    return { kind: 'error', message: heldSell.note };
  }
  const action = buildAssetSwapActions({
    mint: args.mint,
    symbol: args.symbol,
    decimals: args.decimals,
    cluster: args.cluster,
    heldSell,
    // Sell only: the Buy answer is not read here and not used.
    acquireAccess: ACQUIRE_ACCESS_UNKNOWN,
  }).find((item) => item.direction === 'sell');
  if (!action) return { kind: 'absent' };
  return { kind: 'door', href: action.href };
}

/** Opens the existing sell href. Nothing else is pushed. */
export function commitSleeveSell(
  choice: SleeveSellChoice,
  navigate: (href: AssetSwapHref) => void,
): void {
  if (choice.kind !== 'door') return;
  navigate(choice.href);
}
