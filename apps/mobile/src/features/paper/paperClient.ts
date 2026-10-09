export const PAPER_RULE_KINDS = [
  'dip',
  'take_profit',
  'stop_loss',
  'dca',
] as const;
export type PaperRuleKind = (typeof PAPER_RULE_KINDS)[number];

export type PaperRule =
  | { kind: 'dip'; dropPct: string }
  | { kind: 'take_profit'; risePct: string }
  | { kind: 'stop_loss'; dropPct: string }
  | { kind: 'dca'; everyMs: number };

export type PaperRequest = {
  mint: string;
  rule: PaperRule;
  windowDays: 7 | 30;
  sizeUsd: string;
  startingUsd: string;
  caps: { perDayMaxFires: number; perDayMaxUsd: string; minOutBps: number };
};

export type PaperFire =
  | {
      status: 'filled';
      atMs: number;
      side: 'buy' | 'sell';
      triggerPriceUsd: string;
      worstPriceUsd: string;
      usd: string;
      tokens: string;
    }
  | {
      status: 'unfilled';
      atMs: number;
      side: 'buy' | 'sell';
      triggerPriceUsd: string;
      reason: 'no_price_after_trigger' | 'insufficient_balance';
    };

export type PaperResult = {
  kind: PaperRuleKind;
  baseline: { priceUsd: string; atMs: number };
  thinData: boolean;
  fires: PaperFire[];
  stopped: { atMs: number; reason: 'day_cap' } | null;
  end: {
    usd: string;
    tokens: string;
    markPriceUsd: string;
    valueUsd: string;
    startValueUsd: string;
    pnlUsd: string;
  };
  assumptions: {
    feeBps: number;
    minOutBps: number;
    latencyMs: number;
    /** The liquidity the modelled pool was built from (half of it is the pool). */
    depthUsd: string;
    impact: PaperImpactModel;
  };
};

/** The price-impact models the screen can name. Anything else refuses the result. */
export const PAPER_IMPACT_MODELS = ['constant_product'] as const;
export type PaperImpactModel = (typeof PAPER_IMPACT_MODELS)[number];

export function isPaperImpactModel(value: unknown): value is PaperImpactModel {
  return (PAPER_IMPACT_MODELS as readonly unknown[]).includes(value);
}

export type PaperOutcome =
  | { ok: true; result: PaperResult }
  | {
      ok: false;
      code:
        | 'disabled'
        | 'invalid_request'
        | 'missing_api_url'
        | 'network'
        | 'http'
        | 'schema'
        | 'unsupported_network'
        | 'no_data'
        | 'no_depth'
        | 'unavailable';
    };

const HOUR_MS = 60 * 60 * 1_000;
export const PAPER_DCA_MIN_HOURS = 1;
export const PAPER_DCA_MAX_HOURS = 168;
export const PAPER_MAX_MIN_OUT_BPS = 5_000;
export const PAPER_MAX_PER_DAY_FIRES = 48;
export const PAPER_SOL_MINT = 'So11111111111111111111111111111111111111112';

const USD = /^\d{1,7}(?:\.\d{1,6})?$/;
const PCT = /^\d+(?:\.\d+)?$/;
const DECIMAL = /^-?\d+(?:\.\d+)?$/;
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** A 32-byte base58 key, checked by hand so this module needs no `@solana/*`. */
export function isSolanaAddress(value: string): boolean {
  if (value.length < 32 || value.length > 44) return false;
  let decoded = 0n;
  for (const character of value) {
    const digit = BASE58.indexOf(character);
    if (digit === -1) return false;
    decoded = decoded * 58n + BigInt(digit);
  }
  let bytes = 0;
  for (let remaining = decoded; remaining > 0n; remaining >>= 8n) bytes += 1;
  let zeros = 0;
  while (value[zeros] === '1') zeros += 1;
  return zeros + bytes === 32;
}

export function isPaperSide(kind: PaperRuleKind): 'buy' | 'sell' {
  return kind === 'dip' || kind === 'dca' ? 'buy' : 'sell';
}

function usdOk(value: string): boolean {
  return USD.test(value) && /[1-9]/.test(value) && Number(value) <= 1_000_000;
}

function pctBetween(value: string, min: number, max: number): boolean {
  return PCT.test(value) && Number(value) >= min && Number(value) <= max;
}

/** Hours → the live rule's `everyMs`. */
export function dcaEveryMs(hours: number): number {
  return Math.round(hours * HOUR_MS);
}

