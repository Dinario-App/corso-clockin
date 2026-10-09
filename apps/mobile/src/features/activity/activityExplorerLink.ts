import type { NetworkStatus, PublicAppConfig } from '@/src/lib/apiConfig';
import { solscanSignatureUrl } from '@/src/features/activity/solscanUrl';

/** Why the link cannot be built. Mirrors `NetworkStatus`'s unknown reasons. */
export type ActivityExplorerDeclineReason = Extract<
  NetworkStatus,
  { state: 'unknown' }
>['reason'];

export type ActivityExplorerGate =
  /** The config fetch has not settled. Not yet a link, and not yet a refusal. */
  | { state: 'resolving' }
  /** A network something actually stated. The link is honest. */
  | { state: 'ready'; cluster: PublicAppConfig['cluster'] }
  /** Asked and cannot say. No link may be built from a guess. */
  | { state: 'declined'; reason: ActivityExplorerDeclineReason };

/**
 * Decide whether the explorer link may be built, given the resolved network.
 *
 * ⚠️ `status === null` means "not resolved yet", matching the existing
 * `useState<NetworkStatus | null>(null)` convention on `swap.tsx`. An `unknown`
 * status is a *resolved* answer of "cannot say" and is therefore `declined`,
 * never `resolving`.
 */
export function resolveActivityExplorerGate(
  status: NetworkStatus | null,
): ActivityExplorerGate {
  if (status === null) return { state: 'resolving' };
  if (status.state === 'known') {
    return { state: 'ready', cluster: status.cluster };
  }
  return { state: 'declined', reason: status.reason };
}

export function activityExplorerUrl(args: {
  gate: ActivityExplorerGate;
  signature: string | null | undefined;
}): string | null {
  if (args.gate.state !== 'ready') return null;
  if (typeof args.signature !== 'string') return null;
  const signature = args.signature.trim();
  if (signature === '') return null;
  return solscanSignatureUrl(signature, args.gate.cluster);
}

/** How the "See it on Solscan" control renders for a given gate. */
export type ActivityExplorerCta = {
  /** Pressable only when a real network backs the link. */
  enabled: boolean;
  showNetworkUnknownNotice: boolean;
};

/**
 * Present the control for a gate.
 *
 * ⚠️ **The button stays mounted in all three states rather than disappearing.**
 * A control that vanishes and returns moves the Copy reference button under the
 * user's thumb between frames, on a screen whose other action copies a
 * transaction signature. Disabling holds the layout still.
 */
export function resolveActivityExplorerCta(
  gate: ActivityExplorerGate,
): ActivityExplorerCta {
  return {
    enabled: gate.state === 'ready',
    showNetworkUnknownNotice: gate.state === 'declined',
  };
}
