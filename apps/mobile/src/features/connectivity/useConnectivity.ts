import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  isReconnectEdge,
  readConnectivity,
  readFailState,
  subscribeConnectivity,
  type Connectivity,
  type ReadFailState,
} from './connectivity';

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(
    subscribeConnectivity,
    readConnectivity,
    readConnectivity,
  );
}

/** A read's fail-closed state, deferred to the offline state when offline. */
export function useReadFailState(): ReadFailState {
  return readFailState(useConnectivity());
}

export function useOnReconnect(onReconnect: () => void): void {
  const connectivity = useConnectivity();
  const previous = useRef(connectivity);
  const latest = useRef(onReconnect);
  latest.current = onReconnect;
  useEffect(() => {
    const was = previous.current;
    previous.current = connectivity;
    if (isReconnectEdge(was, connectivity)) latest.current();
  }, [connectivity]);
}
