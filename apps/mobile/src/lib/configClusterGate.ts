import {
  clusterOrFallbackFromStatus,
  type NetworkStatus,
  type PublicAppConfig,
} from '@/src/lib/apiConfig';

/** Why a config-driven fetch cannot name a cluster. Mirrors `NetworkStatus`. */
export type ConfigClusterDeclineReason = Extract<
  NetworkStatus,
  { state: 'unknown' }
>['reason'];

export type ConfigClusterGate =
  /** Kill switch off. No request will be sent; `labelCluster` labels the
   *  disabled result and selects no mint. */
  | { state: 'disabled'; labelCluster: PublicAppConfig['cluster'] }
  /** Kill switch on and the network identity is known. Request this cluster. */
  | { state: 'ready'; cluster: PublicAppConfig['cluster'] }
  /** Kill switch on but no cluster was ever confirmed. Send nothing. */
  | { state: 'declined'; reason: ConfigClusterDeclineReason };

export function resolveConfigClusterGate(args: {
  enabled: boolean;
  network: NetworkStatus;
}): ConfigClusterGate {
  if (!args.enabled) {
    return {
      state: 'disabled',
      labelCluster: clusterOrFallbackFromStatus(args.network),
    };
  }
  if (args.network.state === 'known') {
    return { state: 'ready', cluster: args.network.cluster };
  }
  return { state: 'declined', reason: args.network.reason };
}

export function configFetchCluster(
  gate: Exclude<ConfigClusterGate, { state: 'declined' }>,
): PublicAppConfig['cluster'] {
  return gate.state === 'ready' ? gate.cluster : gate.labelCluster;
}

/**
 * Developer-facing text for a declined fetch.
 *
 * ⚠️ **Deliberately not in `constants/copy.ts`, because no user ever reads
 * it.** Both consumers of this string drop it. `usePriceQuotes` stores it as
 * `error`, and `useFiatTotal` — the only caller of that hook — returns
 * `quotes`, `priceStatus` and `refreshing` and never the message.
 * `useTokenFacts` exposes `error`, and `buildPickerFactsSubtitle` destructures
 * it and then renders `copy.tokenFacts.unavailable` off the `status` instead.
 * Adding a copy string would be adding a user-facing sentence that has no
 * surface to appear on. What the user sees is unchanged and is already owned by
 * existing copy.
 */
export function configClusterDeclineMessage(
  reason: ConfigClusterDeclineReason,
): string {
  return `Network identity unknown (${reason}); no cluster may be named.`;
}
