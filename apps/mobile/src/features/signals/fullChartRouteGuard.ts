import { useEffect, useState } from 'react';
import {
  resolveTokenVitalsConfig,
  type TokenVitalsConfig,
} from '@/src/lib/apiConfig';

export type FullChartConfig = TokenVitalsConfig;

/** `true` only for an explicit, mainnet-known, flag-on config. Anything else is `false`. */
export function resolveFullChartRouteGuard(
  config: TokenVitalsConfig | null | undefined,
): boolean {
  if (!config) return false;
  if (config.tokenVitalsEnabled !== true) return false;
  if (config.network.state !== 'known') return false;
  return config.network.cluster === 'mainnet-beta';
}

/**
 * Router guard for the full-chart route. Starts closed; opens only after the
 * public config says so. One coalesced `GET /v1/config` per mount.
 */
export function useFullChartRouteGuard(
  resolveConfig: () => Promise<TokenVitalsConfig> = resolveTokenVitalsConfig,
): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    resolveConfig()
      .then((config) => {
        if (!cancelled) setEnabled(resolveFullChartRouteGuard(config));
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
