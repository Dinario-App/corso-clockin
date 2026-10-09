import {
  type AsOf,
  isEpochMs,
  isMint,
  isParamValue,
  isPlanId,
  type Mint,
  type Money,
  type Pct,
  type PlanId,
  parseWhyLine,
  parseWhyPayload,
  type Share,
  WHY_SURFACES,
  type WhyLine,
  type WhyPayload,
  type WhyResponse,
} from './contract.js';

declare const surfaceBrand: unique symbol;
type Brand<T, B extends string> = T & { readonly [surfaceBrand]: B };

// ── Value kinds added by the surfaces ──────────────────────────────────────

/**
 * A ticker as the asset's identity (`SOL`, `cbBTC`, `SPY`). No whitespace and
 * at most 16 characters, so it can name an asset and cannot hold a sentence.
 * A symbol outside this shape is not an error to render around: the item is
 * dropped by its surface parser.
 */
export type TickerSymbol = Brand<string, 'TickerSymbol'>;
/** Unsigned token quantity as a decimal string: `12.4`, `41200000`. */
export type Quantity = Brand<string, 'Quantity'>;
/** An integer amount in a token's smallest unit: `337200000`. */
export type AtomicAmount = Brand<string, 'AtomicAmount'>;

const TICKER_RE = /^[A-Za-z0-9][A-Za-z0-9.$_-]{0,15}$/;
const QUANTITY_RE = /^\d{1,20}(\.\d{1,12})?$/;
const ATOMIC_RE = /^\d{1,40}$/;

export const isTickerSymbol = (value: unknown): value is TickerSymbol =>
  typeof value === 'string' && TICKER_RE.test(value);
export const isQuantity = (value: unknown): value is Quantity =>
  typeof value === 'string' && QUANTITY_RE.test(value);
export const isAtomicAmount = (value: unknown): value is AtomicAmount =>
  typeof value === 'string' && ATOMIC_RE.test(value);
const isPct = (value: unknown): value is Pct =>
  isParamValue({ kind: 'pct' }, value);
const isShare = (value: unknown): value is Share =>
  isParamValue({ kind: 'share' }, value);
const isMoney = (value: unknown): value is Money =>
  isParamValue({ kind: 'money' }, value);
const isCount = (value: unknown): value is number =>
  isParamValue({ kind: 'count' }, value);

const oneOf =
  <const V extends readonly string[]>(values: V) =>
  (value: unknown): value is V[number] =>
    typeof value === 'string' && values.includes(value);

/** `assetClass` drives the small grey class label, the filter and majors-first. */
export const ASSET_CLASSES = [
  'major',
  'other',
  'stock',
  'etf',
  'cash',
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const AVAILABILITY = [
  'available',
  'geo_blocked',
  'unsupported',
] as const;
export type Availability = (typeof AVAILABILITY)[number];

export type AssetRef = {
  mint: Mint;
  symbol: TickerSymbol;
  assetClass: AssetClass;
};

const isAssetClass = oneOf(ASSET_CLASSES);
const isAvailability = oneOf(AVAILABILITY);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => key in value);
};

export function parseAssetRef(input: unknown): AssetRef | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, ['mint', 'symbol', 'assetClass'])
  )
    return null;
  return isMint(input.mint) &&
    isTickerSymbol(input.symbol) &&
    isAssetClass(input.assetClass)
    ? (input as AssetRef)
    : null;
}

const parseNullableWhy = (value: unknown): value is WhyLine | null =>
  value === null || parseWhyLine(value) !== null;

/** `disabled` = flag off → the surface is absent. `unavailable` = one honest line. */
export type SurfaceOff<S extends string> = {
  schemaVersion: 1;
  surface: S;
  state: 'unavailable' | 'disabled';
  asOf: AsOf;
};

function parseOff<S extends string>(
  input: Record<string, unknown>,
  surface: S,
): SurfaceOff<S> | null {
  return input.surface === surface &&
    (input.state === 'unavailable' || input.state === 'disabled') &&
    isEpochMs(input.asOf) &&
    hasExactKeys(input, ['schemaVersion', 'surface', 'state', 'asOf'])
    ? (input as SurfaceOff<S>)
    : null;
}

