import type { NetworkStatus } from '@/src/lib/apiConfig';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import type { MoneyTokenSymbol } from '@/src/features/money/moneySheetPresentation';
import { tokenForSymbol } from '@/src/features/swap/tokens';
import type { TokenFactsHookStatus } from '@/src/features/tokenFacts/types';

/** Why Money cannot name a mint. Mirrors `NetworkStatus`'s unknown reasons. */
export type MoneyNetworkDeclineReason = Extract<
  NetworkStatus,
  { state: 'unknown' }
>['reason'];

export type MoneyNetworkGate =
  | { state: 'resolving' }
  | { state: 'ready'; cluster: PriceCluster }
  | { state: 'declined'; reason: MoneyNetworkDeclineReason };

export function resolveMoneyNetworkGate(
  status: NetworkStatus | null,
): MoneyNetworkGate {
  if (status === null) return { state: 'resolving' };
  if (status.state === 'known') {
    return { state: 'ready', cluster: status.cluster };
  }
  return { state: 'declined', reason: status.reason };
}

export function resolveMoneyTokenMint(args: {
  gate: MoneyNetworkGate;
  symbol: MoneyTokenSymbol | null;
}): string | null {
  if (args.symbol == null) return null;
  if (args.gate.state !== 'ready') return null;
  return tokenForSymbol(args.symbol, args.gate.cluster).mint;
}

/**
 * The status the facts panel is built from, given the gate.
 *
 * ⚠️ **Needed because "no mint" and "no answer yet" render the same, and only
 * one of them is true.** A null mint leaves `useTokenFacts` at `idle`, and
 * `buildSwapReviewFactsPanel` banners `idle` as "Loading token details…". While
 * the gate is `resolving` that is accurate. Once it is `declined` it is not: the
 * network is not going to resolve itself on this mount, and a panel that says
 * "loading" forever tells the user to wait for something that is not coming.
 *
 * `unavailable` is the honest status and it is an existing member of
 * `TokenFactsHookStatus`, banners through `copy.tokenFacts.unavailable` —
 * "Token details unavailable" — and produces no rows. Not `error`: nothing
 * failed. The details are simply not available, which is exactly what the word
 * means. No new copy string.
 */
export function moneyFactsStatusForGate(args: {
  gate: MoneyNetworkGate;
  hookStatus: TokenFactsHookStatus;
}): TokenFactsHookStatus {
  return args.gate.state === 'declined' ? 'unavailable' : args.hookStatus;
}
