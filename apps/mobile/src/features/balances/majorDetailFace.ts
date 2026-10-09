import { copy } from '@/constants/copy';
import { BALANCE_MASK } from '@/src/ui/format/balanceMask';
import type { DeltaDirection } from '@/src/ui/ethena/deltaInk';
import { formatAtomicAmount } from '@/src/features/swap/tokens';
import { formatFiatAmount, formatPriceUsd } from '@/src/ui/format/numberCraft';
import {
  formatFiatMinor,
  parseDecimalPrice,
  type FiatLineReason,
  type FiatTotalStatus,
  type HoldingsSnapshot,
  type PriceQuote,
} from './computeFiatTotal';
import { readHeldBalance, type HoldingsBook } from './holdingsBook';
import { classifyHolding, getMajorAsset } from './majors';

export const BOOK_SET_PILLS = ['1D', '1W', '1M', '6M', '1Y', 'All'] as const;
export type BookSetPill = (typeof BOOK_SET_PILLS)[number];

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** A point this far before the 24h mark is not a 24h close. */
const PRIOR_CLOSE_SLACK_MS = 2 * HOUR_MS;

const REQUESTED_MS: Record<Exclude<BookSetPill, 'All'>, number> = {
  '1D': DAY_MS,
  '1W': 7 * DAY_MS,
  '1M': 30 * DAY_MS,
  '6M': 182 * DAY_MS,
  '1Y': 365 * DAY_MS,
};

export const HERO_BASE_FONT = 40;
export const HERO_GUTTER = 16;
export const HERO_MARK = 48;
export const HERO_GAP = 12;
const HERO_MIN_FONT = 11;
/** Overestimates Inter tabular width so the chosen size still fits on device. */
const HERO_EM = 0.7;

export type SpineFiatLine = {
  mint: string;
  fiatAmount: string | null;
  priced: boolean;
  reason?: FiatLineReason | string;
};

export type SpineDoor = { shown: boolean; disabled: boolean };

export type SpineDetailModel = {
  displayName: string;
  symbol: string;
  eyebrowText: string;
  heroText: string;
  qtyText: string | null;
  deltaLine: string | null;
  deltaDirection: DeltaDirection;
  staleLine: string | null;
  shareText: string | null;
  wrapperText: string | null;
  floorNote: string | null;
  buy: SpineDoor;
  sell: SpineDoor;
  spanLabel: string;
  selectedPill: BookSetPill;
  priceUnavailable: boolean;
  explainShown: boolean;
};

export function heroContentWidth(screenWidth: number): number {
  return Math.max(0, screenWidth - HERO_GUTTER * 2 - HERO_MARK - HERO_GAP);
}

export function resolveHeroFontSize(args: {
  text: string;
  fontScale: number;
  screenWidth: number;
}): number {
  const width = heroContentWidth(args.screenWidth);
  const scale =
    Number.isFinite(args.fontScale) && args.fontScale > 0 ? args.fontScale : 1;
  let size = HERO_BASE_FONT * scale;
  while (size > HERO_MIN_FONT && args.text.length * size * HERO_EM > width) {
    size -= 0.5;
  }
  return size;
}

export function shareOfBook(args: {
  mint: string;
  status: FiatTotalStatus;
  lines: readonly SpineFiatLine[];
}): string | null {
  if (args.status !== 'fully_priced') return null;
  const included = args.lines.filter((line) => line.reason !== 'excluded');
  if (included.length === 0) return null;
  if (included.some((line) => !line.priced || line.fiatAmount == null))
    return null;

  let total = 0n;
  let position: bigint | null = null;
  for (const line of included) {
    const cents = centsOf(line.fiatAmount);
    if (cents == null) return null;
    total += cents;
    if (line.mint === args.mint) position = (position ?? 0n) + cents;
  }
  if (position == null || position <= 0n || total <= 0n) return null;
  const tenths = (position * 1000n) / total;
  return formatTenthsPercent(tenths);
}