function parseItems<T>(
  value: unknown,
  min: number,
  max: number,
  parse: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  const mints = new Set(
    out.map((item) => (item as { asset?: AssetRef }).asset?.mint ?? item),
  );
  return mints.size === out.length ? out : null;
}

export const DESK_STRIP_ITEMS = { min: 2, max: 5 } as const;

/**
 * One card of *What we're seeing*.
 * · `change24hPct` — `▲ 2.1%` / `▼ 0.4%` in ink, no red/green. `null` → no figure.
 * · `why` — exactly one line (the top-ranked). `null` → the card shows no line
 *   and nothing is invented.
 * · `held` — `null` → *Not held*. Shown at $0 too: the desk's read does not
 *   need a balance. **No card says buy**; the door is *Review ›*.
 */
export type DeskStripItem = {
  asset: AssetRef;
  change24hPct: Pct | null;
  why: WhyLine | null;
  held: { qty: Quantity } | null;
};

/**
 * `GET` payload for the strip. Independent of the balance: a failed balance
 * can sit beside a working strip and the reverse.
 * Order: held majors, then unheld majors, then held others, then the rest.
 */
export type DeskStripPayload =
  | {
      schemaVersion: 1;
      surface: 'desk_strip';
      state: 'ready';
      asOf: AsOf;
      items: DeskStripItem[];
    }
  | SurfaceOff<'desk_strip'>;

/** The strip's ordering, as a rank the item list must never decrease through. */
export function deskStripRank(item: DeskStripItem): number {
  const major = item.asset.assetClass === 'major';
  const held = item.held !== null;
  return major ? (held ? 0 : 1) : held ? 2 : 3;
}

function parseDeskStripItem(input: unknown): DeskStripItem | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, ['asset', 'change24hPct', 'why', 'held'])
  )
    return null;
  if (!parseAssetRef(input.asset)) return null;
  if (input.change24hPct !== null && !isPct(input.change24hPct)) return null;
  if (!parseNullableWhy(input.why)) return null;
  if (input.held !== null) {
    if (!isRecord(input.held) || !hasExactKeys(input.held, ['qty']))
      return null;
    if (!isQuantity(input.held.qty)) return null;
  }
  return input as DeskStripItem;
}

export function parseDeskStripPayload(input: unknown): DeskStripPayload | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null;
  if (input.state !== 'ready') return parseOff(input, 'desk_strip');
  if (
    input.surface !== 'desk_strip' ||
    !isEpochMs(input.asOf) ||
    !hasExactKeys(input, ['schemaVersion', 'surface', 'state', 'asOf', 'items'])
  )
    return null;
  const items = parseItems(
    input.items,
    DESK_STRIP_ITEMS.min,
    DESK_STRIP_ITEMS.max,
    parseDeskStripItem,
  );
  if (!items) return null;
  for (let i = 1; i < items.length; i++) {
    if (deskStripRank(items[i]) < deskStripRank(items[i - 1])) return null;
  }
  return input as DeskStripPayload;
}

export const MOVING_ORDERINGS = ['majors_first_then_move_size'] as const;
export type MovingOrdering = (typeof MOVING_ORDERINGS)[number];

export const MOVING_ITEMS = { min: 1, max: 50 } as const;

export type MovingItem = {
  asset: AssetRef;
  priceUsd: Money;
  change24hPct: Pct;
  why: WhyLine | null;
  availability: 'available';
};

export type MovingPayload =
  | {
      schemaVersion: 1;
      surface: 'moving';
      state: 'ready' | 'quiet';
      asOf: AsOf;
      ordering: MovingOrdering;
      items: MovingItem[];
    }
  | SurfaceOff<'moving'>;

function parseMovingItem(input: unknown): MovingItem | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      'asset',
      'priceUsd',
      'change24hPct',
      'why',
      'availability',
    ])
  )
    return null;
  return parseAssetRef(input.asset) &&
    isMoney(input.priceUsd) &&
    Number(input.priceUsd) > 0 &&
    isPct(input.change24hPct) &&
    parseNullableWhy(input.why) &&
    input.availability === 'available'
    ? (input as MovingItem)
    : null;
}

