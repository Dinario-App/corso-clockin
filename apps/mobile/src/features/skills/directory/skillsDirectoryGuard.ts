import { useEffect, useState } from 'react';
import {
  resolveAutopilotEnabled,
  resolveNetworkStatus,
  resolveSkillsEnabled,
  type NetworkStatus,
} from '@/src/lib/apiConfig';
import { readSkillsBuildFlag } from './skillsEnv';

export type SkillsDirectoryConfig = {
  /** Inlined `EXPO_PUBLIC_FLAG_SKILLS`. */
  buildFlag: boolean;
  /** Explicit boolean from public config; never inferred true on outage. */
  skillsEnabled: boolean;
  /**
   * Whether the arming hand-off door may exist (`flags.autopilotEnabled`).
   * The directory itself does not depend on it; only the last step does.
   */
  autopilotEnabled: boolean;
  network: NetworkStatus;
};

/** `true` only when both flags are explicitly on, on known mainnet-beta. */
export function resolveSkillsDirectoryGuard(
  config: SkillsDirectoryConfig | null | undefined,
): boolean {
  if (!config) return false;
  if (config.buildFlag !== true) return false;
  if (config.skillsEnabled !== true) return false;
  if (config.network.state !== 'known') return false;
  return config.network.cluster === 'mainnet-beta';
}

/** One coalesced `GET /v1/config` (the resolvers share the in-flight read). */
export async function resolveSkillsDirectoryConfig(): Promise<SkillsDirectoryConfig> {
  const buildFlag = readSkillsBuildFlag();
  const [skillsEnabled, autopilotEnabled, network] = await Promise.all([
    resolveSkillsEnabled(),
    resolveAutopilotEnabled(),
    resolveNetworkStatus(),
  ]);
  return { buildFlag, skillsEnabled, autopilotEnabled, network };
}

/** Convenience for surfaces that only need the boolean (Money's rail chip). */
export async function resolveSkillsDirectoryEnabled(): Promise<boolean> {
  try {
    return resolveSkillsDirectoryGuard(await resolveSkillsDirectoryConfig());
  } catch {
    return false;
  }
}

/**
 * Router guard for the skills lane. Starts closed; opens only after the
 * public config says so and the build flag agrees.
 */
export function useSkillsDirectoryRouteGuard(
  resolveConfig: () => Promise<SkillsDirectoryConfig> = resolveSkillsDirectoryConfig,
): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    resolveConfig()
      .then((config) => {
        if (!cancelled) setEnabled(resolveSkillsDirectoryGuard(config));
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
 * Screen-level defense in depth: every skills screen re-reads the gate on
 * mount and paints the off body if it is not served. Same shape as the hook
 * above but exposes the full config so the configure screen can also learn
 * whether the arming door exists.
 */
export function useSkillsDirectoryConfig(
  resolveConfig: () => Promise<SkillsDirectoryConfig> = resolveSkillsDirectoryConfig,
): {
  status: 'loading' | 'ready';
  config: SkillsDirectoryConfig | null;
  enabled: boolean;
} {
  const [state, setState] = useState<{
    status: 'loading' | 'ready';
    config: SkillsDirectoryConfig | null;
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
    enabled: resolveSkillsDirectoryGuard(state.config),
  };
}