/** Median positive step. A uniform provider run reports its own bar width. */
export function seriesBarMs(
  points: readonly { timestampMs: number }[],
): number | null {
  const ordered = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
  const diffs: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const diff = ordered[i]!.timestampMs - ordered[i - 1]!.timestampMs;
    if (diff > 0 && Number.isFinite(diff)) diffs.push(diff);
  }
  if (diffs.length === 0) return null;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor((diffs.length - 1) / 2)]!;
}

export function labelBookSetSpan(
  pill: BookSetPill,
  firstMs: number | null,
  lastMs: number | null,
  barMs: number | null = null,
): string {
  if (
    firstMs == null ||
    lastMs == null ||
    !Number.isFinite(firstMs) ||
    !Number.isFinite(lastMs)
  ) {
    return pill;
  }
  if (lastMs < firstMs) return pill;
  const span = lastMs - firstMs;
  // The last timestamp is the open bar. Its close is one bar later, so a
  // full provider window measures one bar short if only the opens are counted.
  const bar = barMs != null && Number.isFinite(barMs) && barMs > 0 ? barMs : 0;
  const covered = span + bar;
  const requested = pill === 'All' ? null : REQUESTED_MS[pill];
  const short = requested == null || covered + 60_000 < requested;
  if (!short) return pill;
  return `${pill} · ${spanPhrase(span)}`;
}

export function bookSetFetchRange(
  pill: BookSetPill,
): '1D' | '1W' | '1M' | 'ALL' {
  if (pill === '1D' || pill === '1W' || pill === '1M') return pill;
  return 'ALL';
}

export function bookSetChartState(
  state: {
    status: 'idle' | 'loading' | 'ready' | 'unavailable';
    series: readonly { timestampMs: number; priceUsd: string }[] | null;
    source: string | null;
    coverageKind: 'top_indexed_pool' | 'token_aggregated' | null;
    poolAddress: string | null;
    liquidityUsd: string | null;
    volume24hUsd: string | null;
    marketDataAsOfMs: number | null;
  },
  pill: BookSetPill,
  nowMs: number,
) {
  if (state.series == null) return { ...state, series: null };
  const sliced = sliceBookSetPoints(state.series, pill, nowMs);
  const shown = sliced.length > 0 ? sliced : state.series;
  return { ...state, series: [...shown] };
}

export function sliceBookSetPoints<T extends { timestampMs: number }>(
  points: readonly T[],
  pill: BookSetPill,
  nowMs: number,
): T[] {
  if (pill === 'All') return [...points];
  const start = nowMs - REQUESTED_MS[pill];
  return points.filter(
    (point) => point.timestampMs >= start && point.timestampMs <= nowMs,
  );
}

export function priceThenFromSeries(
  points: readonly { timestampMs: number; priceUsd: string }[],
  nowMs: number,
): string | null {
  const target = nowMs - DAY_MS;
  let chosen: { timestampMs: number; priceUsd: string } | null = null;
  for (const point of points) {
    if (point.timestampMs <= target) chosen = point;
  }
  if (chosen) {
    if (target - chosen.timestampMs > PRIOR_CLOSE_SLACK_MS) return null;
    return chosen.priceUsd;
  }
  // A full provider day ends on the open bar, so its first open sits inside
  // the 24h mark by at most one bar. A shorter run does not.
  if (points.length === 0) return null;
  const ordered = [...points].sort((a, b) => a.timestampMs - b.timestampMs);
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const bar = seriesBarMs(ordered);
  if (bar == null || bar <= 0) return null;
  const after = first.timestampMs - target;
  if (after < 0 || after > bar) return null;
  const covered = last.timestampMs + bar - first.timestampMs;
  if (covered + 60_000 < DAY_MS) return null;
  return first.priceUsd;
}