const moveSize = (item: MovingItem) => Math.abs(Number(item.change24hPct));

/** Majors first; after them, never a larger move below a smaller one. */
export function isMajorsFirstThenMoveSize(items: MovingItem[]): boolean {
  let seenOther = false;
  for (let i = 0; i < items.length; i++) {
    const major = items[i].asset.assetClass === 'major';
    if (major && seenOther) return false;
    if (!major) {
      if (seenOther && moveSize(items[i]) > moveSize(items[i - 1]))
        return false;
      seenOther = true;
    }
  }
  return true;
}

export function parseMovingPayload(input: unknown): MovingPayload | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null;
  if (input.state !== 'ready' && input.state !== 'quiet')
    return parseOff(input, 'moving');
  if (
    input.surface !== 'moving' ||
    !isEpochMs(input.asOf) ||
    !oneOf(MOVING_ORDERINGS)(input.ordering) ||
    !hasExactKeys(input, [
      'schemaVersion',
      'surface',
      'state',
      'asOf',
      'ordering',
      'items',
    ])
  )
    return null;
  const items = parseItems(
    input.items,
    MOVING_ITEMS.min,
    MOVING_ITEMS.max,
    parseMovingItem,
  );
  if (!items || !isMajorsFirstThenMoveSize(items)) return null;
  if (
    input.state === 'quiet' &&
    items.some((item) => item.asset.assetClass !== 'major')
  )
    return null;
  return input as MovingPayload;
}

export type ReviewWhyBlock =
  | { state: 'ready'; asOf: AsOf; lines: WhyLine[] }
  | { state: 'unavailable' | 'disabled' };

/**
 * The Review block for one asset, from the engine's response. Anything that
 * is not a ready `review` payload for exactly this mint is `unavailable`, and
 * a `disabled` response is `disabled`.
 */
export function reviewWhyBlockFor(
  response: WhyResponse | null,
  mint: string,
): ReviewWhyBlock {
  if (response?.state === 'disabled') return { state: 'disabled' };
  if (!response || response.surface !== 'review')
    return { state: 'unavailable' };
  const payload = response.items.find(
    (item) => item.subject.kind === 'asset' && item.subject.mint === mint,
  );
  if (!payload) return { state: 'unavailable' };
  if (payload.state === 'disabled') return { state: 'disabled' };
  if (payload.state !== 'ready') return { state: 'unavailable' };
  return { state: 'ready', asOf: payload.asOf, lines: payload.lines };
}

/** `featured` = the one excellent plan (lock: bias one). */
export const PLAN_TAGS = ['majors', 'balanced', 'stocks', 'featured'] as const;
export type PlanTag = (typeof PLAN_TAGS)[number];

export const PLAN_LEGS = { min: 1, max: 8 } as const;

/** Weights sum to 100. Rendered `50% cbBTC · 30% ETH · 20% SOL`. */
export type PlanLeg = { asset: AssetRef; weightPct: Share };

export type PlanCard = {
  planId: PlanId;
  tags: PlanTag[];
  legs: PlanLeg[];
  minimumUsd: Money;
  availability: Availability;
  why: WhyLine | null;
  commit: 'review';
};

export type PlansPayload =
  | {
      schemaVersion: 1;
      surface: 'plans';
      state: 'ready';
      asOf: AsOf;
      items: PlanCard[];
    }
  | SurfaceOff<'plans'>;

export type PlanDetailPayload =
  | {
      schemaVersion: 1;
      surface: 'plan_detail';
      state: 'ready';
      asOf: AsOf;
      plan: PlanCard;
      legChanges: { mint: Mint; change24hPct: Pct | null }[];
      cost: { networkEstimateUsd: Money };
      why: WhyPayload;
    }
  | SurfaceOff<'plan_detail'>;

