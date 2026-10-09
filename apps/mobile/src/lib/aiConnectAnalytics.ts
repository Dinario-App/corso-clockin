import {
  HOW_IT_WORKS_BEAT_IDS,
  type HowItWorksBeatId,
  type HowItWorksLeave,
} from '@/src/features/howItWorks/howItWorksPresentation';

export const AI_CONNECT_STARTED = 'ai_connect_started';
export const AI_CONNECT_COMPLETED = 'ai_connect_completed';
export const AI_CONNECT_FAILED = 'ai_connect_failed';
export const AI_NUDGE_SHOWN = 'ai_nudge_shown';
export const AI_NUDGE_TAPPED = 'ai_nudge_tapped';
export const AI_NUDGE_DISMISSED = 'ai_nudge_dismissed';

export const AI_CONNECT_PROVIDERS = [
  'chatgpt',
  'grok',
  'openai',
  'anthropic',
  'xai',
] as const;
export type AiConnectProvider = (typeof AI_CONNECT_PROVIDERS)[number];

export const AI_CONNECT_METHODS = ['device_code', 'byok'] as const;
export type AiConnectMethod = (typeof AI_CONNECT_METHODS)[number];

export const AI_CONNECT_FAIL_REASONS = [
  'timeout',
  'denied',
  'entitlement',
  'network',
  'invalid_key',
  'cancelled',
] as const;
export type AiConnectFailReason = (typeof AI_CONNECT_FAIL_REASONS)[number];

export const AI_NUDGE_SURFACES = ['earned', 'rate_limit'] as const;
export type AiNudgeSurface = (typeof AI_NUDGE_SURFACES)[number];

export const HOW_IT_WORKS_VIEWED = 'how_it_works_viewed';
export const HOW_IT_WORKS_SKIPPED = 'how_it_works_skipped';
export const HOW_IT_WORKS_COMPLETED = 'how_it_works_completed';

export const AI_CONNECT_STARTED_KEYS = ['method', 'provider'] as const;
export const AI_CONNECT_COMPLETED_KEYS = ['method', 'provider'] as const;
export const AI_CONNECT_FAILED_KEYS = ['method', 'provider', 'reason'] as const;
export const AI_NUDGE_EVENT_KEYS = ['surface'] as const;
export const HOW_IT_WORKS_BEAT_KEYS = ['beat'] as const;
export const HOW_IT_WORKS_COMPLETED_KEYS = [] as const;

const PROVIDERS = new Set<string>(AI_CONNECT_PROVIDERS);
const METHODS = new Set<string>(AI_CONNECT_METHODS);
const REASONS = new Set<string>(AI_CONNECT_FAIL_REASONS);
const SURFACES = new Set<string>(AI_NUDGE_SURFACES);
const BEATS = new Set<string>(HOW_IT_WORKS_BEAT_IDS);

export type AiConnectStartedEvent = {
  name: typeof AI_CONNECT_STARTED;
  properties: { provider: AiConnectProvider; method: AiConnectMethod };
};
export type AiConnectCompletedEvent = {
  name: typeof AI_CONNECT_COMPLETED;
  properties: { provider: AiConnectProvider; method: AiConnectMethod };
};
export type AiConnectFailedEvent = {
  name: typeof AI_CONNECT_FAILED;
  properties: {
    provider: AiConnectProvider;
    method: AiConnectMethod;
    reason: AiConnectFailReason;
  };
};
export type AiNudgeEvent = {
  name:
    | typeof AI_NUDGE_SHOWN
    | typeof AI_NUDGE_TAPPED
    | typeof AI_NUDGE_DISMISSED;
  properties: { surface: AiNudgeSurface };
};
export type HowItWorksViewedEvent = {
  name: typeof HOW_IT_WORKS_VIEWED;
  properties: { beat: HowItWorksBeatId };
};
export type HowItWorksSkippedEvent = {
  name: typeof HOW_IT_WORKS_SKIPPED;
  properties: { beat: HowItWorksBeatId };
};
export type HowItWorksCompletedEvent = {
  name: typeof HOW_IT_WORKS_COMPLETED;
  properties: Record<string, never>;
};