export function isSpineDetailMint(args: {
  mint: string;
  holdings: HoldingsSnapshot | null;
}): boolean {
  if (getMajorAsset(args.mint)) return true;
  const holdings = args.holdings;
  if (holdings?.quantityStatus !== 'ready') return false;
  if (!holdings) return false;
  const line = holdings.lines.find((candidate) => candidate.mint === args.mint);
  if (!line) return false;
  let atomic: bigint;
  try {
    atomic = BigInt(line.atomic);
  } catch {
    return false;
  }
  if (atomic <= 0n) return false;
  return classifyHolding(line, holdings.cluster) === 'sleeve';
}

export function resolveSpineDetailDecimals(args: {
  mint: string;
  holdings: HoldingsSnapshot | null;
}): number | null {
  const major = getMajorAsset(args.mint);
  if (major) return major.decimals;
  const line = args.holdings?.lines.find(
    (candidate) => candidate.mint === args.mint,
  );
  return line?.decimals ?? null;
}

export function presentSpineDetail(args: {
  mint: string;
  symbol: string;
  displayName: string;
  /** Null when no source knows them: no quantity and no position is drawn. */
  decimals: number | null;
  book: HoldingsBook;
  quote: PriceQuote | null | undefined;
  nowMs: number;
  fiatStatus: FiatTotalStatus;
  fiatLines: readonly SpineFiatLine[];
  priceThen: string | null;
  pill: BookSetPill;
  chartFirstMs: number | null;
  chartLastMs: number | null;
  /** Width of the bar the shown series actually uses. Null keeps open-to-open. */
  chartBarMs?: number | null;
  swapDirections: readonly ('buy' | 'sell')[];
  swapsOff: boolean;
  sellWithheldNote: string | null;
  hideBalances?: boolean;
}): SpineDetailModel {
  const asset = getMajorAsset(args.mint);
  const symbol = asset?.symbol ?? args.symbol;
  const displayName = asset?.displayName ?? args.displayName;
  const read = readHeldBalance(args.book, args.mint);
  const knownHeld = read.known && read.atomic > 0n;
  const loading = args.book.status === 'loading';
  const refused = args.book.status === 'error';
  const freshness = quoteFreshness(args.quote, args.mint, args.nowMs);
  const priceText =
    (freshness === 'ok' || freshness === 'stale') && args.quote
      ? formatPriceUsd(args.quote.price)
      : null;

  let eyebrowText: string = copy.majorDetail.eyebrowPrice;
  let heroText: string = copy.majorDetail.priceUnavailable;
  let qtyText: string | null = null;
  let delta: PositionDelta | null = null;
  let shareText: string | null = null;

  if (loading) {
    heroText = copy.majorDetail.loading;
  } else if (refused) {
    heroText = priceText ?? copy.majorDetail.priceUnavailable;
  } else if (
    knownHeld &&
    freshness === 'ok' &&
    args.quote &&
    read.known &&
    args.decimals != null
  ) {
    const fiat = floorFiatText(read.atomic, args.decimals, args.quote.price);
    if (fiat) {
      eyebrowText = copy.majorDetail.eyebrowPosition;
      heroText = fiat;
      qtyText = `${formatAtomicAmount(read.atomic.toString(), args.decimals)} ${symbol}`;
      delta = positionDelta({
        atomic: read.atomic,
        decimals: args.decimals,
        symbol,
        priceNow: args.quote.price,
        priceThen: args.priceThen,
      });
      shareText = shareOfBook({
        mint: args.mint,
        status: args.fiatStatus,
        lines: args.fiatLines,
      });
      if (args.hideBalances === true) {
        heroText = BALANCE_MASK;
        qtyText = BALANCE_MASK;
        delta = positionDelta({
          atomic: null,
          symbol,
          priceNow: args.quote.price,
          priceThen: args.priceThen,
        });
        shareText = shareText === null ? null : BALANCE_MASK;
      }
    }
  } else if (priceText && args.quote) {
    heroText = priceText;
    if (freshness === 'ok') {
      delta = positionDelta({
        atomic: null,
        symbol,
        priceNow: args.quote.price,
        priceThen: args.priceThen,
      });
    }
  }

  const staleLine =
    freshness === 'stale' && args.quote
      ? `${copy.majorDetail.priceStale} · ${agePhrase(args.nowMs - args.quote.asOfMs)}`
      : null;
  if (freshness === 'stale') delta = null;

  const doors = doorsFor({
    loading,
    refused,
    knownHeld,
    swapsOff: args.swapsOff,
    swapDirections: args.swapDirections,
    sellWithheldNote: args.sellWithheldNote,
  });

  return {
    displayName,
    symbol,
    eyebrowText,
    heroText,
    qtyText,
    deltaLine: delta?.line ?? null,
    deltaDirection: delta?.direction ?? null,
    staleLine,
    shareText,
    wrapperText: wrapperText(args.mint),
    floorNote: doors.floorNote,
    buy: doors.buy,
    sell: doors.sell,
    spanLabel: labelBookSetSpan(
      args.pill,
      args.chartFirstMs,
      args.chartLastMs,
      args.chartBarMs ?? null,
    ),
    selectedPill: args.pill,
    priceUnavailable: heroText === copy.majorDetail.priceUnavailable,
    explainShown: !loading,
  };
}