/** Pure request gate, mirroring the server's `.strict()` schema; nothing leaves the device unless it passes. */
export function isValidPaperRequest(request: PaperRequest): boolean {
  if (!isSolanaAddress(request.mint)) return false;
  if (request.windowDays !== 7 && request.windowDays !== 30) return false;
  if (
    !usdOk(request.sizeUsd) ||
    !usdOk(request.startingUsd) ||
    !usdOk(request.caps.perDayMaxUsd)
  )
    return false;
  const { perDayMaxFires, minOutBps } = request.caps;
  if (
    !Number.isInteger(perDayMaxFires) ||
    perDayMaxFires < 1 ||
    perDayMaxFires > PAPER_MAX_PER_DAY_FIRES
  )
    return false;
  if (
    !Number.isInteger(minOutBps) ||
    minOutBps < 1 ||
    minOutBps > PAPER_MAX_MIN_OUT_BPS
  )
    return false;
  const { rule } = request;
  switch (rule.kind) {
    case 'dip':
    case 'stop_loss':
      return pctBetween(rule.dropPct, 1, 90);
    case 'take_profit':
      return pctBetween(rule.risePct, 1, 500);
    case 'dca':
      return (
        Number.isInteger(rule.everyMs) &&
        rule.everyMs >= dcaEveryMs(PAPER_DCA_MIN_HOURS) &&
        rule.everyMs <= dcaEveryMs(PAPER_DCA_MAX_HOURS)
      );
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isDecimal = (value: unknown): value is string =>
  typeof value === 'string' && DECIMAL.test(value);
const isPositive = (value: unknown): value is string =>
  isDecimal(value) && !value.startsWith('-');

function parseFire(raw: unknown, side: 'buy' | 'sell'): PaperFire | null {
  if (!isRecord(raw)) return null;
  if (!isInt(raw.atMs) || raw.side !== side || !isPositive(raw.triggerPriceUsd))
    return null;
  if (raw.status === 'filled') {
    if (
      !isPositive(raw.worstPriceUsd) ||
      !isPositive(raw.usd) ||
      !isPositive(raw.tokens)
    )
      return null;
    return {
      status: 'filled',
      atMs: raw.atMs,
      side,
      triggerPriceUsd: raw.triggerPriceUsd,
      worstPriceUsd: raw.worstPriceUsd,
      usd: raw.usd,
      tokens: raw.tokens,
    };
  }
  if (raw.status === 'unfilled') {
    if (
      raw.reason !== 'no_price_after_trigger' &&
      raw.reason !== 'insufficient_balance'
    )
      return null;
    return {
      status: 'unfilled',
      atMs: raw.atMs,
      side,
      triggerPriceUsd: raw.triggerPriceUsd,
      reason: raw.reason,
    };
  }
  return null;
}

/**
 * Fail-closed parse against the request. Unknown keys are ignored (a newer
 * server may add them), but a missing or malformed field the screen paints —
 * or a result without the simulation disclosure — refuses the whole body.
 */
export function parsePaperResult(
  raw: unknown,
  request: PaperRequest,
): PaperResult | null {
  if (!isRecord(raw) || raw.ok !== true) return null;
  if (raw.disclosure !== 'paper_simulation_real_fills_differ') return null;
  if (raw.kind !== request.rule.kind) return null;
  const side = isPaperSide(request.rule.kind);
  const { baseline, end, assumptions, stopped } = raw;
  if (
    !isRecord(baseline) ||
    !isPositive(baseline.priceUsd) ||
    !isInt(baseline.atMs)
  )
    return null;
  if (typeof raw.thinData !== 'boolean' || !Array.isArray(raw.fires))
    return null;
  if (!isRecord(end)) return null;
  for (const key of [
    'usd',
    'tokens',
    'markPriceUsd',
    'valueUsd',
    'startValueUsd',
  ] as const) {
    if (!isPositive(end[key])) return null;
  }
  if (!isDecimal(end.pnlUsd)) return null;
  if (
    !isRecord(assumptions) ||
    !isInt(assumptions.feeBps) ||
    !isInt(assumptions.latencyMs) ||
    !isPositive(assumptions.depthUsd) ||
    !isPaperImpactModel(assumptions.impact)
  )
    return null;
  if (assumptions.minOutBps !== request.caps.minOutBps) return null;
  let stop: PaperResult['stopped'] = null;
  if (stopped !== null) {
    if (
      !isRecord(stopped) ||
      !isInt(stopped.atMs) ||
      stopped.reason !== 'day_cap'
    )
      return null;
    stop = { atMs: stopped.atMs, reason: 'day_cap' };
  }
  const fires: PaperFire[] = [];
  for (const entry of raw.fires) {
    const fire = parseFire(entry, side);
    if (!fire) return null;
    fires.push(fire);
  }
  return {
    kind: request.rule.kind,
    baseline: { priceUsd: baseline.priceUsd, atMs: baseline.atMs },
    thinData: raw.thinData,
    fires,
    stopped: stop,
    end: {
      usd: end.usd as string,
      tokens: end.tokens as string,
      markPriceUsd: end.markPriceUsd as string,
      valueUsd: end.valueUsd as string,
      startValueUsd: end.startValueUsd as string,
      pnlUsd: end.pnlUsd,
    },
    assumptions: {
      feeBps: assumptions.feeBps,
      minOutBps: request.caps.minOutBps,
      latencyMs: assumptions.latencyMs,
      depthUsd: assumptions.depthUsd,
      impact: assumptions.impact,
    },
  };
}

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    const trimmed = override?.trim() ?? '';
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

export async function runPaperSimulation(args: {
  request: PaperRequest;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
  signal?: AbortSignal;
}): Promise<PaperOutcome> {
  if (!isValidPaperRequest(args.request))
    return { ok: false, code: 'invalid_request' };
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false, code: 'missing_api_url' };
  const doFetch = args.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${base}/v1/paper/simulate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args.request),
      ...(args.signal ? { signal: args.signal } : {}),
    });
  } catch {
    return { ok: false, code: 'network' };
  }
  if (response.status === 503) return { ok: false, code: 'disabled' };
  if (!response.ok) return { ok: false, code: 'http' };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: 'schema' };
  }
  if (isRecord(body) && body.ok === false) {
    if (
      body.reason === 'unsupported_network' ||
      body.reason === 'no_data' ||
      body.reason === 'no_depth' ||
      body.reason === 'unavailable'
    ) {
      return { ok: false, code: body.reason };
    }
    return { ok: false, code: 'schema' };
  }
  const result = parsePaperResult(body, args.request);
  return result ? { ok: true, result } : { ok: false, code: 'schema' };
}
