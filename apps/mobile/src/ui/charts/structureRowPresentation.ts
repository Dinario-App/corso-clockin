import { copy } from '@/constants/copy';
import { resolveFullChartRouteGuard } from '@/src/features/signals/fullChartRouteGuard';
import {
  isSignalSliceFresh,
  signalSliceUnknownReason,
} from '@/src/features/signals/signalSliceRead';
import {
  resolveChartEdgeReadout,
  resolveLatestStructure,
  resolveNearestZone,
} from '@/src/features/signals/chartEdgePresentation';
import type { TokenVitalsConfig } from '@/src/lib/apiConfig';
import type {
  ChartBundle,
  ConfluenceScore,
  SignalKind,
} from '@/src/features/signals/types';
import type { ChartBundleHookState } from '@/src/features/signals/useChartBundle';
import type { LatestSignalPresentation } from '@/src/features/signals/useLatestSignal';
import { priceChartCardContentWidth } from '@/src/features/prices/usePriceChartSeries';
import { kitType } from '@/src/ui/tokens';
import { formatChartPriceUsd, formatChartZoneUsd } from './chartPriceFormat';

export const STRUCTURE_ROW = Object.freeze({
  height: 44,
  chevronSize: 16,
  gap: 10,
  labelSize: kitType.body,
  valueSize: kitType.body,
  caveatSize: kitType.caption,
  caveatLineHeight: 17,
  faceGap: 10,
});

/** The mini-terminal reads structure at 1H, matching token detail. */
export const STRUCTURE_ROW_TIMEFRAME = '1H' as const;

export const STRUCTURE_ROW_COPY = Object.freeze({
  face: 'Structure',
  confluence: copy.chartEdge.confluence,
  lastBreak: 'Last break',
  latest: 'Latest',
  readings: 'Readings',
  openDetails: 'Open details',
  openTerminal: copy.chartEdge.openTerminal,
  caveatAdvice: 'Signals read on 1H closes and are not advice.',
});

/** The 369 dp chart card. A face that does not fit here uses the band word. */
const STRUCTURE_FACE_CONTENT_WIDTH = priceChartCardContentWidth(369);

const CONTRIBUTOR_LABEL: Readonly<Record<SignalKind, string>> =
  copy.askSheet.contributor;

function estimateFaceTextWidth(text: string): number {
  return Math.ceil(text.length * STRUCTURE_ROW.labelSize * 0.52) + 4;
}

function structureFaceSlotWidth(): number {
  return (
    STRUCTURE_FACE_CONTENT_WIDTH -
    estimateFaceTextWidth(STRUCTURE_ROW_COPY.face) -
    STRUCTURE_ROW.chevronSize -
    STRUCTURE_ROW.gap * 2
  );
}

/** Full Ask form when it fits one line at 369. Otherwise the band word. */
export function structureFaceValue(full: string): string {
  if (estimateFaceTextWidth(full) <= structureFaceSlotWidth()) return full;
  const band = full.split(' · ')[0];
  return band && band.length > 0 ? band : full;
}

function formatContribution(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (rounded > 0) return `+${rounded}`;
  return `${rounded}`;
}

export function resolveStructureRowEnabled(
  config: TokenVitalsConfig | null | undefined,
): boolean {
  return resolveFullChartRouteGuard(config);
}

export type StructureRowLine = {
  key: string;
  label: string;
  value: string;
};

export type StructureRowPresentation = {
  headline: string | null;
  /** On screen with a score. Not inside the disclosure. */
  scoreCaption: string | null;
  accessibilityLabel: string;
  lines: StructureRowLine[];
  caveat: string | null;
  showOpenTerminal: boolean;
};

function confluenceHeadline(
  signal: LatestSignalPresentation | null,
  confluence: ConfluenceScore | null,
): string | null {
  if (signal?.headline) return signal.headline;
  if (!confluence) return null;
  const bandWord = copy.fullChart.band[confluence.band];
  if (!bandWord) return null;
  return copy.askSheet.confluenceValue(bandWord, confluence.score);
}

function contributorLines(
  signal: LatestSignalPresentation | null,
  confluence: ConfluenceScore | null,
): StructureRowLine[] {
  if (signal && signal.composition.length > 0) {
    return signal.composition.map((row, index) => ({
      key: `contributor-${row.kind}-${index}`,
      label: row.label,
      value: row.contributionText,
    }));
  }
  if (!confluence) return [];
  return confluence.contributors.map((row, index) => ({
    key: `contributor-${row.kind}-${index}`,
    label: CONTRIBUTOR_LABEL[row.kind],
    value: formatContribution(row.contribution),
  }));
}

function lastBreakLine(bundle: ChartBundle | null): StructureRowLine | null {
  if (!bundle) return null;
  const mark = resolveLatestStructure(bundle.overlays);
  if (!mark) return null;
  const price = formatChartPriceUsd(mark.price);
  const words = copy.chartEdge.structure(mark.label, mark.direction);
  const value = price ? `${words} · ${price}` : words;
  return { key: 'break', label: STRUCTURE_ROW_COPY.lastBreak, value };
}

function zoneLine(bundle: ChartBundle | null): StructureRowLine | null {
  if (!bundle) return null;
  const zone = resolveNearestZone(bundle);
  if (!zone) return null;
  const range = formatChartZoneUsd(zone.bottom, zone.top);
  if (!range) return null;
  return { key: 'zone', label: zone.label, value: range };
}

function latestLine(
  signal: LatestSignalPresentation | null,
): StructureRowLine | null {
  if (!signal?.latestLine) return null;
  return {
    key: 'latest',
    label: STRUCTURE_ROW_COPY.latest,
    value: signal.latestLine.replace(/^Latest · /, ''),
  };
}