function doorsFor(args: {
  loading: boolean;
  refused: boolean;
  knownHeld: boolean;
  swapsOff: boolean;
  swapDirections: readonly ('buy' | 'sell')[];
  sellWithheldNote: string | null;
}): { buy: SpineDoor; sell: SpineDoor; floorNote: string | null } {
  if (args.swapsOff) {
    return {
      buy: { shown: false, disabled: true },
      sell: { shown: false, disabled: true },
      floorNote: copy.majorDetail.swapsUnavailable,
    };
  }
  const buyReady = args.swapDirections.includes('buy');
  if (args.loading) {
    return {
      buy: { shown: true, disabled: true },
      sell: { shown: true, disabled: true },
      floorNote: null,
    };
  }
  if (args.refused) {
    return {
      buy: { shown: true, disabled: !buyReady },
      sell: { shown: true, disabled: true },
      floorNote: copy.majorDetail.bookUnavailable,
    };
  }
  if (!args.knownHeld) {
    return {
      buy: { shown: true, disabled: !buyReady },
      sell: { shown: false, disabled: true },
      floorNote: null,
    };
  }
  const canSell = args.swapDirections.includes('sell');
  return {
    buy: { shown: true, disabled: !buyReady },
    sell: { shown: canSell, disabled: !canSell },
    floorNote: canSell ? null : args.sellWithheldNote,
  };
}

type PositionDelta = { line: string; direction: DeltaDirection };

function positionDelta(
  args: (
    | { atomic: bigint; decimals: number }
    | { atomic: null; decimals?: undefined }
  ) & {
    symbol: string;
    priceNow: string;
    priceThen: string | null;
  },
): PositionDelta | null {
  if (!args.priceThen) return null;
  const tenths = changeTenths(args.priceNow, args.priceThen);
  if (tenths == null) return null;
  const nowMinor =
    args.atomic == null
      ? floorPriceMinor(args.priceNow)
      : floorMinor(args.atomic, args.decimals, args.priceNow);
  const thenMinor =
    args.atomic == null
      ? floorPriceMinor(args.priceThen)
      : floorMinor(args.atomic, args.decimals, args.priceThen);
  if (nowMinor == null || thenMinor == null) return null;
  const diff = nowMinor - thenMinor;
  const dollars = formatFiatAmount(formatFiatMinor(diff < 0n ? -diff : diff));
  if (!dollars) return null;
  const glyph = diff < 0n || tenths < 0n ? '▼' : '▲';
  const tail =
    args.atomic == null
      ? copy.majorDetail.window24h
      : `${formatAtomicAmount(args.atomic.toString(), args.decimals)} ${args.symbol}`;
  return {
    line: `${glyph} ${dollars} · ${formatTenthsPercent(tenths < 0n ? -tenths : tenths)} · ${tail}`,
    // The glyph's direction, except a line whose figures both print zero.
    direction:
      glyph === '▼'
        ? 'down'
        : diff === 0n && tenths === 0n
          ? 'flat'
          : 'up',
  };
}

