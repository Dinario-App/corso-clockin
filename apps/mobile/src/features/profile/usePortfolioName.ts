import { useEffect, useState } from 'react';
import {
  cachedPortfolioNameRead,
  readPortfolioNameGuarded,
  subscribePortfolioName,
  type PortfolioNameReader,
} from '@/src/features/onboarding/portfolioNameStore';


export { resolveAccountDisplayName } from './accountDisplayName';

/**
 * `undefined` while the first read of the session is in flight or has failed,
 * so a caller holds the slot rather than painting the default over a saved
 * name.
 */
export function usePortfolioName(
  storage?: PortfolioNameReader,
): string | null | undefined {
  const [name, setName] = useState<string | null | undefined>(
    cachedPortfolioNameRead,
  );

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribePortfolioName((next) => {
      if (!cancelled) setName(next);
    });
    void readPortfolioNameGuarded(storage).then((result) => {
      // `superseded`: the newer value already arrived through the channel.
      // `failed`: keep the pending slot; a failed read is not "nothing saved".
      if (!cancelled && result.status === 'read') setName(result.name);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [storage]);

  return name;
}