export type AiConnectAnalyticsEvent =
  | AiConnectStartedEvent
  | AiConnectCompletedEvent
  | AiConnectFailedEvent
  | AiNudgeEvent
  | HowItWorksViewedEvent
  | HowItWorksSkippedEvent
  | HowItWorksCompletedEvent;

export type AiConnectAnalyticsSink = (
  name: string,
  properties?: Readonly<Record<string, string>>,
) => void;

let testSink: AiConnectAnalyticsSink | undefined;

export function __setAiConnectAnalyticsSinkForTests(
  sink: AiConnectAnalyticsSink | undefined,
): void {
  testSink = sink;
}

function asProvider(value: unknown): AiConnectProvider | null {
  return typeof value === 'string' && PROVIDERS.has(value)
    ? (value as AiConnectProvider)
    : null;
}

function asMethod(value: unknown): AiConnectMethod | null {
  return typeof value === 'string' && METHODS.has(value)
    ? (value as AiConnectMethod)
    : null;
}

function asReason(value: unknown): AiConnectFailReason | null {
  return typeof value === 'string' && REASONS.has(value)
    ? (value as AiConnectFailReason)
    : null;
}

function asSurface(value: unknown): AiNudgeSurface | null {
  return typeof value === 'string' && SURFACES.has(value)
    ? (value as AiNudgeSurface)
    : null;
}

function asBeat(value: unknown): HowItWorksBeatId | null {
  return typeof value === 'string' && BEATS.has(value)
    ? (value as HowItWorksBeatId)
    : null;
}

export function aiConnectReasonFromDeviceStatus(
  status: unknown,
): AiConnectFailReason | null {
  switch (status) {
    case 'denied':
      return 'denied';
    case 'expired':
      return 'timeout';
    case 'failed':
    case 'offline':
      return 'network';
    case 'blocked':
      return 'entitlement';
    default:
      return null;
  }
}

export function aiConnectReasonFromByokStatus(
  status: unknown,
): AiConnectFailReason | null {
  switch (status) {
    case 'empty':
    case 'unknown_prefix':
    case 'malformed':
    case 'rejected':
    case 'not_a_setup_token':
    case 'state_mismatch':
      return 'invalid_key';
    case 'unreachable':
      return 'network';
    default:
      return null;
  }
}

export function buildAiConnectStartedPayload(
  input: Record<string, unknown>,
): AiConnectStartedEvent | null {
  const provider = asProvider(input.provider);
  const method = asMethod(input.method);
  if (!provider || !method) return null;
  return {
    name: AI_CONNECT_STARTED,
    properties: { provider, method },
  };
}

export function buildAiConnectCompletedPayload(
  input: Record<string, unknown>,
): AiConnectCompletedEvent | null {
  const provider = asProvider(input.provider);
  const method = asMethod(input.method);
  if (!provider || !method) return null;
  return {
    name: AI_CONNECT_COMPLETED,
    properties: { provider, method },
  };
}

export function buildAiConnectFailedPayload(
  input: Record<string, unknown>,
): AiConnectFailedEvent | null {
  const provider = asProvider(input.provider);
  const method = asMethod(input.method);
  const reason = asReason(input.reason);
  if (!provider || !method || !reason) return null;
  return {
    name: AI_CONNECT_FAILED,
    properties: { provider, method, reason },
  };
}

export function buildAiNudgePayload(
  name:
    | typeof AI_NUDGE_SHOWN
    | typeof AI_NUDGE_TAPPED
    | typeof AI_NUDGE_DISMISSED,
  input: Record<string, unknown>,
): AiNudgeEvent | null {
  const surface = asSurface(input.surface);
  if (!surface) return null;
  if (name === AI_NUDGE_SHOWN && surface !== 'earned') return null;
  if (name === AI_NUDGE_DISMISSED && surface !== 'earned') return null;
  return { name, properties: { surface } };
}

