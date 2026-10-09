// ── Branded value kinds ────────────────────────────────────────────────────

declare const whyBrand: unique symbol;
type Brand<T, B extends string> = T & { readonly [whyBrand]: B };

/** Signed decimal percent, sign always explicit: `+2.10`, `-0.40`, `+0.00`. */
export type Pct = Brand<string, 'Pct'>;
/** Unsigned percent in 0..100: `64.20`. */
export type Share = Brand<string, 'Share'>;
/** USD amount as a decimal string. Money never crosses a wire as a float. */
export type Money = Brand<string, 'Money'>;
/** Positive decimal ratio: `1.42`. */
export type Ratio = Brand<string, 'Ratio'>;
/** Epoch milliseconds. */
export type AsOf = number;

const PCT_RE = /^[+-]\d{1,6}\.\d{2}$/;
const SHARE_RE = /^\d{1,3}\.\d{2}$/;
const MONEY_RE = /^\d{1,15}(\.\d{1,8})?$/;
const RATIO_RE = /^\d{1,6}\.\d{2}$/;

const finite = (value: number) => Number.isFinite(value);

/** `toPct(2.1)` → `+2.10`. Returns null for a non-finite input. */
export function toPct(value: number): Pct | null {
  if (!finite(value) || Math.abs(value) >= 1_000_000) return null;
  const fixed = Math.abs(value).toFixed(2);
  const sign = value < 0 && fixed !== '0.00' ? '-' : '+';
  return `${sign}${fixed}` as Pct;
}

export function toShare(value: number): Share | null {
  if (!finite(value) || value < 0 || value > 100) return null;
  return value.toFixed(2) as Share;
}

export function toMoney(value: number): Money | null {
  if (!finite(value) || value < 0 || value >= 1e15) return null;
  return value.toFixed(2) as Money;
}

export function toRatio(value: number): Ratio | null {
  if (!finite(value) || value <= 0 || value >= 1_000_000) return null;
  return value.toFixed(2) as Ratio;
}

// ── Param kinds (the whole vocabulary a param can use) ─────────────────────

export type WhyParamKind =
  | { kind: 'pct' }
  | { kind: 'share' }
  | { kind: 'money' }
  | { kind: 'ratio' }
  | { kind: 'count' }
  | { kind: 'enum'; values: readonly string[] };

type ParamValue<K extends WhyParamKind> = K extends { kind: 'pct' }
  ? Pct
  : K extends { kind: 'share' }
    ? Share
    : K extends { kind: 'money' }
      ? Money
      : K extends { kind: 'ratio' }
        ? Ratio
        : K extends { kind: 'count' }
          ? number
          : K extends { kind: 'enum'; values: readonly (infer V)[] }
            ? V
            : never;

const pct = { kind: 'pct' } as const;
const share = { kind: 'share' } as const;
const money = { kind: 'money' } as const;
const ratio = { kind: 'ratio' } as const;
const count = { kind: 'count' } as const;
const oneOf = <const V extends readonly string[]>(values: V) =>
  ({ kind: 'enum', values }) as const;

// ── Source kinds: the basis label a line cites ─────────────────────────────

/**
 * Corso's own basis labels. Mobile renders them as the small grey label
 * (`Order flow · 1 day`). Never a vendor name.
 */
export const WHY_SOURCE_KINDS = [
  'price',
  'order_flow',
  'trading_volume',
  'holders',
  'liquidity',
  'chart',
  'market_mood',
  'safety_checks',
  'filings',
  'plan',
] as const;
export type WhySourceKind = (typeof WHY_SOURCE_KINDS)[number];

/** Window lengths a basis can cite, in hours. `null` = a point-in-time read. */
export const WHY_WINDOW_HOURS = [24, 168, 720] as const;
export type WhyWindowHours = (typeof WHY_WINDOW_HOURS)[number];

export type WhySource = {
  kind: WhySourceKind;
  windowHours: WhyWindowHours | null;
};

// ── The codes ──────────────────────────────────────────────────────────────

