import { useCallback, useEffect, useRef, useState } from 'react';
import { itemsAfterFailedRead } from './activityLoadOutcome';
import { fetchWalletActivity } from './fetchActivity';
import type { ActivityItem } from './types';

export type ActivityLoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: ActivityItem[];
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

type ActivityFeed = Pick<ActivityLoadState, 'status' | 'items' | 'error'>;

export type HeldActivityFeed = ActivityFeed & { address: string | null };

const NO_ITEMS: ActivityItem[] = [];

export const EMPTY_ACTIVITY_FEED: HeldActivityFeed = {
  address: null,
  status: 'idle',
  items: NO_ITEMS,
  error: null,
};

export function activityFeedForAddress(
  held: HeldActivityFeed,
  address: string | undefined,
): ActivityFeed {
  const active = address ?? null;
  if (held.address === active) {
    return { status: held.status, items: held.items, error: held.error };
  }
  return {
    status: active === null ? 'idle' : 'loading',
    items: NO_ITEMS,
    error: null,
  };
}

export function useWalletActivity(address: string | undefined): ActivityLoadState {
  const [held, setHeld] = useState<HeldActivityFeed>(EMPTY_ACTIVITY_FEED);
  const [refreshing, setRefreshing] = useState(false);
  const latestReadRef = useRef(0);

  const load = useCallback(
    async (isRefresh: boolean) => {
      const read = ++latestReadRef.current;
      if (!address) {
        setHeld(EMPTY_ACTIVITY_FEED);
        setRefreshing(false);
        return;
      }

      setRefreshing(isRefresh);
      if (!isRefresh) {
        // A first read for this address starts from that address's loading
        // frame; a held feed for the same address is left as it is.
        setHeld((prev) =>
          prev.address === address
            ? prev
            : { address, ...activityFeedForAddress(prev, address) },
        );
      }

      try {
        const next = await fetchWalletActivity(address);
        if (read !== latestReadRef.current) return;
        setHeld({ address, status: 'ready', items: next, error: null });
      } catch (err) {
        if (read !== latestReadRef.current) return;
        setHeld((prev) => ({
          address,
          status: 'error',
          items: itemsAfterFailedRead({
            held: prev.items,
            heldFor: prev.address,
            address,
          }),
          error:
            err instanceof Error
              ? err.message
              : "Couldn't load activity. Pull to retry.",
        }));
      } finally {
        if (read === latestReadRef.current) setRefreshing(false);
      }
    },
    [address],
  );

  useEffect(() => {
    void load(false);
    return () => {
      // An address change or unmount makes every read in flight obsolete.
      latestReadRef.current += 1;
    };
  }, [load]);

  const feed = activityFeedForAddress(held, address);
  return {
    status: feed.status,
    items: feed.items,
    error: feed.error,
    refreshing,
    refresh: () => load(true),
  };
}