function readingsLine(timeframe: string): StructureRowLine {
  return {
    key: 'readings',
    label: STRUCTURE_ROW_COPY.readings,
    value: `${timeframe} · ${copy.chartEdge.closedBars}`,
  };
}

function push(lines: StructureRowLine[], line: StructureRowLine | null): void {
  if (line) lines.push(line);
}

function sliceFresh(
  asOfMs: number | null | undefined,
  timeframe: ChartBundle['timeframe'] | null | undefined,
  nowMs: number,
): boolean {
  if (asOfMs == null || timeframe == null) return false;
  return isSignalSliceFresh({ asOfMs, timeframe, nowMs });
}

function resolveStructureScoreFrom(input: {
  signal: LatestSignalPresentation | null;
  bundle: ChartBundle | null;
  nowMs: number;
}): 'signal' | 'bundle' | null {
  if (input.signal?.kind === 'unknown') return null;
  const bundle = input.bundle;
  const signalFresh =
    input.signal?.kind === 'read' &&
    sliceFresh(input.signal.asOfMs, input.signal.timeframe, input.nowMs);
  const bundleFresh =
    bundle != null && sliceFresh(bundle.asOfMs, bundle.timeframe, input.nowMs);
  if (signalFresh && bundle != null && bundleFresh) {
    const signalAsOf = input.signal?.asOfMs ?? 0;
    return bundle.asOfMs >= signalAsOf ? 'bundle' : 'signal';
  }
  if (signalFresh) return 'signal';
  if (bundleFresh) return 'bundle';
  return null;
}

/**
 * The opened *Structure* list. `null` when the fullChart guard is shut:
 * nothing to fetch, nothing to paint. An open gate with no payload yet is
 * still a row — the face holds, and the honest loading/off copy sits in
 * the caveat rather than a dash.
 */
export function resolveStructureRowPresentation(input: {
  enabled: boolean;
  signal: LatestSignalPresentation | null;
  chart: Pick<ChartBundleHookState, 'status' | 'bundle' | 'errorCode'>;
  nowMs: number;
}): StructureRowPresentation | null {
  if (!input.enabled) return null;

  const bundle = input.chart.status === 'ready' ? input.chart.bundle : null;
  const haveSlice = input.signal != null || bundle != null;
  const scoreFrom = resolveStructureScoreFrom({
    signal: input.signal,
    bundle,
    nowMs: input.nowMs,
  });
  const showScore = scoreFrom != null;
  const showUnknown = haveSlice && !showScore;
  const scoredSignal = scoreFrom === 'signal' ? input.signal : null;
  const confluence = showScore ? (bundle?.confluence ?? null) : null;
  const asOfMs =
    scoreFrom === 'signal'
      ? (input.signal?.asOfMs ?? null)
      : scoreFrom === 'bundle'
        ? (bundle?.asOfMs ?? null)
        : (input.signal?.asOfMs ?? bundle?.asOfMs ?? null);
  const timeframe =
    (scoreFrom === 'signal' ? input.signal?.timeframe : null) ??
    bundle?.timeframe ??
    input.signal?.timeframe ??
    STRUCTURE_ROW_TIMEFRAME;
  const unknownReason = showUnknown
    ? input.signal?.kind === 'unknown' && input.signal.reason
      ? input.signal.reason
      : signalSliceUnknownReason({
          asOfMs,
          timeframe,
          nowMs: input.nowMs,
        })
    : null;
  const fullHeadline = showUnknown
    ? null
    : showScore
      ? confluenceHeadline(scoredSignal, confluence)
      : null;
  const headline = showUnknown
    ? copy.tokenFacts.unknown
    : fullHeadline
      ? structureFaceValue(fullHeadline)
      : null;
  const scoreCaption =
    showScore && fullHeadline ? copy.fullChart.informationNotAdvice : null;
  const lines: StructureRowLine[] = [];

  if (showScore && fullHeadline) {
    lines.push({
      key: 'confluence',
      label: STRUCTURE_ROW_COPY.confluence,
      value: fullHeadline,
    });
  }
  if (showScore) {
    lines.push(...contributorLines(scoredSignal, confluence));
    push(lines, latestLine(scoredSignal));
  }
  push(lines, lastBreakLine(bundle));
  push(lines, zoneLine(bundle));

  const readout = resolveChartEdgeReadout({
    enabled: true,
    chart: input.chart,
    timeframe: STRUCTURE_ROW_TIMEFRAME,
    nowMs: input.nowMs,
  });

  if (readout.kind === 'ready') {
    lines.push(readingsLine(readout.timeframe));
  }

  const caveatParts: string[] = [];
  if (unknownReason) caveatParts.push(unknownReason);
  if (readout.kind === 'ready') {
    caveatParts.push(copy.chart.coverageTokenAggregated);
    caveatParts.push(...readout.honesty);
    caveatParts.push(STRUCTURE_ROW_COPY.caveatAdvice);
  } else if (readout.kind === 'loading') {
    caveatParts.push(readout.message);
  } else {
    caveatParts.push(readout.message);
  }

  const spoken = [
    STRUCTURE_ROW_COPY.face,
    headline,
    scoreCaption,
    ...lines.map((line) => `${line.label} ${line.value}`),
  ]
    .filter((part): part is string => Boolean(part))
    .join('. ');

  return {
    headline,
    scoreCaption,
    accessibilityLabel: spoken,
    lines,
    caveat: caveatParts.length > 0 ? caveatParts.join('\n') : null,
    showOpenTerminal: true,
  };
}