function parsePlanLeg(input: unknown): PlanLeg | null {
  if (!isRecord(input) || !hasExactKeys(input, ['asset', 'weightPct']))
    return null;
  return parseAssetRef(input.asset) &&
    isShare(input.weightPct) &&
    Number(input.weightPct) > 0
    ? (input as PlanLeg)
    : null;
}

export function parsePlanCard(input: unknown): PlanCard | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      'planId',
      'tags',
      'legs',
      'minimumUsd',
      'availability',
      'why',
      'commit',
    ])
  )
    return null;
  if (!isPlanId(input.planId) || input.commit !== 'review') return null;
  const tags = input.tags;
  if (
    !Array.isArray(tags) ||
    !tags.every(oneOf(PLAN_TAGS)) ||
    new Set(tags).size !== tags.length
  )
    return null;
  const legs = parseItems(
    input.legs,
    PLAN_LEGS.min,
    PLAN_LEGS.max,
    parsePlanLeg,
  );
  if (!legs) return null;
  // Sum in hundredths so `33.33 + 33.33 + 33.34` is exact.
  const hundredths = legs.reduce(
    (sum, leg) => sum + Math.round(Number(leg.weightPct) * 100),
    0,
  );
  if (hundredths !== 10_000) return null;
  return isMoney(input.minimumUsd) &&
    isAvailability(input.availability) &&
    parseNullableWhy(input.why)
    ? (input as PlanCard)
    : null;
}

export function parsePlansPayload(input: unknown): PlansPayload | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null;
  if (input.state !== 'ready') return parseOff(input, 'plans');
  if (
    input.surface !== 'plans' ||
    !isEpochMs(input.asOf) ||
    !hasExactKeys(input, [
      'schemaVersion',
      'surface',
      'state',
      'asOf',
      'items',
    ]) ||
    !Array.isArray(input.items)
  )
    return null;
  const cards: PlanCard[] = [];
  for (const item of input.items) {
    const card = parsePlanCard(item);
    if (!card) return null;
    cards.push(card);
  }
  if (new Set(cards.map((card) => card.planId)).size !== cards.length)
    return null;
  // Exactly one featured plan whenever there are plans at all.
  const featured = cards.filter((card) => card.tags.includes('featured'));
  if (cards.length > 0 && featured.length !== 1) return null;
  return input as PlansPayload;
}

export function parsePlanDetailPayload(
  input: unknown,
): PlanDetailPayload | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null;
  if (input.state !== 'ready') return parseOff(input, 'plan_detail');
  if (
    input.surface !== 'plan_detail' ||
    !isEpochMs(input.asOf) ||
    !hasExactKeys(input, [
      'schemaVersion',
      'surface',
      'state',
      'asOf',
      'plan',
      'legChanges',
      'cost',
      'why',
    ])
  )
    return null;
  const plan = parsePlanCard(input.plan);
  if (!plan) return null;
  const changes = input.legChanges;
  if (!Array.isArray(changes) || changes.length !== plan.legs.length)
    return null;
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (!isRecord(change) || !hasExactKeys(change, ['mint', 'change24hPct']))
      return null;
    if (change.mint !== plan.legs[i].asset.mint) return null;
    if (change.change24hPct !== null && !isPct(change.change24hPct))
      return null;
  }
  const cost = input.cost;
  if (
    !isRecord(cost) ||
    !hasExactKeys(cost, ['networkEstimateUsd']) ||
    !isMoney(cost.networkEstimateUsd)
  )
    return null;
  const why = parseWhyPayload(input.why);
  if (
    !why ||
    why.surface !== 'plan' ||
    why.subject.kind !== 'plan' ||
    why.subject.planId !== plan.planId
  )
    return null;
  return input as PlanDetailPayload;
}

/** One side of the frozen quote: identity and units, no valuation. */
export type DetailsToken = {
  mint: Mint;
  symbol: TickerSymbol;
  decimals: number;
};

/**
 * *Quote you saw*: what the Review showed at confirm, in token units.
 * · `payAtomic` / `receiveAtomic` — the quoted amounts.
 * · `minReceivedAtomic` — *You get at least*.
 * · `feeBps` — the Corso fee on that quote, as quoted (not today's config).
 * · `maxSlippageBps` — *Price can move · up to 0.5%*. `null` = automatic.
 */