const CHART_TIMEFRAMES = ['hour', 'four_hours', 'day'] as const;
const MARKET_MOODS = [
  'extreme_fear',
  'fear',
  'neutral',
  'greed',
  'extreme_greed',
] as const;
const FILING_FORMS = ['insider_filing', 'fund_holdings_filing'] as const;
const FLOW_DIRECTIONS = ['up', 'down'] as const;

/**
 * Every code, its params, and the one basis it cites. The table IS the
 * contract: `WhyCode`, `WhyParams` and the runtime parser all derive from it.
 */
export const WHY_CODES = {
  price_up_today: {
    source: { kind: 'price', windowHours: 24 },
    params: { changePct: pct },
  },
  price_down_today: {
    source: { kind: 'price', windowHours: 24 },
    params: { changePct: pct },
  },
  price_steady_today: {
    source: { kind: 'price', windowHours: 24 },
    params: { changePct: pct },
  },
  price_up_week: {
    source: { kind: 'price', windowHours: 168 },
    params: { changePct: pct },
  },
  price_down_week: {
    source: { kind: 'price', windowHours: 168 },
    params: { changePct: pct },
  },
  price_near_month_high: {
    source: { kind: 'price', windowHours: 720 },
    params: { belowHighPct: share },
  },
  price_near_month_low: {
    source: { kind: 'price', windowHours: 720 },
    params: { aboveLowPct: share },
  },
  price_near_month_average: {
    source: { kind: 'price', windowHours: 720 },
    params: { offsetPct: pct },
  },
  order_flow_skew: {
    source: { kind: 'order_flow', windowHours: 24 },
    params: { direction: oneOf(FLOW_DIRECTIONS), ratio },
  },
  order_flow_balanced: {
    source: { kind: 'order_flow', windowHours: 24 },
    params: { ratio },
  },
  volume_today: {
    source: { kind: 'trading_volume', windowHours: 24 },
    params: { volumeUsd: money },
  },
  holders_concentrated: {
    source: { kind: 'holders', windowHours: null },
    params: { top10Pct: share },
  },
  holders_spread: {
    source: { kind: 'holders', windowHours: null },
    params: { top10Pct: share },
  },
  liquidity_thin: {
    source: { kind: 'liquidity', windowHours: null },
    params: { liquidityUsd: money },
  },
  liquidity_deep: {
    source: { kind: 'liquidity', windowHours: null },
    params: { liquidityUsd: money },
  },
  chart_trend_up: {
    source: { kind: 'chart', windowHours: null },
    params: { timeframe: oneOf(CHART_TIMEFRAMES) },
  },
  chart_trend_down: {
    source: { kind: 'chart', windowHours: null },
    params: { timeframe: oneOf(CHART_TIMEFRAMES) },
  },
  chart_trend_mixed: {
    source: { kind: 'chart', windowHours: null },
    params: { timeframe: oneOf(CHART_TIMEFRAMES) },
  },
  market_mood: {
    source: { kind: 'market_mood', windowHours: null },
    params: { mood: oneOf(MARKET_MOODS), index: count },
  },
  safety_checks_flagged: {
    source: { kind: 'safety_checks', windowHours: null },
    params: { flagCount: count },
  },
  filing_recent: {
    source: { kind: 'filings', windowHours: null },
    params: { form: oneOf(FILING_FORMS), daysAgo: count },
  },
  plan_legs_mixed_today: {
    source: { kind: 'plan', windowHours: 24 },
    params: { upCount: count, downCount: count },
  },
  plan_all_near_month_average: {
    source: { kind: 'plan', windowHours: 720 },
    params: { maxOffsetPct: share },
  },
} as const satisfies Record<
  string,
  { source: WhySource; params: Record<string, WhyParamKind> }
>;

type Codes = typeof WHY_CODES;
export type WhyCode = keyof Codes;
export const WHY_CODE_LIST = Object.keys(WHY_CODES) as WhyCode[];

export type WhyParams<C extends WhyCode> = {
  [P in keyof Codes[C]['params']]: Codes[C]['params'][P] extends WhyParamKind
    ? ParamValue<Codes[C]['params'][P]>
    : never;
};

export type WhyLine = {
  [C in WhyCode]: {
    code: C;
    params: WhyParams<C>;
    source: WhySource;
    asOf: AsOf;
  };
}[WhyCode];

// ── Surfaces ───────────────────────────────────────────────────────────────

