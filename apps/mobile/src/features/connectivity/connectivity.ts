import { copy } from '@/constants/copy';

/** `unknown` — no reading yet, or no NetInfo in this binary. Never `offline`. */
export type Connectivity = 'online' | 'offline' | 'unknown';

/** The two NetInfo fields this reads. Everything else on `NetInfoState` is ignored. */
export type NetStateLike = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
} | null;

/**
 * Offline only on a definite `isConnected === false`.
 *
 * ⛔ `isInternetReachable` is deliberately ignored. The reachability probe is
 * off (see `NETINFO_CONFIGURATION`), and with it off NetInfo reports
 * `isInternetReachable: false` on every *connected* radio
 * (`internetReachability.ts`: "don't run reachability check, just change the
 * state to false"). Reading it would pin the banner on every working phone.
 * A `null` connection is "not known yet", never offline.
 */
export function connectivityFromNetState(state: NetStateLike): Connectivity {
  if (!state) return 'unknown';
  if (state.isConnected === false) return 'offline';
  if (state.isConnected === true) return 'online';
  return 'unknown';
}

/**
 * ⛔ NO REACHABILITY PROBE. NetInfo's default fetches
 * `https://clients3.google.com/generate_204` on every foreground: an
 * undeclared third-party destination that sees the person's IP and timing
 * (outbound destination census, Play Data safety). Nor is it pointed at our own
 * API: that would turn "offline" into "Corso's API is down", which is a
 * different state with a different owner. The radio's own connected bit is
 * the whole signal.
 */
export const NETINFO_CONFIGURATION = {
  reachabilityShouldRun: () => false,
} as const;

/**
 * The deferral rule every read's fail-closed state goes through: when the
 * device is offline, the read's failure *is* the offline state, named once by
 * the app-level banner, and the read says so rather than claiming the source
 * is down. Online or unknown, the read keeps its own named state.
 */
export type ReadFailState = 'offline' | 'unavailable';

export function readFailState(connectivity: Connectivity): ReadFailState {
  return connectivity === 'offline' ? 'offline' : 'unavailable';
}

export function readFailLine(
  failState: ReadFailState | null | undefined,
  own: string,
): string {
  return failState === 'offline' ? copy.connectivity.offlineBanner : own;
}

export function isReconnectEdge(
  previous: Connectivity,
  next: Connectivity,
): boolean {
  return previous === 'offline' && next === 'online';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type Listener = () => void;

/** The subset of the NetInfo default export this uses. Injected in tests. */
export type NetInfoSource = {
  configure(configuration: typeof NETINFO_CONFIGURATION): void;
  addEventListener(listener: (state: NetStateLike) => void): () => void;
};

let current: Connectivity = 'unknown';
let stop: (() => void) | null = null;
const listeners = new Set<Listener>();

function set(next: Connectivity): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

export function readConnectivity(): Connectivity {
  return current;
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function loadNetInfo(): NetInfoSource | null {
  try {
    const mod = require('@react-native-community/netinfo') as {
      default?: NetInfoSource;
    };
    return mod.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Start watching. Idempotent: the root layout calls it once, and a second call
 * is a no-op. Returns `false` when no source could be attached (a binary
 * without the native module), in which case the state stays `unknown`.
 */
export function startConnectivityWatch(
  source: NetInfoSource | null = loadNetInfo(),
): boolean {
  if (stop) return true;
  if (!source) return false;
  try {
    // Before the first listener: NetInfo starts probing on subscribe.
    source.configure(NETINFO_CONFIGURATION);
    stop = source.addEventListener((state) => {
      set(connectivityFromNetState(state));
    });
    return true;
  } catch {
    stop = null;
    return false;
  }
}

/** @internal test-only */
export function __resetConnectivityForTests(): void {
  stop?.();
  stop = null;
  current = 'unknown';
  listeners.clear();
}
