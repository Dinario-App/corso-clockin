import { isValidPriceMint } from '@/src/features/balances/priceSnapshot';
import {
  SKILL_HARD_BOUNDS,
  SKILL_SAFETY_CONDITIONS,
  getSkillTemplate,
  isSafetyCrossSkill,
  isSkillTemplateId,
  type SkillKnownVerdict,
  type SkillSafetyCondition,
  type SkillTemplateId,
} from './skillTemplate';

export const SIMULATE_WINDOW_DAYS = 30;

export type SimulateExecuteSlots = {
  pct: string;
  minOutBps: number;
  perDayMaxFires: number;
};

export type SimulateSafetySlots = {
  safety: SkillSafetyCondition;
  baselineVerdict: SkillKnownVerdict;
  minOutBps: number;
  perDayMaxFires: number;
};

/**
 * The wire request, one shape per family. A `safety_cross` skill sends NO
 * `windowDays` and the server's `.strict()` schema refuses one, so the two
 * shapes cannot be mixed in flight.
 */
export type SimulateRequest =
  | {
      skillId: SkillTemplateId;
      mint: string;
      windowDays: number;
      /** Present for price-cross execute skills only. */
      slots?: SimulateExecuteSlots;
    }
  | {
      skillId: SkillTemplateId;
      mint: string;
      slots: SimulateSafetySlots;
    };

export type SimulatedFire = {
  atMs: number;
  /** Decimal string USD price at the simulated fire. */
  priceUsd: string;
};

export type SkillVerdict = 'clear' | 'caution' | 'avoid' | 'unknown';
export type SkillReadingState = 'ok' | 'warn' | 'fail' | 'unknown';

export type SkillReading = {
  key: string;
  state: SkillReadingState;
};

/** Which verdict the composed safety read returned; `unknown` is fail-closed. */
export type SkillSafetyVerdict = SkillKnownVerdict | 'unknown';

export type SimulateResult =
  | {
      kind: 'safety';
      skillId: SkillTemplateId;
      mint: string;
      condition: SkillSafetyCondition;
      baselineVerdict: SkillKnownVerdict;
      verdict: SkillSafetyVerdict;
      observations: number;
      /** The observation that would have crossed, or null. */
      crossed: { atMs: number; verdict: SkillKnownVerdict } | null;
      asOfMs: number;
    }
  | {
      kind: 'execute';
      skillId: SkillTemplateId;
      mint: string;
      windowDays: number;
      fireCount: number;
      fires: SimulatedFire[];
      /** Integer bps, or null when the server could not estimate one. */
      estSlippageBps: number | null;
      thinData: boolean;
      asOfMs: number;
    }
  | {
      kind: 'analytics';
      skillId: SkillTemplateId;
      mint: string;
      verdict: SkillVerdict;
      readings: SkillReading[];
      asOfMs: number;
    }
  | {
      kind: 'confluence';
      skillId: 'heads_up';
      mint: string;
      timeframe: '1H';
      side: 'bear' | 'neutral' | 'bull';
      band: 'strong_bear' | 'bear' | 'neutral' | 'bull' | 'strong_bull';
      score: number;
      asOfMs: number;
    };

export type SimulateOutcome =
  | { ok: true; result: SimulateResult }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'invalid_request'
        | 'missing_api_url'
        | 'network'
        | 'aborted'
        | 'http'
        | 'rate_limited'
        | 'schema'
        | 'unsupported_network'
        | 'no_data'
        | 'unavailable';
      httpStatus?: number;
    };