export const WHY_SURFACES = {
  review: { min: 3, max: 4, subject: 'asset' },
  moving: { min: 1, max: 1, subject: 'asset' },
  strip: { min: 1, max: 1, subject: 'asset' },
  plan: { min: 3, max: 3, subject: 'plan' },
} as const;
export type WhySurface = keyof typeof WHY_SURFACES;

/** A Solana mint address. Identity only; never rendered. */
export type Mint = Brand<string, 'Mint'>;
export type PlanId = Brand<string, 'PlanId'>;

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const PLAN_ID_RE = /^[0-9a-f]{16}$/;

export const isMint = (value: unknown): value is Mint =>
  typeof value === 'string' && MINT_RE.test(value);
export const isPlanId = (value: unknown): value is PlanId =>
  typeof value === 'string' && PLAN_ID_RE.test(value);

export type WhySubject =
  | { kind: 'asset'; mint: Mint }
  | { kind: 'plan'; planId: PlanId };

export type WhyPayloadReady = {
  schemaVersion: 1;
  surface: WhySurface;
  subject: WhySubject;
  state: 'ready';
  /** The oldest `asOf` among the lines: the payload is only as fresh as that. */
  asOf: AsOf;
  lines: WhyLine[];
};

export type WhyPayloadEmpty = {
  schemaVersion: 1;
  surface: WhySurface;
  subject: WhySubject;
  /** `disabled` = the flag is off. `unavailable` = too few usable lines. */
  state: 'unavailable' | 'disabled';
  asOf: AsOf;
};

export type WhyPayload = WhyPayloadReady | WhyPayloadEmpty;

/** One response carries every subject a surface asked for, in request order. */
export type WhyResponse =
  | {
      schemaVersion: 1;
      surface: WhySurface;
      state: 'ready';
      asOf: AsOf;
      items: WhyPayload[];
    }
  | {
      schemaVersion: 1;
      surface: WhySurface;
      state: 'disabled';
      asOf: AsOf;
    };

// ── Runtime parsing (both sides of the wire use this) ──────────────────────

/**
 * The top-level fields of a `WhyLine`, each with the kind of value it holds.
 * The parser rejects any key not in this table.
 */
export const WHY_LINE_FIELDS = {
  code: 'code',
  params: 'params',
  source: 'source',
  asOf: 'epochMs',
} as const satisfies Record<keyof WhyLine, WhyLineFieldKind>;

export type WhyLineFieldKind = 'code' | 'params' | 'source' | 'epochMs';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => key in value);
};

export const isEpochMs = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

/** One param value against its kind. Exported for the surface parsers. */
export function isParamValue(kind: WhyParamKind, value: unknown): boolean {
  switch (kind.kind) {
    case 'pct':
      return typeof value === 'string' && PCT_RE.test(value);
    case 'share':
      return (
        typeof value === 'string' &&
        SHARE_RE.test(value) &&
        Number(value) <= 100
      );
    case 'money':
      return typeof value === 'string' && MONEY_RE.test(value);
    case 'ratio':
      return (
        typeof value === 'string' && RATIO_RE.test(value) && Number(value) > 0
      );
    case 'count':
      return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      );
    case 'enum':
      return typeof value === 'string' && kind.values.includes(value);
  }
}

const isWhyCode = (value: unknown): value is WhyCode =>
  typeof value === 'string' && Object.hasOwn(WHY_CODES, value);

function parseField(
  kind: WhyLineFieldKind,
  value: unknown,
  code: WhyCode,
): boolean {
  const spec = WHY_CODES[code];
  switch (kind) {
    case 'code':
      return value === code;
    case 'epochMs':
      return isEpochMs(value);
    case 'source':
      return (
        isRecord(value) &&
        hasExactKeys(value, ['kind', 'windowHours']) &&
        value.kind === spec.source.kind &&
        value.windowHours === spec.source.windowHours
      );
    case 'params': {
      if (!isRecord(value)) return false;
      const declared = spec.params as Record<string, WhyParamKind>;
      const names = Object.keys(declared);
      return (
        hasExactKeys(value, names) &&
        names.every((name) => isParamValue(declared[name], value[name]))
      );
    }
  }
}

