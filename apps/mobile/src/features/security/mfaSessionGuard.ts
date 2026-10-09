export type PendingMfaHandle = {
  /** Session key at the moment MFA was requested (`type:address`). */
  sessionKey: string;
  resolve: () => void;
  reject: (error: Error) => void;
};

export function sessionIdentityKey(
  session: { type: string; address: string } | null | undefined,
): string | null {
  if (!session?.type || !session?.address) return null;
  return `${session.type}:${session.address}`;
}

/**
 * On active session-key change, cancel provider MFA and reject the pending
 * wallet operation immediately. Returns null (pending cleared).
 * Same key / no pending → no-op (returns pending unchanged).
 */
export function cancelPendingOnSessionKeyChange(args: {
  pending: PendingMfaHandle | null;
  nextSessionKey: string | null;
  cancelProvider?: () => void;
  reason?: string;
}): PendingMfaHandle | null {
  const { pending, nextSessionKey } = args;
  if (!pending) return null;
  if (pending.sessionKey === nextSessionKey) return pending;

  try {
    args.cancelProvider?.();
  } catch {
    // provider cancel is best-effort; local reject always runs
  }
  pending.reject(
    new Error(
      args.reason ?? 'MFA cancelled: active session changed during step-up',
    ),
  );
  return null;
}

/**
 * After successful factor verification: resolve only if the same session key
 * is still active. Otherwise reject (fail closed) and clear pending.
 */
export function resolvePendingIfSameSession(args: {
  pending: PendingMfaHandle | null;
  currentSessionKey: string | null;
  cancelProvider?: () => void;
}): { ok: boolean; pending: null } {
  const { pending, currentSessionKey } = args;
  if (!pending) return { ok: false, pending: null };

  if (!currentSessionKey || pending.sessionKey !== currentSessionKey) {
    try {
      args.cancelProvider?.();
    } catch {
      // best-effort
    }
    pending.reject(
      new Error(
        'MFA cancelled: session changed during factor verification',
      ),
    );
    return { ok: false, pending: null };
  }

  pending.resolve();
  return { ok: true, pending: null };
}

export type OwnerFactorCompleteResult = {
  ok: boolean;
  pendingRejected: boolean;
  shouldMark: boolean;
  pending: null;
};

export function ownerAcceptFactorCompletion(args: {
  pending: PendingMfaHandle | null;
  /** Session key the sheet claims the completed factor belongs to. */
  completedSessionKey: string | null;
  /** Currently active session key when the owner decides. */
  currentSessionKey: string | null;
  cancelProvider?: () => void;
}): OwnerFactorCompleteResult {
  const { pending, completedSessionKey, currentSessionKey } = args;

  if (!pending) {
    return {
      ok: false,
      pendingRejected: false,
      shouldMark: false,
      pending: null,
    };
  }

  const same =
    Boolean(completedSessionKey) &&
    Boolean(currentSessionKey) &&
    pending.sessionKey === completedSessionKey &&
    pending.sessionKey === currentSessionKey;

  if (!same) {
    try {
      args.cancelProvider?.();
    } catch {
      // best-effort
    }
    pending.reject(
      new Error(
        'MFA cancelled: session changed during factor verification',
      ),
    );
    return {
      ok: false,
      pendingRejected: true,
      shouldMark: false,
      pending: null,
    };
  }

  pending.resolve();
  return {
    ok: true,
    pendingRejected: false,
    shouldMark: true,
    pending: null,
  };
}

/**
 * Whether a completed verify may mark cache / allow sign for `startedKey`
 * given the currently bound active session key.
 */
export function mayCompleteVerifyForSession(args: {
  startedSessionKey: string;
  activeSessionKey: string | null;
}): boolean {
  return (
    Boolean(args.activeSessionKey) &&
    args.startedSessionKey === args.activeSessionKey
  );
}

/**
 * Live active-session identity is authoritative at owner decision time.
 *
 * Bound / prepare session may lag until effects flush (session A pending +
 * render with B). Never prefer bound over live when live is present — that
 * was the pre-effect A→B source failure in useStepUpConfirm.
 */
export function authoritativeSessionKey(
  liveSession: { type: string; address: string } | null | undefined,
  boundSession?: { type: string; address: string } | null | undefined,
): string | null {
  const live = sessionIdentityKey(liveSession);
  if (live) return live;
  // No live identity → fail closed (do not invent from bound alone for mark).
  // Callers that still need a bound key for sheet reporting use sessionIdentityKey(bound).
  void boundSession;
  return null;
}

export type LocalStepUpOwnerDecision = {
  result: OwnerFactorCompleteResult;
  /** Live session only — never the lagging bound prepare identity. */
  markSession: { type: string; address: string } | null;
  shouldClearCache: boolean;
};

/**
 * Models useStepUpConfirm.onVerified owner path without React.
 *
 * Pre-effect race: pending started under A, render already has live B,
 * sessionRef/bound still A, late factor reports completed=A → reject,
 * never mark B (or A), clear cache.
 */
export function decideLocalStepUpOwnerCompletion(args: {
  pending: PendingMfaHandle | null;
  completedSessionKey: string | null;
  /** Live Corso session during the render that produced this decision. */
  liveSession: { type: string; address: string } | null | undefined;
  /**
   * Bound prepare/bind session (may still be A after live switched to B).
   * Must not win over live for currentKey or mark target.
   */
  boundSession?: { type: string; address: string } | null | undefined;
  cancelProvider?: () => void;
}): LocalStepUpOwnerDecision {
  // Live only — bound is intentionally ignored for authority (may be stale A).
  const currentSessionKey = authoritativeSessionKey(
    args.liveSession,
    args.boundSession,
  );

  const result = ownerAcceptFactorCompletion({
    pending: args.pending,
    completedSessionKey: args.completedSessionKey,
    currentSessionKey,
    cancelProvider: args.cancelProvider,
  });

  const liveKey = sessionIdentityKey(args.liveSession);
  const canMark =
    result.shouldMark &&
    Boolean(args.liveSession) &&
    liveKey != null &&
    liveKey === args.completedSessionKey &&
    args.completedSessionKey === currentSessionKey;

  const markSession = canMark && args.liveSession ? args.liveSession : null;

  const shouldClearCache =
    result.pendingRejected ||
    (args.completedSessionKey != null &&
      args.completedSessionKey !== currentSessionKey);

  return { result, markSession, shouldClearCache };
}