export function buildHowItWorksViewedPayload(
  input: Record<string, unknown>,
): HowItWorksViewedEvent | null {
  const beat = asBeat(input.beat);
  if (!beat) return null;
  return {
    name: HOW_IT_WORKS_VIEWED,
    properties: { beat },
  };
}

export function buildHowItWorksSkippedPayload(
  input: Record<string, unknown>,
): HowItWorksSkippedEvent | null {
  const beat = asBeat(input.beat);
  if (!beat) return null;
  return {
    name: HOW_IT_WORKS_SKIPPED,
    properties: { beat },
  };
}

export function buildHowItWorksCompletedPayload(
  _input: Record<string, unknown> = {},
): HowItWorksCompletedEvent {
  return { name: HOW_IT_WORKS_COMPLETED, properties: {} };
}

/**
 * Once per beat per visit. A new visit is a new tracker. Replay is silent
 * and does not consume the beat.
 */
export function createHowItWorksVisit(): {
  noteViewed(beat: HowItWorksBeatId, replay?: boolean): boolean;
} {
  const viewed = new Set<HowItWorksBeatId>();
  return {
    noteViewed(beat, replay = false) {
      if (replay) return false;
      if (viewed.has(beat)) return false;
      viewed.add(beat);
      return true;
    },
  };
}

/** Skip control only; completed = leave() from the last beat. Replay: nothing. */
export function planHowItWorksLeaveEvents(input: {
  replay: boolean;
  choice: HowItWorksLeave;
  isLast: boolean;
  beat: HowItWorksBeatId | null;
}): Readonly<{ skippedBeat: HowItWorksBeatId | null; completed: boolean }> {
  if (input.replay) {
    return { skippedBeat: null, completed: false };
  }
  return {
    skippedBeat:
      input.choice === 'skip' && input.beat !== null ? input.beat : null,
    completed: input.isLast,
  };
}

function emit(event: AiConnectAnalyticsEvent): void {
  try {
    const properties = { ...event.properties };
    if (testSink) {
      testSink(event.name, properties);
      return;
    }
    void import('@/src/lib/analytics')
      .then((mod) => {
        try {
          mod.trackEvent(event.name, properties);
        } catch {
          // Fire-and-forget: analytics must never block connect, the nudge, or the intro.
        }
      })
      .catch(() => {
        // Unconfigured, opted out, or the analytics module failed to load.
      });
  } catch {
    // Fire-and-forget.
  }
}

export function reportAiConnectStarted(input: {
  provider: AiConnectProvider;
  method: AiConnectMethod;
}): void {
  try {
    const event = buildAiConnectStartedPayload(input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportAiConnectCompleted(input: {
  provider: AiConnectProvider;
  method: AiConnectMethod;
}): void {
  try {
    const event = buildAiConnectCompletedPayload(input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportAiConnectFailed(input: {
  provider: AiConnectProvider;
  method: AiConnectMethod;
  reason: AiConnectFailReason;
}): void {
  try {
    const event = buildAiConnectFailedPayload(input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportAiNudgeShown(input: { surface: 'earned' }): void {
  try {
    const event = buildAiNudgePayload(AI_NUDGE_SHOWN, input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportAiNudgeTapped(input: { surface: AiNudgeSurface }): void {
  try {
    const event = buildAiNudgePayload(AI_NUDGE_TAPPED, input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportAiNudgeDismissed(input: { surface: 'earned' }): void {
  try {
    const event = buildAiNudgePayload(AI_NUDGE_DISMISSED, input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportHowItWorksViewed(input: { beat: HowItWorksBeatId }): void {
  try {
    const event = buildHowItWorksViewedPayload(input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportHowItWorksSkipped(input: {
  beat: HowItWorksBeatId;
}): void {
  try {
    const event = buildHowItWorksSkippedPayload(input);
    if (event) emit(event);
  } catch {
    // Fire-and-forget.
  }
}

export function reportHowItWorksCompleted(): void {
  try {
    emit(buildHowItWorksCompletedPayload());
  } catch {
    // Fire-and-forget.
  }
}
