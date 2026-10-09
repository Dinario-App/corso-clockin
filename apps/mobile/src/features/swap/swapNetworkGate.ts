import { copy } from '@/constants/copy';
import type { NetworkStatus } from '@/src/lib/apiConfig';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';

/** Why Swap is refusing to trade. Mirrors `NetworkStatus`'s unknown reasons. */
export type SwapNetworkDeclineReason = Extract<
  NetworkStatus,
  { state: 'unknown' }
>['reason'];

/**
 * What the Swap screen may do with the network it has.
 *
 * Deliberately the same three states as `SendNetworkGate`, including the
 * `resolving` / `declined` split: an in-flight `/v1/config` is not a refusal,
 * and showing the decline screen for the 200ms before the first answer would be
 * a lie.
 */
export type SwapNetworkGate =
  | { state: 'resolving' }
  | { state: 'ready'; cluster: PriceCluster }
  | {
      state: 'declined';
      reason: SwapNetworkDeclineReason;
      title: string;
      body: string;
    };

export function resolveSwapNetworkGate(
  status: NetworkStatus | null,
): SwapNetworkGate {
  if (status === null) return { state: 'resolving' };
  if (status.state === 'known') {
    return { state: 'ready', cluster: status.cluster };
  }
  return {
    state: 'declined',
    reason: status.reason,
    title: copy.swap.networkUnknownTitle,
    body: copy.swap.networkUnknown,
  };
}

/**
 * The single predicate every mint-selecting entry point on the screen asks.
 *
 * Named rather than inlined for the same reason `clusterOrFallbackFromStatus` is
 * named: reaching the network-independent path should require saying so.
 *
 * ⚠️ Named for *quoting*, not signing, because quoting is where the mint is
 * first committed to. `requestSwapOrder` sends `inputMint`/`outputMint` to the
 * API, and everything downstream — the digest, the frozen review intent, the
 * order the signer is handed — is bound to the mints the quote was taken on. A
 * gate that only guarded the confirm button would let a devnet quote be built,
 * displayed and reviewed, and would be relying on `submitSwap` to catch it,
 * which is the arrangement this change exists to end.
 */
export function swapMayQuoteOnNetwork(gate: SwapNetworkGate): boolean {
  return gate.state === 'ready';
}