function floorFiatText(
  atomic: bigint,
  decimals: number,
  price: string,
): string | null {
  const minor = floorMinor(atomic, decimals, price);
  if (minor == null) return null;
  return formatFiatAmount(formatFiatMinor(minor));
}

function floorMinor(
  atomic: bigint,
  decimals: number,
  price: string,
): bigint | null {
  const parsed = parseDecimalPrice(price);
  if (!parsed || atomic < 0n) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return null;
  const denominator = 10n ** BigInt(decimals) * 10n ** BigInt(parsed.scale);
  if (denominator === 0n) return null;
  return (atomic * parsed.numerator * 100n) / denominator;
}

function floorPriceMinor(price: string): bigint | null {
  const parsed = parseDecimalPrice(price);
  if (!parsed) return null;
  const denominator = 10n ** BigInt(parsed.scale);
  if (denominator === 0n) return null;
  return (parsed.numerator * 100n) / denominator;
}

function changeTenths(now: string, then: string): bigint | null {
  const left = parseDecimalPrice(now);
  const right = parseDecimalPrice(then);
  if (!left || !right || right.numerator === 0n) return null;
  const delta =
    left.numerator * 10n ** BigInt(right.scale) -
    right.numerator * 10n ** BigInt(left.scale);
  const base = right.numerator * 10n ** BigInt(left.scale);
  if (base === 0n) return null;
  return (delta * 1000n) / base;
}

function formatTenthsPercent(tenths: bigint): string {
  const whole = tenths / 10n;
  const frac = tenths % 10n;
  return `${whole.toString()}.${frac.toString()}%`;
}

function centsOf(amount: string | null): bigint | null {
  if (!amount) return null;
  const match = /^(\d+)\.(\d{2})$/.exec(amount);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt(match[2]);
}

function spanPhrase(spanMs: number): string {
  const days = Math.floor(spanMs / DAY_MS);
  if (days >= 1) {
    return days === 1
      ? `1 ${copy.majorDetail.spanDay}`
      : `${days} ${copy.majorDetail.spanDays}`;
  }
  const hours = Math.max(1, Math.floor(spanMs / HOUR_MS));
  return hours === 1
    ? `1 ${copy.majorDetail.spanHour}`
    : `${hours} ${copy.majorDetail.spanHours}`;
}

function agePhrase(ageMs: number): string {
  const minutes = Math.floor(Math.max(0, ageMs) / 60_000);
  if (minutes < 1) return copy.majorDetail.ageUnderMinuteAgo;
  if (minutes < 60) return copy.majorDetail.ageMinutesAgo(minutes);
  return copy.majorDetail.ageHoursAgo(Math.floor(minutes / 60));
}

function wrapperText(mint: string): string | null {
  switch (getMajorAsset(mint)?.wrapperDisclosureKey) {
    case 'majorDetail.wrapperCbBtc':
      return copy.majorDetail.wrapperCbBtc;
    case 'majorDetail.wrapperEthPortal':
      return copy.majorDetail.wrapperEthPortal;
    case 'majorDetail.wrapperZecOmniBridge':
      return copy.majorDetail.wrapperZecOmniBridge;
    default:
      return null;
  }
}

function quoteFreshness(
  quote: PriceQuote | null | undefined,
  mint: string,
  nowMs: number,
): 'missing' | 'bad' | 'stale' | 'ok' {
  if (quote == null) return 'missing';
  if (quote.mint !== mint) return 'bad';
  if (typeof quote.price !== 'string' || !parseDecimalPrice(quote.price))
    return 'bad';
  if (
    typeof quote.asOfMs !== 'number' ||
    !Number.isFinite(quote.asOfMs) ||
    quote.asOfMs < 0 ||
    typeof quote.maxAgeMs !== 'number' ||
    !Number.isFinite(quote.maxAgeMs) ||
    quote.maxAgeMs < 0
  ) {
    return 'bad';
  }
  if (nowMs - quote.asOfMs > quote.maxAgeMs) return 'stale';
  return 'ok';
}
