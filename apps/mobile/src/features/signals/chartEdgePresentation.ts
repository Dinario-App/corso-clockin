import { copy } from '@/constants/copy';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import { colors } from '@/src/ui/tokens';
import { resolveChartCoverage } from './chartCoverage';
import {
  isSignalSliceFresh,
  signalSliceUnknownReason,
} from './signalSliceRead';
import type { ChartBundle, ConfluenceBand, SignalTimeframe } from './types';
import type { ChartBundleHookState } from './useChartBundle';

export type ChartEdgeConfluence = {
  score: number;
  band: ConfluenceBand;
  bandLabel: string;
  /** Tint for the band word + number only; the chip itself stays neutral. */
  tone: string;
  accessibilityLabel: string;
};

export type ChartEdgeStructure = {
  label: 'CHoCH' | 'CHoCH+' | 'BOS';
  direction: 'bull' | 'bear';
  /** Decimal string as shipped; the chart projects it, the row formats it. */
  price: string;
  priceText: string;
  barMs: number;
  text: string;
};

export type ChartEdgeZone = {
  kind: 'order_block' | 'fvg';
  side: 'bull' | 'bear' | null;
  top: string;
  bottom: string;
  label: string;
  rangeText: string;
  barMs: number;
};

export type ChartEdgeReadout =
  | {
      kind: 'off' | 'loading' | 'unavailable' | 'not_computed' | 'no_data';
      message: string;
    }
  | {
      kind: 'ready';
      timeframe: SignalTimeframe;
      confluence: ChartEdgeConfluence;
      structure: ChartEdgeStructure | null;
      zone: ChartEdgeZone | null;
      /** Honesty lines: thin / gappy / quiet coverage, dropped indicators. */
      honesty: string[];
    };

function confluenceTone(band: ConfluenceBand): string {
  switch (band) {
    case 'bull':
    case 'strong_bull':
      return colors.priceUp;
    case 'bear':
    case 'strong_bear':
      return colors.priceDown;
    default:
      return colors.ink;
  }
}

export function resolveChartEdgeConfluence(
  bundle: Pick<ChartBundle, 'confluence'>,
): ChartEdgeConfluence {
  const { score, band } = bundle.confluence;
  const bandLabel = copy.chartEdge.band[band];
  return {
    score,
    band,
    bandLabel,
    tone: confluenceTone(band),
    accessibilityLabel: copy.chartEdge.confluenceA11y(bandLabel, score),
  };
}

export type ChartReadFace =
  | (ChartEdgeConfluence & { kind: 'score' })
  | { kind: 'unknown'; label: string; reason: string };

/**
 * The terminal's band and score, through the same window as the chart card.
 * A bundle older than one bar plus the settle reads Unknown.
 */
export function resolveChartReadFace(input: {
  bundle: Pick<ChartBundle, 'confluence' | 'asOfMs' | 'timeframe'> | null;
  nowMs: number;
}): ChartReadFace | null {
  if (input.bundle == null) return null;
  const fresh = isSignalSliceFresh({
    asOfMs: input.bundle.asOfMs,
    timeframe: input.bundle.timeframe,
    nowMs: input.nowMs,
  });
  if (!fresh) {
    return {
      kind: 'unknown',
      label: copy.tokenFacts.unknown,
      reason: signalSliceUnknownReason({
        asOfMs: input.bundle.asOfMs,
        timeframe: input.bundle.timeframe,
        nowMs: input.nowMs,
      }),
    };
  }
  return { kind: 'score', ...resolveChartEdgeConfluence(input.bundle) };
}

/** The most recent structure mark the server shipped, or null. */
export function resolveLatestStructure(
  overlays: ChartBundle['overlays'],
): ChartEdgeStructure | null {
  let latest: ChartBundle['overlays']['structure'][number] | null = null;
  for (const mark of overlays.structure) {
    if (latest == null || mark.barMs > latest.barMs) latest = mark;
  }
  if (latest == null) return null;
  const priceText = formatPriceUsd(latest.price);
  if (priceText == null) return null;
  return {
    label: latest.label,
    direction: latest.direction,
    price: latest.price,
    priceText,
    barMs: latest.barMs,
    text: `${copy.chartEdge.structure(latest.label, latest.direction)} ${copy.chartEdge.structureAt(priceText)}`,
  };
}

function distanceToBand(
  close: number,
  top: number,
  bottom: number,
): number | null {
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
  const hi = Math.max(top, bottom);
  const lo = Math.min(top, bottom);
  if (close >= lo && close <= hi) return 0;
  return Math.min(Math.abs(close - hi), Math.abs(close - lo));
}

/**
 * The nearest active zone to the last close: order blocks and unfilled
 * fair-value gaps compete on price distance; a tie goes to the newer bar.
 */
