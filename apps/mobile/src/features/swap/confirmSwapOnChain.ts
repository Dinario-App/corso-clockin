/**
 * #7 — Honest swap success: independent chain confirmation after provider Success.
 * Provider "Success" alone must not unlock swap_succeeded UI.
 */

/** UI/analytics gate: both provider Success and on-chain confirm required. */
export function mayEmitSwapSucceeded(args: {
  providerSuccess: boolean;
  onChainConfirmed: boolean;
}): boolean {
  return args.providerSuccess === true && args.onChainConfirmed === true;
}

export type SignatureStatusSnapshot = {
  err: unknown | null;
  confirmationStatus?: string | null;
  confirmations?: number | null;
};

export type ConfirmSwapOnChainResult =
  | { ok: true; signature: string; confirmationStatus: 'confirmed' | 'finalized' }
  | { ok: false; signature: string; reason: 'failed' | 'timeout' | 'invalid_signature' };

export const DEFAULT_SWAP_CONFIRM_TIMEOUT_MS = 60_000;
export const DEFAULT_SWAP_CONFIRM_POLL_MS = 400;

/** Pure: whether a polled signature status counts as chain-confirmed success. */
export function isSwapConfirmedOnChain(
  status: SignatureStatusSnapshot | null | undefined,
): status is SignatureStatusSnapshot & {
  confirmationStatus: 'confirmed' | 'finalized';
} {
  if (!status) return false;
  if (status.err != null) return false;
  const c = status.confirmationStatus;
  return c === 'confirmed' || c === 'finalized';
}

/** Pure: chain reported a failure for this signature. */
export function isSwapFailedOnChain(
  status: SignatureStatusSnapshot | null | undefined,
): boolean {
  if (!status) return false;
  return status.err != null;
}

/**
 * Pure balance-delta check (optional second honesty signal).
 * Requires pre/post readings from the same account; nulls fail closed.
 */
export function balanceDeltaConfirmsSwap(args: {
  preAtomic: bigint | null | undefined;
  postAtomic: bigint | null | undefined;
  /** Minimum absolute change expected (e.g. otherAmountThreshold for output). */
  minAbsDelta: bigint;
  direction: 'increase' | 'decrease';
}): boolean {
  if (args.preAtomic == null || args.postAtomic == null) return false;
  if (args.minAbsDelta < 0n) return false;
  const delta = args.postAtomic - args.preAtomic;
  if (args.direction === 'increase') {
    return delta >= args.minAbsDelta;
  }
  return delta <= -args.minAbsDelta;
}

export function decideSwapConfirmPoll(args: {
  status: SignatureStatusSnapshot | null | undefined;
  nowMs: number;
  deadlineMs: number;
  lastValidBlockHeight?: number | null;
  currentBlockHeight?: number | null;
}): 'confirmed' | 'failed' | 'expired' | 'pending' {
  if (isSwapFailedOnChain(args.status)) return 'failed';
  if (isSwapConfirmedOnChain(args.status)) return 'confirmed';
  if (
    args.lastValidBlockHeight != null &&
    args.currentBlockHeight != null &&
    args.currentBlockHeight > args.lastValidBlockHeight
  ) {
    return 'expired';
  }
  if (args.nowMs >= args.deadlineMs) return 'expired';
  return 'pending';
}

function isNonEmptySignature(signature: string): boolean {
  return typeof signature === 'string' && signature.trim().length >= 32;
}

/**
 * Minimal RPC surface for confirmation polling.
 * Callers may pass web3.js Connection via structural typing / thin wrappers.
 */
export type StatusConnection = {
  getSignatureStatuses: (
    signatures: string[],
    config?: { searchTransactionHistory: boolean },
  ) => Promise<{
    value: ReadonlyArray<{
      err: unknown;
      confirmationStatus?: string | null;
      confirmations?: number | null;
    } | null>;
  }>;
  getBlockHeight?: (commitment?: 'processed' | 'confirmed' | 'finalized') => Promise<number>;
};

