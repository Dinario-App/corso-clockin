import {
  resolveDiscoveryConfig,
  type DiscoveryConfig,
} from '@/src/lib/apiConfig';

export function resolveDiscoveryRouteGuard(
  config: DiscoveryConfig | null | undefined,
): boolean {
  if (!config) return false;
  if (config.discoveryEnabled !== true) return false;
  if (config.network.state !== 'known') return false;
  return config.network.cluster === 'mainnet-beta';
}

export type DiscoveryGate = 'on' | 'off' | 'unreadable';

export function resolveDiscoveryGate(
  config: DiscoveryConfig | null | undefined,
): DiscoveryGate {
  if (!config) return 'unreadable';
  if (config.configReachable === false) return 'unreadable';
  return resolveDiscoveryRouteGuard(config) ? 'on' : 'off';
}

/** Convenience for the Money rail chip. */
export async function resolveDiscoveryEnabled(): Promise<boolean> {
  try {
    return resolveDiscoveryRouteGuard(await resolveDiscoveryConfig());
  } catch {
    return false;
  }
}
