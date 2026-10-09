import type { HoldingsSnapshot } from '@/src/features/balances/computeFiatTotal';
import { BOUNDED_RAMP_ASSETS, type RampAsset } from './rampAssets';

export const RAMP_RETURN_REFRESH_DELAYS_MS: readonly number[] = [
  3_000, 6_000, 12_000, 24_000, 45_000, 60_000,
];
export const RAMP_RETURN_REFRESH_LIMIT_MS = 10 * 60_000;

export type RampReturnHint = {
  walletAddress: string;
  /** Null when the return carried no checkout (a cold callback). */
  asset: RampAsset | null;
};

export type RampReturnRefreshOutcome =
  | 'running'
  | 'arrived'
  | 'timed_out'
  | 'cancelled';

type TimerHandle = unknown;

export type RampReturnRefreshDeps = {
  refresh: () => Promise<void> | void;
  /** Atomic quantity of `asset` now held by the hinted wallet; null when unread. */
  readQuantity: (asset: RampAsset) => bigint | null;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  delaysMs?: readonly number[];
  limitMs?: number;
};

export type RampReturnRefreshRun = {
  cancel: () => void;
  outcome: () => RampReturnRefreshOutcome;
};

export function startRampReturnRefresh(
  asset: RampAsset | null,
  deps: RampReturnRefreshDeps,
): RampReturnRefreshRun {
  const now = deps.now ?? Date.now;
  const setTimer =
    deps.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
  const clearTimer =
    deps.clearTimer ??
    ((handle: TimerHandle) =>
      clearTimeout(handle as ReturnType<typeof setTimeout>));
  const delays =
    deps.delaysMs && deps.delaysMs.length > 0
      ? deps.delaysMs
      : RAMP_RETURN_REFRESH_DELAYS_MS;
  const limitMs = deps.limitMs ?? RAMP_RETURN_REFRESH_LIMIT_MS;
  const tracked = asset ? [asset] : BOUNDED_RAMP_ASSETS;
  const startedAt = now();
  // An unread baseline adopts the first read value; it never counts as arrival.
  const baseline = new Map<RampAsset, bigint | null>(
    tracked.map((a) => [a, deps.readQuantity(a)]),
  );
  let outcome: RampReturnRefreshOutcome = 'running';
  let timer: TimerHandle | null = null;

  const arrived = () =>
    tracked.some((a) => {
      const current = deps.readQuantity(a);
      const before = baseline.get(a) ?? null;
      if (current === null) return false;
      if (before === null) {
        baseline.set(a, current);
        return false;
      }
      return current > before;
    });

  const read = () => {
    try {
      void Promise.resolve(deps.refresh()).catch(() => undefined);
    } catch {
      /* A failed read is retried by the next attempt; it never ends the run. */
    }
  };

  const schedule = (attempt: number) => {
    const remaining = limitMs - (now() - startedAt);
    // The last timer lands on the deadline, never past it.
    const delay = Math.min(delays[Math.min(attempt, delays.length - 1)]!, remaining);
    timer = setTimer(() => {
      timer = null;
      if (outcome !== 'running') return;
      if (arrived()) {
        outcome = 'arrived';
        return;
      }
      if (now() - startedAt >= limitMs) {
        outcome = 'timed_out';
        return;
      }
      read();
      schedule(attempt + 1);
    }, delay);
  };

  read();
  schedule(0);

  return {
    cancel: () => {
      if (outcome === 'running') outcome = 'cancelled';
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    outcome: () => outcome,
  };
}

/** Atomic quantity of a ramp asset in a ready book for `walletAddress`; else null. */
export function rampAssetAtomic(
  holdings: HoldingsSnapshot | null,
  walletAddress: string,
  asset: RampAsset,
): bigint | null {
  if (
    holdings?.quantityStatus !== 'ready' ||
    holdings.address !== walletAddress
  )
    return null;
  let total = 0n;
  for (const line of holdings.lines) {
    if (line.symbol !== asset || !/^\d+$/.test(line.atomic)) continue;
    total += BigInt(line.atomic);
  }
  return total;
}

export type RampReturnHintSource = {
  onReturnHint: (listener: (hint: RampReturnHint) => void) => () => void;
};

/**
 * Subscribe a wallet's book to return hints. One run per wallet at a time: a
 * second hint while a run is live (the callback route after the sheet already
 * settled) does not restart the clock. The returned disposer unsubscribes and
 * cancels the live run.
 */
export function bindRampReturnRefresh(
  source: RampReturnHintSource,
  args: Omit<RampReturnRefreshDeps, 'readQuantity'> & {
    walletAddress: string | null | undefined;
    readQuantity: (walletAddress: string, asset: RampAsset) => bigint | null;
  },
): () => void {
  const walletAddress = args.walletAddress;
  if (!walletAddress) return () => undefined;
  let run: RampReturnRefreshRun | null = null;
  let disposed = false;
  const unsubscribe = source.onReturnHint((hint) => {
    if (disposed || hint.walletAddress !== walletAddress) return;
    if (run?.outcome() === 'running') return;
    run = startRampReturnRefresh(hint.asset, {
      ...args,
      readQuantity: (asset) => args.readQuantity(walletAddress, asset),
    });
  });
  return () => {
    disposed = true;
    unsubscribe();
    run?.cancel();
    run = null;
  };
}