export type SimulateArgs = {
  request: SimulateRequest;
  /** Kill switch: the resolved directory gate (build flag AND public config). */
  skillsEnabled: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

export function buildSimulateUrl(base: string): string {
  return `${base}/v1/skills/simulate`;
}

const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

/** Pure request gate; nothing leaves the device unless this passes. */
export function isValidSimulateRequest(request: SimulateRequest): boolean {
  if (!isSkillTemplateId(request.skillId)) return false;
  if (!isValidPriceMint(request.mint, 'mainnet-beta')) return false;
  const template = getSkillTemplate(request.skillId);

  // The caps both families share, bounded by the mandate ceilings.
  const capsValid = (slots: {
    minOutBps: number;
    perDayMaxFires: number;
  }): boolean =>
    Number.isInteger(slots.minOutBps) &&
    slots.minOutBps >= 1 &&
    slots.minOutBps <= SKILL_HARD_BOUNDS.maxMinOutBps &&
    Number.isInteger(slots.perDayMaxFires) &&
    slots.perDayMaxFires >= 1 &&
    slots.perDayMaxFires <= SKILL_HARD_BOUNDS.maxPerDayFires;

  if (isSafetyCrossSkill(template)) {
    if ('windowDays' in request) return false;
    const slots = request.slots;
    if (slots === undefined || !('safety' in slots)) return false;
    if (!SKILL_SAFETY_CONDITIONS.includes(slots.safety)) return false;
    if (!template.slots.safety.allowed.includes(slots.safety)) return false;
    if (!['green', 'amber', 'red'].includes(slots.baselineVerdict))
      return false;
    return capsValid(slots);
  }

  if (!('windowDays' in request)) return false;
  if (
    !Number.isInteger(request.windowDays) ||
    request.windowDays < 1 ||
    request.windowDays > 90
  ) {
    return false;
  }
  // Slots are bound to the template family: analytics skills never carry
  // them, execute skills always do. A request cannot ask for the other
  // family's dry run.
  if (template.kind === 'analytics') return request.slots === undefined;
  const slots = request.slots;
  if (slots === undefined || !('pct' in slots)) return false;
  if (!DECIMAL.test(slots.pct) || Number(slots.pct) <= 0) return false;
  return capsValid(slots);
}

const READING_STATES: ReadonlySet<string> = new Set([
  'ok',
  'warn',
  'fail',
  'unknown',
]);
const VERDICTS: ReadonlySet<string> = new Set([
  'clear',
  'caution',
  'avoid',
  'unknown',
]);
const KNOWN_VERDICTS: ReadonlySet<string> = new Set(['green', 'amber', 'red']);
const SAFETY_VERDICTS: ReadonlySet<string> = new Set([
  'green',
  'amber',
  'red',
  'unknown',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** Fail-closed parse of the simulate body against the requested skill + mint. */
export function parseSimulateResult(
  raw: unknown,
  request: SimulateRequest,
): SimulateResult | null {
  if (!isRecord(raw)) return null;
  if (raw.skillId !== request.skillId || raw.mint !== request.mint) return null;
  if (!isNonNegativeInt(raw.asOfMs)) return null;
  // The template family, not the server, decides the result shape. An
  // execute body on an analytics skill (or the reverse) is refused whole, so
  // execute-only fields can never be painted on The Verdict / Heads-Up.
  if (!isSkillTemplateId(request.skillId)) return null;
  const template = getSkillTemplate(request.skillId);
  const expectedKind =
    request.skillId === 'heads_up'
      ? 'confluence'
      : isSafetyCrossSkill(template)
        ? 'safety'
        : template.kind;
  if (raw.kind !== expectedKind) return null;

  if (raw.kind === 'safety') {
    if (
      typeof raw.condition !== 'string' ||
      !(SKILL_SAFETY_CONDITIONS as readonly string[]).includes(raw.condition)
    ) {
      return null;
    }
    if (
      typeof raw.baselineVerdict !== 'string' ||
      !KNOWN_VERDICTS.has(raw.baselineVerdict)
    ) {
      return null;
    }
    if (typeof raw.verdict !== 'string' || !SAFETY_VERDICTS.has(raw.verdict))
      return null;
    if (!isNonNegativeInt(raw.observations)) return null;
    let crossed: { atMs: number; verdict: SkillKnownVerdict } | null = null;
    if (raw.crossed !== null) {
      if (!isRecord(raw.crossed)) return null;
      if (!isNonNegativeInt(raw.crossed.atMs)) return null;
      if (
        typeof raw.crossed.verdict !== 'string' ||
        !KNOWN_VERDICTS.has(raw.crossed.verdict)
      ) {
        return null;
      }
      crossed = {
        atMs: raw.crossed.atMs,
        verdict: raw.crossed.verdict as SkillKnownVerdict,
      };
    }
    return {
      kind: 'safety',
      skillId: request.skillId,
      mint: request.mint,
      condition: raw.condition as SkillSafetyCondition,
      baselineVerdict: raw.baselineVerdict as SkillKnownVerdict,
      verdict: raw.verdict as SkillSafetyVerdict,
      observations: raw.observations,
      crossed,
      asOfMs: raw.asOfMs,
    };
  }

  if (raw.kind === 'execute') {
    if (!('windowDays' in request)) return null;
    if (
      !isNonNegativeInt(raw.windowDays) ||
      raw.windowDays !== request.windowDays
    )
      return null;
    if (!isNonNegativeInt(raw.fireCount)) return null;
    if (!Array.isArray(raw.fires)) return null;
    const fires: SimulatedFire[] = [];
    for (const fire of raw.fires) {
      if (!isRecord(fire)) return null;
      if (!isNonNegativeInt(fire.atMs)) return null;
      if (typeof fire.priceUsd !== 'string' || !DECIMAL.test(fire.priceUsd))
        return null;
      fires.push({ atMs: fire.atMs, priceUsd: fire.priceUsd });
    }
    if (fires.length !== raw.fireCount) return null;
    const estSlippageBps =
      raw.estSlippageBps === null
        ? null
        : isNonNegativeInt(raw.estSlippageBps)
          ? raw.estSlippageBps
          : undefined;
    if (estSlippageBps === undefined) return null;
    if (typeof raw.thinData !== 'boolean') return null;
    return {
      kind: 'execute',
      skillId: request.skillId,
      mint: request.mint,
      windowDays: raw.windowDays,
      fireCount: raw.fireCount,
      fires,
      estSlippageBps,
      thinData: raw.thinData,
      asOfMs: raw.asOfMs,
    };
  }

  if (raw.kind === 'analytics') {
    if (typeof raw.verdict !== 'string' || !VERDICTS.has(raw.verdict))
      return null;
    if (!Array.isArray(raw.readings)) return null;
    const readings: SkillReading[] = [];
    for (const reading of raw.readings) {
      if (!isRecord(reading)) return null;
      if (
        typeof reading.key !== 'string' ||
        reading.key.length === 0 ||
        reading.key.length > 64
      ) {
        return null;
      }
      if (
        typeof reading.state !== 'string' ||
        !READING_STATES.has(reading.state)
      )
        return null;
      readings.push({
        key: reading.key,
        state: reading.state as SkillReadingState,
      });
    }
    return {
      kind: 'analytics',
      skillId: request.skillId,
      mint: request.mint,
      verdict: raw.verdict as SkillVerdict,
      readings,
      asOfMs: raw.asOfMs,
    };
  }

  if (raw.kind === 'confluence') {
    if (request.skillId !== 'heads_up') return null;
    if (raw.timeframe !== '1H') return null;
    if (!['bear', 'neutral', 'bull'].includes(String(raw.side))) return null;
    if (
      !['strong_bear', 'bear', 'neutral', 'bull', 'strong_bull'].includes(
        String(raw.band),
      )
    )
      return null;
    if (
      typeof raw.score !== 'number' ||
      !Number.isFinite(raw.score) ||
      raw.score < -100 ||
      raw.score > 100
    )
      return null;
    return {
      kind: 'confluence',
      skillId: 'heads_up',
      mint: request.mint,
      timeframe: '1H',
      side: raw.side as 'bear' | 'neutral' | 'bull',
      band: raw.band as
        | 'strong_bear'
        | 'bear'
        | 'neutral'
        | 'bull'
        | 'strong_bull',
      score: raw.score,
      asOfMs: raw.asOfMs,
    };
  }

  return null;
}

export async function simulateSkill(
  args: SimulateArgs,
): Promise<SimulateOutcome> {
  if (!args.skillsEnabled) return { ok: false, code: 'disabled' };
  if (!isValidSimulateRequest(args.request))
    return { ok: false, code: 'invalid_request' };
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };

  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(
      buildSimulateUrl(base),
      {
        method: 'POST',
        signal: args.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(args.request),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError')
      return { ok: false, code: 'aborted' };
    return { ok: false, code: 'network' };
  }

  if (response.status === 429)
    return { ok: false, code: 'rate_limited', httpStatus: 429 };
  if (response.status === 503)
    return { ok: false, code: 'disabled', httpStatus: 503 };
  if (!response.ok)
    return { ok: false, code: 'http', httpStatus: response.status };

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return { ok: false, code: 'schema' };
  }
  if (!isRecord(raw)) return { ok: false, code: 'schema' };
  if (raw.ok === false) {
    if (raw.reason === 'unsupported_network')
      return { ok: false, code: 'unsupported_network' };
    if (raw.reason === 'no_data') return { ok: false, code: 'no_data' };
    return { ok: false, code: 'unavailable' };
  }
  const result = parseSimulateResult(raw, args.request);
  if (!result) return { ok: false, code: 'schema' };
  return { ok: true, result };
}
