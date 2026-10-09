import { copy } from '@/constants/copy';
import type { NetworkStatus } from '@/src/lib/apiConfig';
import type { UsdcSendCluster } from '@/src/features/send/validateUsdcSend';

/** Why Send is refusing to compose. Mirrors `NetworkStatus`'s unknown reasons. */
export type SendNetworkDeclineReason = Extract<
  NetworkStatus,
  { state: 'unknown' }
>['reason'];

/**
 * What the Send sheet may do with the network it has.
 *
 * `resolving` is the pre-answer state and is deliberately distinct from
 * `declined`: an in-flight `/v1/config` is not a refusal, and showing the
 * decline screen for the 200ms before the first answer would be a lie.
 */
export type SendNetworkGate =
  | { state: 'resolving' }
  | { state: 'ready'; cluster: UsdcSendCluster }
  | {
      state: 'declined';
      reason: SendNetworkDeclineReason;
      title: string;
      body: string;
    };

export function resolveSendNetworkGate(
  status: NetworkStatus | null,
): SendNetworkGate {
  if (status === null) return { state: 'resolving' };
  if (status.state === 'known') {
    return { state: 'ready', cluster: status.cluster };
  }
  return {
    state: 'declined',
    reason: status.reason,
    title: copy.send.networkUnknownTitle,
    body: copy.send.networkUnknownBody,
  };
}

/**
 * The single predicate every compose/sign entry point in the sheet asks.
 *
 * Named rather than inlined for the same reason `clusterOrFallbackFromStatus` is
 * named: reaching the network-independent path should require saying so.
 */
export function sendMayComposeOnNetwork(gate: SendNetworkGate): boolean {
  return gate.state === 'ready';
}
