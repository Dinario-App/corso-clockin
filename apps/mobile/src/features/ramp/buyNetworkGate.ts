import { copy } from '@/constants/copy';
import type { NetworkStatus } from '@/src/lib/apiConfig';
import type { BuyGateInputs } from '@/src/features/ramp/buyGateContinue';

/** Why Buy is refusing to compose. Mirrors `NetworkStatus`'s unknown reasons. */
export type BuyNetworkDeclineReason = Extract<
  NetworkStatus,
  { state: 'unknown' }
>['reason'];

export type BuyNetworkGate =
  | { state: 'resolving' }
  | { state: 'ready'; cluster: BuyGateInputs['cluster'] }
  | {
      state: 'declined';
      reason: BuyNetworkDeclineReason;
      title: string;
      body: string;
    };

export function resolveBuyNetworkGate(
  status: NetworkStatus | null,
): BuyNetworkGate {
  if (status === null) return { state: 'resolving' };
  if (status.state === 'known') {
    return { state: 'ready', cluster: status.cluster };
  }
  return {
    state: 'declined',
    reason: status.reason,
    title: copy.buy.networkUnknownTitle,
    body: copy.buy.networkUnknownBody,
  };
}

export function buyMayContinueOnNetwork(
  gate: BuyNetworkGate,
): gate is Extract<BuyNetworkGate, { state: 'ready' }> {
  return gate.state === 'ready';
}