export function resolveNearestZone(
  bundle: Pick<ChartBundle, 'overlays' | 'candles'>,
): ChartEdgeZone | null {
  const last = bundle.candles.at(-1);
  if (!last) return null;
  const close = Number(last.c);
  if (!Number.isFinite(close)) return null;

  type Candidate = ChartEdgeZone & { distance: number };
  const candidates: Candidate[] = [];
  for (const block of bundle.overlays.orderBlocks) {
    const distance = distanceToBand(
      close,
      Number(block.top),
      Number(block.bottom),
    );
    if (distance == null) continue;
    const bottomText = formatPriceUsd(block.bottom);
    const topText = formatPriceUsd(block.top);
    if (bottomText == null || topText == null) continue;
    candidates.push({
      kind: 'order_block',
      side: block.side,
      top: block.top,
      bottom: block.bottom,
      label:
        block.side === 'bull'
          ? copy.chartEdge.demandBlock
          : copy.chartEdge.supplyBlock,
      rangeText: copy.chartEdge.zoneRange(bottomText, topText),
      barMs: block.barMs,
      distance,
    });
  }
  for (const gap of bundle.overlays.fvg) {
    if (gap.filled) continue;
    const distance = distanceToBand(close, Number(gap.top), Number(gap.bottom));
    if (distance == null) continue;
    const bottomText = formatPriceUsd(gap.bottom);
    const topText = formatPriceUsd(gap.top);
    if (bottomText == null || topText == null) continue;
    candidates.push({
      kind: 'fvg',
      side: null,
      top: gap.top,
      bottom: gap.bottom,
      label: copy.chartEdge.fairValueGap,
      rangeText: copy.chartEdge.zoneRange(bottomText, topText),
      barMs: gap.barMs,
      distance,
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance || b.barMs - a.barMs);
  const { distance: _distance, ...nearest } = candidates[0]!;
  return nearest;
}

export function resolveChartEdgeReadout(input: {
  enabled: boolean;
  chart: Pick<ChartBundleHookState, 'status' | 'bundle' | 'errorCode'>;
  timeframe: SignalTimeframe;
  nowMs: number;
}): ChartEdgeReadout {
  const { chart, timeframe } = input;
  if (!input.enabled || chart.status === 'disabled') {
    return { kind: 'off', message: copy.chartEdge.off };
  }
  if (chart.status === 'not_computed') {
    return {
      kind: 'not_computed',
      message: copy.chartEdge.notComputed(timeframe),
    };
  }
  if (chart.status === 'unavailable') {
    return chart.errorCode === 'no_data'
      ? { kind: 'no_data', message: copy.chartEdge.noData(timeframe) }
      : { kind: 'unavailable', message: copy.chartEdge.unavailable };
  }
  const bundle = chart.bundle;
  if (chart.status !== 'ready' || bundle == null) {
    return { kind: 'loading', message: copy.chartEdge.loading };
  }
  // A bundle for another pill never reads under this one (plan 09a).
  if (bundle.timeframe !== timeframe) {
    return { kind: 'loading', message: copy.chartEdge.loading };
  }

  const coverage = resolveChartCoverage({
    timeframe: bundle.timeframe,
    candles: bundle.candles,
    asOfMs: bundle.asOfMs,
    nowMs: input.nowMs,
  });
  const honesty: string[] = [];
  if (coverage.thin) honesty.push(copy.chartEdge.thin(coverage.bars));
  if (coverage.gappy)
    honesty.push(copy.fullChart.coverage.gaps(coverage.missingBars));
  if (coverage.quiet)
    honesty.push(
      copy.fullChart.coverage.quiet(
        coverage.quietIntervals,
        copy.fullChart.barName(coverage.barMs),
      ),
    );
  if (bundle.degraded.length > 0)
    honesty.push(copy.fullChart.degraded(bundle.degraded.length));

  return {
    kind: 'ready',
    timeframe: bundle.timeframe,
    confluence: resolveChartEdgeConfluence(bundle),
    structure: resolveLatestStructure(bundle.overlays),
    zone: resolveNearestZone(bundle),
    honesty,
  };
}

/**
 * Marks the native line can paint on its own price scale. Levels or bands
 * outside the drawn window are dropped, not clamped — a mark pinned to the
 * chart edge would claim a price the window never showed.
 */
export type ChartLineMarks = {
  level: { price: string; label: string } | null;
  band: { top: string; bottom: string; label: string } | null;
};

export function resolveChartLineMarks(
  readout: ChartEdgeReadout,
): ChartLineMarks {
  if (readout.kind !== 'ready') return { level: null, band: null };
  return {
    level: readout.structure
      ? { price: readout.structure.price, label: readout.structure.label }
      : null,
    band: readout.zone
      ? {
          top: readout.zone.top,
          bottom: readout.zone.bottom,
          label: readout.zone.label,
        }
      : null,
  };
}

/** Project a decimal price onto the drawn scale; `null` when off-window. */
export function projectPriceOnScale(
  price: string,
  scale: { min: number; max: number; yAtMax: number; yAtMin: number },
): number | null {
  const value = Number(price);
  if (!Number.isFinite(value)) return null;
  if (value < scale.min || value > scale.max) return null;
  const span = scale.max - scale.min;
  if (span <= 0) return scale.yAtMax;
  return (
    scale.yAtMax + ((scale.max - value) / span) * (scale.yAtMin - scale.yAtMax)
  );
}
