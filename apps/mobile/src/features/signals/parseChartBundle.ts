import {
  CHART_BUNDLE_SOURCES,
  CONFLUENCE_BANDS,
  SIGNAL_KINDS,
  isSignalTimeframe,
  type ChartBundle,
  type ChartBundleCandle,
  type ChartBundleOverlays,
  type ChartBundleSource,
  type ConfluenceBand,
  type ConfluenceScore,
  type SignalKind,
} from './types';

export const CHART_BUNDLE_MAX_CANDLES = 512;

const DECIMAL = /^-?(?:\d+)(?:\.\d+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite, non-negative decimal string — no exponent, no NaN, no float noise. */
function isDecimalString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    DECIMAL.test(value) &&
    Number.isFinite(Number(value))
  );
}

function isMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function parseCandle(raw: unknown): ChartBundleCandle | null {
  if (!isRecord(raw)) return null;
  const { t, o, h, l, c, v } = raw;
  if (!isMs(t)) return null;
  if (
    !isDecimalString(o) ||
    !isDecimalString(h) ||
    !isDecimalString(l) ||
    !isDecimalString(c)
  ) {
    return null;
  }
  if (!isDecimalString(v)) return null;
  const high = Number(h);
  const low = Number(l);
  if (high < low || Number(o) < 0 || Number(c) < 0 || low < 0) return null;
  return { t, o, h, l, c, v };
}

function parseCandles(raw: unknown): ChartBundleCandle[] | null {
  if (
    !Array.isArray(raw) ||
    raw.length < 2 ||
    raw.length > CHART_BUNDLE_MAX_CANDLES
  )
    return null;
  const out: ChartBundleCandle[] = [];
  let lastT = 0;
  for (const item of raw) {
    const candle = parseCandle(item);
    if (!candle || candle.t <= lastT) return null; // strictly ascending
    lastT = candle.t;
    out.push(candle);
  }
  return out;
}

function parseZone(
  raw: unknown,
): { top: string; bottom: string; barMs: number } | null {
  if (!isRecord(raw)) return null;
  if (
    !isDecimalString(raw.top) ||
    !isDecimalString(raw.bottom) ||
    !isMs(raw.barMs)
  )
    return null;
  if (Number(raw.top) < Number(raw.bottom)) return null;
  return { top: raw.top, bottom: raw.bottom, barMs: raw.barMs };
}

function parseOverlays(raw: unknown): ChartBundleOverlays | null {
  if (!isRecord(raw)) return null;
  const { orderBlocks, fvg, liquidity, structure, premiumDiscount } = raw;
  if (![orderBlocks, fvg, liquidity, structure].every(Array.isArray))
    return null;

  const out: ChartBundleOverlays = {
    orderBlocks: [],
    fvg: [],
    liquidity: [],
    structure: [],
  };

  for (const item of orderBlocks as unknown[]) {
    const zone = parseZone(item);
    const side = isRecord(item) ? item.side : undefined;
    if (!zone || (side !== 'bull' && side !== 'bear')) return null;
    out.orderBlocks.push({ ...zone, side });
  }
  for (const item of fvg as unknown[]) {
    const zone = parseZone(item);
    const filled = isRecord(item) ? item.filled : undefined;
    if (!zone || typeof filled !== 'boolean') return null;
    out.fvg.push({ ...zone, filled });
  }
  for (const item of liquidity as unknown[]) {
    if (!isRecord(item) || !isDecimalString(item.level) || !isMs(item.barMs))
      return null;
    const kind = item.kind;
    if (kind !== 'eqh' && kind !== 'eql' && kind !== 'sweep') return null;
    out.liquidity.push({ level: item.level, kind, barMs: item.barMs });
  }
  for (const item of structure as unknown[]) {
    if (!isRecord(item) || !isDecimalString(item.price) || !isMs(item.barMs))
      return null;
    const label = item.label;
    const direction = item.direction;
    if (label !== 'CHoCH' && label !== 'CHoCH+' && label !== 'BOS') return null;
    if (direction !== 'bull' && direction !== 'bear') return null;
    out.structure.push({
      label,
      direction,
      barMs: item.barMs,
      price: item.price,
    });
  }
  if (premiumDiscount !== undefined) {
    if (
      !isRecord(premiumDiscount) ||
      !isDecimalString(premiumDiscount.premium) ||
      !isDecimalString(premiumDiscount.equilibrium) ||
      !isDecimalString(premiumDiscount.discount)
    ) {
      return null;
    }
    out.premiumDiscount = {
      premium: premiumDiscount.premium,
      equilibrium: premiumDiscount.equilibrium,
      discount: premiumDiscount.discount,
    };
  }
  return out;
}

function parseConfluence(raw: unknown): ConfluenceScore | null {
  if (!isRecord(raw)) return null;
  const { score, band, contributors } = raw;
  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 100
  )
    return null;
  if (
    typeof band !== 'string' ||
    !(CONFLUENCE_BANDS as readonly string[]).includes(band)
  )
    return null;
  if (!Array.isArray(contributors)) return null;
  const parsed: ConfluenceScore['contributors'] = [];
  for (const item of contributors) {
    if (!isRecord(item)) return null;
    const { kind, weight, contribution } = item;
    if (
      typeof kind !== 'string' ||
      !(SIGNAL_KINDS as readonly string[]).includes(kind)
    )
      return null;
    if (typeof weight !== 'number' || !Number.isFinite(weight)) return null;
    if (typeof contribution !== 'number' || !Number.isFinite(contribution))
      return null;
    parsed.push({ kind: kind as SignalKind, weight, contribution });
  }
  return { score, band: band as ConfluenceBand, contributors: parsed };
}

function parseDegraded(raw: unknown): SignalKind[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SignalKind[] = [];
  for (const item of raw) {
    if (
      typeof item !== 'string' ||
      !(SIGNAL_KINDS as readonly string[]).includes(item)
    )
      return null;
    out.push(item as SignalKind);
  }
  return out;
}

/**
 * Parse the `ok: true` body of `/v1/chart-bundle`. Returns `null` for anything
 * off-contract. The caller still checks `mint` against what it asked for.
 */
export function parseChartBundle(raw: unknown): ChartBundle | null {
  if (!isRecord(raw) || raw.ok !== true) return null;
  const { mint, timeframe, range, source, asOfMs } = raw;
  if (typeof mint !== 'string' || mint.length === 0) return null;
  if (!isSignalTimeframe(timeframe)) return null;
  if (typeof range !== 'string' || range.length === 0 || range.length > 8)
    return null;
  if (
    typeof source !== 'string' ||
    !(CHART_BUNDLE_SOURCES as readonly string[]).includes(source)
  ) {
    return null;
  }
  if (!isMs(asOfMs)) return null;
  const candles = parseCandles(raw.candles);
  if (!candles) return null;
  // The server's asOf is the last closed bar's close; it can never precede the
  // last bar's open. Anything else is a mixed or stale series — refuse it.
  if (asOfMs < candles[candles.length - 1]!.t) return null;
  const overlays = parseOverlays(raw.overlays);
  if (!overlays) return null;
  const confluence = parseConfluence(raw.confluence);
  if (!confluence) return null;
  const degraded = parseDegraded(raw.degraded);
  if (!degraded) return null;
  return {
    mint,
    timeframe,
    range,
    source: source as ChartBundleSource,
    asOfMs,
    candles,
    overlays,
    confluence,
    degraded,
  };
}