/**
 * Parse one line. Returns null for anything that is not exactly a line:
 * an unknown code, a missing or extra key anywhere, a param outside its kind,
 * or a basis that is not the one its code cites. Never throws.
 */
export function parseWhyLine(input: unknown): WhyLine | null {
  if (!isRecord(input) || !isWhyCode(input.code)) return null;
  const fields = WHY_LINE_FIELDS as Record<string, WhyLineFieldKind>;
  const names = Object.keys(fields);
  if (!hasExactKeys(input, names)) return null;
  const code = input.code;
  for (const name of names) {
    if (!parseField(fields[name], input[name], code)) return null;
  }
  return input as WhyLine;
}

function parseSubject(
  input: unknown,
  expected: 'asset' | 'plan',
): WhySubject | null {
  if (!isRecord(input) || input.kind !== expected) return null;
  if (expected === 'asset') {
    return hasExactKeys(input, ['kind', 'mint']) &&
      typeof input.mint === 'string' &&
      MINT_RE.test(input.mint)
      ? (input as WhySubject)
      : null;
  }
  return hasExactKeys(input, ['kind', 'planId']) &&
    typeof input.planId === 'string' &&
    PLAN_ID_RE.test(input.planId)
    ? (input as WhySubject)
    : null;
}

const isSurface = (value: unknown): value is WhySurface =>
  typeof value === 'string' && Object.hasOwn(WHY_SURFACES, value);

/**
 * Parse one surface payload, enforcing the surface's line count. A ready
 * payload whose lines do not all parse is rejected whole: a line that does
 * not parse was not sent by this contract, so nothing about the payload can
 * be trusted to be what the engine meant.
 */
export function parseWhyPayload(input: unknown): WhyPayload | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null;
  if (!isSurface(input.surface) || !isEpochMs(input.asOf)) return null;
  const rules = WHY_SURFACES[input.surface];
  if (!parseSubject(input.subject, rules.subject)) return null;
  if (input.state === 'unavailable' || input.state === 'disabled') {
    return hasExactKeys(input, [
      'schemaVersion',
      'surface',
      'subject',
      'state',
      'asOf',
    ])
      ? (input as WhyPayloadEmpty)
      : null;
  }
  if (input.state !== 'ready') return null;
  if (
    !hasExactKeys(input, [
      'schemaVersion',
      'surface',
      'subject',
      'state',
      'asOf',
      'lines',
    ])
  )
    return null;
  const lines = input.lines;
  if (!Array.isArray(lines)) return null;
  if (lines.length < rules.min || lines.length > rules.max) return null;
  if (!lines.every((line) => parseWhyLine(line) !== null)) return null;
  const codes = new Set(lines.map((line) => (line as WhyLine).code));
  if (codes.size !== lines.length) return null;
  return input as WhyPayloadReady;
}

export function parseWhyResponse(input: unknown): WhyResponse | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null;
  if (!isSurface(input.surface) || !isEpochMs(input.asOf)) return null;
  if (input.state === 'disabled') {
    return hasExactKeys(input, ['schemaVersion', 'surface', 'state', 'asOf'])
      ? (input as WhyResponse)
      : null;
  }
  if (input.state !== 'ready') return null;
  if (
    !hasExactKeys(input, ['schemaVersion', 'surface', 'state', 'asOf', 'items'])
  )
    return null;
  if (!Array.isArray(input.items)) return null;
  const surface = input.surface;
  const ok = input.items.every((item) => {
    const parsed = parseWhyPayload(item);
    return parsed !== null && parsed.surface === surface;
  });
  return ok ? (input as WhyResponse) : null;
}

// ── Type-level guard: no free-text leaf anywhere in the wire types ─────────

type IsWideString<T> = [T] extends [string]
  ? string extends T
    ? true
    : false
  : false;

export type FreeTextKeys<T> = T extends
  | string
  | number
  | boolean
  | null
  | undefined
  ? never
  : T extends readonly (infer E)[]
    ? FreeTextKeys<E>
    : T extends object
      ? {
          [K in keyof T]-?: IsWideString<T[K]> extends true
            ? K
            : FreeTextKeys<T[K]>;
        }[keyof T]
      : never;