export type DetailsQuote = {
  pay: DetailsToken;
  receive: DetailsToken;
  payAtomic: AtomicAmount;
  receiveAtomic: AtomicAmount;
  minReceivedAtomic: AtomicAmount;
  feeBps: number;
  maxSlippageBps: number | null;
};

/**
 * *What you saw*: the why the Review showed, verbatim as codes + params.
 * `not_shown` = the tray was absent (flag off) or had not answered at confirm.
 */
export type DetailsWhy =
  | { state: 'ready'; asOf: AsOf; lines: WhyLine[] }
  | { state: 'unavailable' | 'not_shown' };

export type DetailsSnapshot = {
  schemaVersion: 1;
  capturedAt?: AsOf;
  templateVersion: number;
  side: 'buy' | 'sell';
  quote: DetailsQuote;
  why: DetailsWhy;
};

function parseDetailsToken(input: unknown): DetailsToken | null {
  if (!isRecord(input) || !hasExactKeys(input, ['mint', 'symbol', 'decimals']))
    return null;
  return isMint(input.mint) &&
    isTickerSymbol(input.symbol) &&
    isCount(input.decimals) &&
    input.decimals <= 18
    ? (input as DetailsToken)
    : null;
}

function parseDetailsQuote(input: unknown): DetailsQuote | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      'pay',
      'receive',
      'payAtomic',
      'receiveAtomic',
      'minReceivedAtomic',
      'feeBps',
      'maxSlippageBps',
    ])
  )
    return null;
  return parseDetailsToken(input.pay) &&
    parseDetailsToken(input.receive) &&
    isAtomicAmount(input.payAtomic) &&
    isAtomicAmount(input.receiveAtomic) &&
    isAtomicAmount(input.minReceivedAtomic) &&
    isCount(input.feeBps) &&
    input.feeBps <= 10_000 &&
    (input.maxSlippageBps === null ||
      (isCount(input.maxSlippageBps) && input.maxSlippageBps <= 10_000))
    ? (input as DetailsQuote)
    : null;
}

function parseDetailsWhy(input: unknown): DetailsWhy | null {
  if (!isRecord(input)) return null;
  if (input.state === 'unavailable' || input.state === 'not_shown')
    return hasExactKeys(input, ['state']) ? (input as DetailsWhy) : null;
  if (input.state !== 'ready') return null;
  if (
    !hasExactKeys(input, ['state', 'asOf', 'lines']) ||
    !isEpochMs(input.asOf)
  )
    return null;
  const { min, max } = WHY_SURFACES.review;
  const lines = input.lines;
  if (!Array.isArray(lines) || lines.length < min || lines.length > max)
    return null;
  if (!lines.every((line) => parseWhyLine(line) !== null)) return null;
  return input as DetailsWhy;
}

export function parseDetailsSnapshot(input: unknown): DetailsSnapshot | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null;
  const why = parseDetailsWhy(input.why);
  if (!why) return null;
  const ready = why.state === 'ready';
  if (
    !hasExactKeys(input, [
      'schemaVersion',
      ...(ready ? ['capturedAt'] : []),
      'templateVersion',
      'side',
      'quote',
      'why',
    ])
  )
    return null;
  if (ready && input.capturedAt !== why.asOf) return null;
  return isCount(input.templateVersion) &&
    input.templateVersion > 0 &&
    (input.side === 'buy' || input.side === 'sell') &&
    parseDetailsQuote(input.quote)
    ? (input as DetailsSnapshot)
    : null;
}

/** The Details `why` from the Review block shown at confirm. */
export function detailsWhyFrom(block: ReviewWhyBlock | null): DetailsWhy {
  if (block?.state === 'ready')
    return {
      state: 'ready',
      asOf: block.asOf,
      // A deep copy: nothing later done to the live block can reach the record.
      lines: JSON.parse(JSON.stringify(block.lines)) as WhyLine[],
    };
  return block?.state === 'unavailable'
    ? { state: 'unavailable' }
    : { state: 'not_shown' };
}
