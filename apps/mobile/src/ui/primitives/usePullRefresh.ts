import { useCallback, useEffect, useRef, useState } from 'react';

export function usePullRefresh(read: () => unknown): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const latest = useRef(read);
  latest.current = read;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    // One pull at a time: a pull while one is in flight is refused, so the
    // read runs once and only its own settle ends the spinner. The latch is
    // this instance's; a remount starts unlatched.
    if (inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    let pending: unknown;
    try {
      pending = latest.current();
    } catch {
      pending = undefined;
    }
    void Promise.resolve(pending)
      .catch(() => undefined)
      .finally(() => {
        inFlight.current = false;
        if (mounted.current) setRefreshing(false);
      });
  }, []);

  return { refreshing, onRefresh };
}
