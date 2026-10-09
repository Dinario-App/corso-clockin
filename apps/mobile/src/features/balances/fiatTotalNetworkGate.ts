import type { NetworkStatus } from '@/src/lib/apiConfig';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';

/** Why the fiat book cannot name a mint. Mirrors `NetworkStatus`'s reasons. */
export type FiatTotalNetworkDeclineReason = Extract<
  NetworkStatus,
  { state: 'unknown' }
>['reason'];

export type FiatTotalNetworkGate =
  | { state: 'resolving' }
  | { state: 'ready'; cluster: PriceCluster }
  | { state: 'declined'; reason: FiatTotalNetworkDeclineReason };

export function resolveFiatTotalNetworkGate(
  status: NetworkStatus | null,
): FiatTotalNetworkGate {
  if (status === null) return { state: 'resolving' };
  if (status.state === 'known') {
    return { state: 'ready', cluster: status.cluster };
  }
  return { state: 'declined', reason: status.reason };
}

export function resolveFiatHoldingsCluster(
  gate: FiatTotalNetworkGate,
): PriceCluster | null {
  return gate.state === 'ready' ? gate.cluster : null;
}

export function resolveFiatTotalCluster(args: {
  override?: PriceCluster;
  status: NetworkStatus | null;
}): PriceCluster | null {
  return (
    args.override ??
    resolveFiatHoldingsCluster(resolveFiatTotalNetworkGate(args.status))
  );
}
