import { useEffect, useState } from 'react';
import {
  resolveBotsEnabled,
  resolveNetworkStatus,
  type NetworkStatus,
} from '@/src/lib/apiConfig';
import { readBotsBuildFlag } from './botsEnv';

export type BotsConfig = {
  /** Inlined `EXPO_PUBLIC_FLAG_BOTS`. */
  buildFlag: boolean;
  /** Explicit `botsEnabled && autopilotEnabled` from public config; never inferred true on outage. */
  botsEnabled: boolean;
  network: NetworkStatus;
};

export function resolveBotsGuard(
  _config: BotsConfig | null | undefined,
): boolean {
  return false;
}

/** One coalesced `GET /v1/config` (the resolvers share the in-flight read). */
export async function resolveBotsConfig(): Promise<BotsConfig> {
  const buildFlag = readBotsBuildFlag();
  const [botsEnabled, network] = await Promise.all([
    resolveBotsEnabled(),
    resolveNetworkStatus(),
  ]);
  return { buildFlag, botsEnabled, network };
}

/** Convenience for surfaces that only need the boolean (Money's rail chip). */
export async function resolveBotsLaneEnabled(): Promise<boolean> {
  try {
    return resolveBotsGuard(await resolveBotsConfig());
  } catch {
    return false;
  }
}

/** Router guard for the lane. Starts closed; opens only after config says so. */
export function useBotsRouteGuard(
  resolveConfig: () => Promise<BotsConfig> = resolveBotsConfig,
): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    resolveConfig()
      .then((config) => {
        if (!cancelled) setEnabled(resolveBotsGuard(config));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolveConfig]);
  return enabled;
}

/**
 * Screen-level defense in depth: every screen in the lane re-reads the gate
 * on mount and paints the honest off body if it is not served.
 */
export function useBotsConfig(
  resolveConfig: () => Promise<BotsConfig> = resolveBotsConfig,
): {
  status: 'loading' | 'ready';
  config: BotsConfig | null;
  enabled: boolean;
} {
  const [state, setState] = useState<{
    status: 'loading' | 'ready';
    config: BotsConfig | null;
  }>({ status: 'loading', config: null });
  useEffect(() => {
    let cancelled = false;
    resolveConfig()
      .then((config) => {
        if (!cancelled) setState({ status: 'ready', config });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'ready', config: null });
      });
    return () => {
      cancelled = true;
    };
  }, [resolveConfig]);
  return {
    status: state.status,
    config: state.config,
    enabled: resolveBotsGuard(state.config),
  };
}