type DeadlineOutcome<T> =
  | { kind: 'resolved'; value: T }
  | { kind: 'rejected'; error: unknown }
  | { kind: 'timeout' };

/**
 * Settle one async operation within the loop's remaining budget.
 * Both handlers remain attached after timeout so a late rejection is handled.
 */
function settleBeforeDeadline<T>(
  start: () => Promise<T>,
  remainingMs: number,
): Promise<DeadlineOutcome<T>> {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return Promise.resolve({ kind: 'timeout' });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ kind: 'timeout' });
    }, remainingMs);

    let operation: Promise<T>;
    try {
      operation = start();
    } catch (error) {
      settled = true;
      clearTimeout(timer);
      resolve({ kind: 'rejected', error });
      return;
    }

    operation.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ kind: 'resolved', value });
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ kind: 'rejected', error });
      },
    );
  });
}

/**
 * Poll RPC until confirmed/finalized, failed, block height expiry, or timeout.
 * Fail-closed: timeout / expiry / invalid signature → not ok.
 */
export async function confirmSwapOnChain(args: {
  connection: StatusConnection;
  signature: string;
  lastValidBlockHeight?: number | null;
  timeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ConfirmSwapOnChainResult> {
  const signature = args.signature?.trim() ?? '';
  if (!isNonEmptySignature(signature)) {
    return { ok: false, signature, reason: 'invalid_signature' };
  }

  const timeoutMs = args.timeoutMs ?? DEFAULT_SWAP_CONFIRM_TIMEOUT_MS;
  const pollMs = args.pollMs ?? DEFAULT_SWAP_CONFIRM_POLL_MS;
  const now = args.now ?? (() => Date.now());
  const sleep =
    args.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadlineMs = now() + timeoutMs;
  const conn = args.connection;

  // Immediate poll, then wait.
  for (;;) {
    let status: SignatureStatusSnapshot | null = null;
    const statusOutcome = await settleBeforeDeadline(
      () =>
        conn.getSignatureStatuses([signature], {
          searchTransactionHistory: true,
        }),
      deadlineMs - now(),
    );
    if (statusOutcome.kind === 'timeout' || now() >= deadlineMs) {
      return { ok: false, signature, reason: 'timeout' };
    }
    if (statusOutcome.kind === 'resolved') {
      const raw = statusOutcome.value.value[0] ?? null;
      status = raw
        ? {
            err: raw.err,
            confirmationStatus: raw.confirmationStatus,
            confirmations: raw.confirmations,
          }
        : null;
    }

    if (isSwapFailedOnChain(status)) {
      return { ok: false, signature, reason: 'failed' };
    }
    if (isSwapConfirmedOnChain(status)) {
      return {
        ok: true,
        signature,
        confirmationStatus: status.confirmationStatus,
      };
    }

    let currentBlockHeight: number | null = null;
    if (
      args.lastValidBlockHeight != null &&
      typeof conn.getBlockHeight === 'function'
    ) {
      const heightOutcome = await settleBeforeDeadline(
        () => conn.getBlockHeight!('confirmed'),
        deadlineMs - now(),
      );
      if (heightOutcome.kind === 'timeout' || now() >= deadlineMs) {
        return { ok: false, signature, reason: 'timeout' };
      }
      if (heightOutcome.kind === 'resolved') {
        currentBlockHeight = heightOutcome.value;
      }
    }

    const decision = decideSwapConfirmPoll({
      status,
      nowMs: now(),
      deadlineMs,
      lastValidBlockHeight: args.lastValidBlockHeight,
      currentBlockHeight,
    });

    if (decision === 'expired') {
      return { ok: false, signature, reason: 'timeout' };
    }

    const sleepOutcome = await settleBeforeDeadline(
      () => sleep(pollMs),
      deadlineMs - now(),
    );
    if (sleepOutcome.kind === 'timeout') {
      return { ok: false, signature, reason: 'timeout' };
    }
    if (sleepOutcome.kind === 'rejected') {
      throw sleepOutcome.error;
    }
  }
}
