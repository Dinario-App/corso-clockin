import AsyncStorage from '@react-native-async-storage/async-storage';

export const AI_CONNECT_NUDGE_STORAGE_KEY = 'corso.aiNudge.v1';
const VERSION = 1;

export type AiConnectNudgeStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type AiConnectNudgeState = {
  hydrated: boolean;
  dismissed: boolean;
  answeredCount: number;
  countedTurnIds: readonly string[];
  earnedTurnId: string | null;
  /** Persisted. Once true, a later launch does not re-show the earned nudge. */
  shown: boolean;
  firstAnsweredAt: string | null;
  /** Session-only. Lets the earned nudge stay up on the turn that first rendered it. */
  shownThisSessionTurnId: string | null;
  /** Session-only. A failed disk read skips the earned nudge and every persist. */
  readFailed: boolean;
  /** Session-only. Null = the tail has not been used this process. */
  rateLimitBoundTurnId: string | null;
};

const EMPTY: AiConnectNudgeState = Object.freeze({
  hydrated: false,
  dismissed: false,
  answeredCount: 0,
  countedTurnIds: Object.freeze([]) as readonly string[],
  earnedTurnId: null,
  shown: false,
  firstAnsweredAt: null,
  shownThisSessionTurnId: null,
  readFailed: false,
  rateLimitBoundTurnId: null,
});

const COUNTED_IDS_MAX = 32;

let state: AiConnectNudgeState = EMPTY;
const listeners = new Set<() => void>();
let hydration: Promise<void> | null = null;
let boundStorage: AiConnectNudgeStorage = AsyncStorage;
let generation = 0;

function rec(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : null;
}

function count(value: unknown): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 10_000
    ? value
    : 0;
}

/** ISO-8601 instant (`Date.toISOString()`). Anything else is never-answered. */
function isoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 20 || value.length > 30) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    return null;
  }
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const id = text(entry, 200);
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= COUNTED_IDS_MAX) break;
  }
  return ids;
}

type ParsedAiConnectNudge = {
  dismissed: boolean;
  answeredCount: number;
  countedTurnIds: string[];
  earnedTurnId: string | null;
  shown: boolean;
  firstAnsweredAt: string | null;
};

function parseNudge(raw: unknown): ParsedAiConnectNudge {
  const fallback: ParsedAiConnectNudge = {
    dismissed: false,
    answeredCount: 0,
    countedTurnIds: [],
    earnedTurnId: null,
    shown: false,
    firstAnsweredAt: null,
  };
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  const body = rec(parsed);
  if (!body || body.v !== VERSION) return fallback;
  const countedTurnIds = parseIds(body.countedTurnIds);
  return {
    dismissed: body.dismissed === true,
    answeredCount: Math.max(count(body.answeredCount), countedTurnIds.length),
    countedTurnIds,
    earnedTurnId: text(body.earnedTurnId, 200),
    shown: body.shown === true,
    firstAnsweredAt: isoTimestamp(body.firstAnsweredAt),
  };
}

export function parseAiConnectNudge(raw: unknown): {
  dismissed: boolean;
  answeredCount: number;
  countedTurnIds: string[];
  earnedTurnId: string | null;
  shown: boolean;
} {
  const parsed = parseNudge(raw);
  return {
    dismissed: parsed.dismissed,
    answeredCount: parsed.answeredCount,
    countedTurnIds: parsed.countedTurnIds,
    earnedTurnId: parsed.earnedTurnId,
    shown: parsed.shown,
  };
}

function serialize(next: AiConnectNudgeState): string {
  return JSON.stringify({
    v: VERSION,
    dismissed: next.dismissed,
    answeredCount: next.answeredCount,
    countedTurnIds: next.countedTurnIds,
    earnedTurnId: next.earnedTurnId,
    shown: next.shown,
    ...(next.firstAnsweredAt != null
      ? { firstAnsweredAt: next.firstAnsweredAt }
      : {}),
  });
}

function emit(): void {
  for (const listener of listeners) listener();
}

function write(next: AiConnectNudgeState): void {
  if (next === state) return;
  state = next;
  emit();
}

function uniqueIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= COUNTED_IDS_MAX) break;
  }
  return out;
}

function persist(next: AiConnectNudgeState): void {
  if (next.readFailed || state.readFailed) return;
  void boundStorage
    .setItem(AI_CONNECT_NUDGE_STORAGE_KEY, serialize(next))
    .catch(() => {
      // In-memory state is still right for this session.
    });
}

export function readAiConnectNudge(): AiConnectNudgeState {
  return state;
}

