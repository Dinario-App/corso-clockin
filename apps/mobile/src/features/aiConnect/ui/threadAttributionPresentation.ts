import { copy } from '@/constants/copy';

export type TurnAttributionSnapshot = {
  name: string;
  /** Null = persisted without a clock. Never fabricate `0.1s`. */
  elapsedMs: number | null;
};

let askStartedAtMs: number | null = null;
let askLandedAtMs: number | null = null;
let clockOrigin: string | null = null;
const snapshots = new Map<string, TurnAttributionSnapshot>();

function disarmAskClock(): void {
  askStartedAtMs = null;
  askLandedAtMs = null;
  clockOrigin = null;
}

/** True only when this card took a turn after the current ask started. */
function turnLandedDuringAsk(updatedAtMs: number | undefined): boolean {
  return (
    askStartedAtMs != null &&
    typeof updatedAtMs === 'number' &&
    Number.isFinite(updatedAtMs) &&
    updatedAtMs >= askStartedAtMs
  );
}

export function noteComposerBusy(
  busy: boolean,
  nowMs = Date.now(),
  origin?: string,
): void {
  const who = origin ?? 'anon';
  if (busy) {
    clockOrigin = who;
    askStartedAtMs = nowMs;
    askLandedAtMs = null;
    return;
  }
  if (clockOrigin != null && origin != null && origin !== clockOrigin) {
    return;
  }
  if (askStartedAtMs != null && askLandedAtMs == null) {
    askLandedAtMs = nowMs;
  }
}

export function readAskElapsedMs(nowMs = Date.now()): number {
  if (askStartedAtMs == null) return 0;
  return (askLandedAtMs ?? nowMs) - askStartedAtMs;
}

export function lastCoachTurnId(
  thread: readonly { id: string; role: string }[] | undefined,
): string | null {
  if (thread == null || thread.length === 0) return null;
  for (let i = thread.length - 1; i >= 0; i--) {
    if (thread[i]!.role === 'coach') return thread[i]!.id;
  }
  return null;
}

export function readTurnAttribution(
  turnId: string,
): TurnAttributionSnapshot | undefined {
  return snapshots.get(turnId);
}

export function captureTurnAttribution(
  turnId: string | null,
  nowMs = Date.now(),
): void {
  if (turnId == null || turnId.length === 0) return;
  if (snapshots.has(turnId)) return;
  if (askStartedAtMs == null) return;
  snapshots.set(turnId, {
    name: copy.ai.accountRow.corso,
    elapsedMs: readAskElapsedMs(nowMs),
  });
  disarmAskClock();
}

export function readDisplayedAttribution(
  turnId: string | null,
  nowMs = Date.now(),
  updatedAtMs?: number,
): string | null {
  const landedThisAsk = turnLandedDuringAsk(updatedAtMs);
  if (askStartedAtMs != null && askLandedAtMs != null && !landedThisAsk) {
    // swapChoices / refusal / error / cancel: clock landed with no coach
    // turn on this card. Drop it so a later restored id cannot inherit it.
    disarmAskClock();
  } else if (turnId && !snapshots.has(turnId) && landedThisAsk) {
    captureTurnAttribution(turnId, nowMs);
  }
  if (askStartedAtMs != null && askLandedAtMs == null) {
    return resolveThreadAttribution({
      name: copy.ai.accountRow.corso,
      elapsedMs: readAskElapsedMs(nowMs),
    });
  }
  const snap = turnId ? snapshots.get(turnId) : undefined;
  if (snap) {
    if (snap.elapsedMs == null) return null;
    return resolveThreadAttribution({
      name: snap.name,
      elapsedMs: snap.elapsedMs,
    });
  }
  return null;
}

export function __resetAskElapsedForTests(): void {
  disarmAskClock();
  snapshots.clear();
}

export function formatAttributionElapsed(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const tenths = Math.max(1, Math.round(safe / 100));
  return `${(tenths / 10).toFixed(1)}s`;
}

export function resolveThreadAttribution(input: {
  name: string;
  elapsedMs: number;
}): string {
  return copy.ai.thread.attribution(
    input.name,
    formatAttributionElapsed(input.elapsedMs),
  );
}
