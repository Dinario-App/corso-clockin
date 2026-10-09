import type { WhyResponse } from '@corso/why';
import { useEffect, useState } from 'react';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import { fetchWhy, type WhyClientSurface } from './whyClient';

/**
 * What a why read has produced: `off` (the launch dock flag is off, so no
 * request was sent, or the engine answered `disabled`), `loading`, or the
 * settled response (`null` = the read failed).
 */
export type WhyRead = 'off' | 'loading' | WhyResponse | null;

/**
 * One read per mount and per mint set. No polling and no cache: a why line
 * that *was* true is not shown as one that is.
 */
export function useWhy(
  surface: WhyClientSurface,
  mints: readonly string[],
): WhyRead {
  const enabled = readLaunchDockBuildFlag();
  const key = mints.join(',');
  const [read, setRead] = useState<WhyRead>(enabled ? 'loading' : 'off');

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the mint set; `mints` is re-created each render
  useEffect(() => {
    if (!enabled || key.length === 0) {
      setRead('off');
      return;
    }
    setRead('loading');
    const controller = new AbortController();
    let live = true;
    void fetchWhy({
      enabled,
      surface,
      mints: key.split(','),
      signal: controller.signal,
    }).then((response) => {
      if (!live) return;
      setRead(response?.state === 'disabled' ? 'off' : response);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [enabled, surface, key]);

  return read;
}