export function subscribeAiConnectNudge(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hydrateAiConnectNudge(
  storage: AiConnectNudgeStorage = boundStorage,
): Promise<void> {
  boundStorage = storage;
  if (state.hydrated) return Promise.resolve();
  if (hydration) return hydration;
  const epoch = generation;
  const read = storage
    .getItem(AI_CONNECT_NUDGE_STORAGE_KEY)
    .then((raw) => {
      if (epoch !== generation) return;
      const disk = parseNudge(raw);
      const sessionBound = state.rateLimitBoundTurnId;
      const countedTurnIds = uniqueIds([
        ...disk.countedTurnIds,
        ...state.countedTurnIds,
      ]);
      write({
        hydrated: true,
        dismissed: disk.dismissed || state.dismissed,
        answeredCount: Math.max(
          disk.answeredCount,
          state.answeredCount,
          countedTurnIds.length,
        ),
        countedTurnIds,
        earnedTurnId: state.earnedTurnId ?? disk.earnedTurnId,
        shown: disk.shown || state.shown,
        firstAnsweredAt: state.firstAnsweredAt ?? disk.firstAnsweredAt,
        shownThisSessionTurnId: state.shownThisSessionTurnId,
        readFailed: false,
        rateLimitBoundTurnId: sessionBound,
      });
    })
    .catch(() => {
      if (epoch !== generation) return;
      write({ ...state, hydrated: true, readFailed: true });
    })
    .finally(() => {
      if (hydration === read) hydration = null;
    });
  hydration = read;
  return read;
}

export function noteFirstAnsweredAsk(
  deps: { storage?: AiConnectNudgeStorage; at?: string } = {},
): void {
  if (!state.hydrated || state.readFailed) return;
  if (state.firstAnsweredAt != null) return;
  if (deps.storage) boundStorage = deps.storage;
  const at = isoTimestamp(deps.at) ?? new Date().toISOString();
  const next: AiConnectNudgeState = { ...state, firstAnsweredAt: at };
  write(next);
  persist(next);
}

export function noteEligibleAnsweredTurn(
  turnId: string,
  deps: { storage?: AiConnectNudgeStorage } = {},
): void {
  if (turnId.length === 0) return;
  if (state.countedTurnIds.includes(turnId)) return;
  if (deps.storage) boundStorage = deps.storage;
  const countedTurnIds = uniqueIds([...state.countedTurnIds, turnId]);
  const answeredCount = countedTurnIds.length;
  const earnedTurnId =
    state.earnedTurnId ?? (answeredCount === 3 ? turnId : null);
  const next: AiConnectNudgeState = {
    ...state,
    answeredCount,
    countedTurnIds,
    earnedTurnId,
  };
  write(next);
  persist(next);
}

export function dismissAiConnectNudge(
  deps: { storage?: AiConnectNudgeStorage } = {},
): void {
  if (state.dismissed) return;
  if (deps.storage) boundStorage = deps.storage;
  const next: AiConnectNudgeState = { ...state, dismissed: true };
  write(next);
  persist(next);
}

/** First earned render this session. Persists `shown`; the turn id stays in memory. */
export function noteEarnedNudgeShown(
  turnId: string,
  deps: { storage?: AiConnectNudgeStorage } = {},
): boolean {
  if (turnId.length === 0) return false;
  if (state.shown && state.shownThisSessionTurnId === turnId) return false;
  if (deps.storage) boundStorage = deps.storage;
  const next: AiConnectNudgeState = {
    ...state,
    shown: true,
    shownThisSessionTurnId: turnId,
  };
  write(next);
  persist(next);
  return true;
}

/** Bind the once-per-session rate-limit tail to this coach turn. */
export function bindRateLimitTailTurn(turnId: string): void {
  if (turnId.length === 0) return;
  if (state.rateLimitBoundTurnId != null) return;
  write({ ...state, rateLimitBoundTurnId: turnId });
}

export async function clearAiConnectNudgeFromPhone(
  storage: { removeItem: (key: string) => Promise<void> } = AsyncStorage,
): Promise<void> {
  generation += 1;
  hydration = null;
  // The rate-limit bind is session memory, not the previous person's data.
  write({
    ...EMPTY,
    hydrated: true,
    rateLimitBoundTurnId: state.rateLimitBoundTurnId,
  });
  await storage.removeItem(AI_CONNECT_NUDGE_STORAGE_KEY);
}

export function __resetAiConnectNudgeForTests(
  storage: AiConnectNudgeStorage = AsyncStorage,
): void {
  generation += 1;
  state = EMPTY;
  hydration = null;
  boundStorage = storage;
  listeners.clear();
}
