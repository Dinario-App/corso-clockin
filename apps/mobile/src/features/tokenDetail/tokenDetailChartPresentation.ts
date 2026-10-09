import {
  PRICE_CHART_RANGES,
  PRICE_CHART_SCREEN_GUTTER,
  priceChartRangeIntervalMs,
  resolvePriceChartActiveRange,
  resolveShownPriceChartRanges,
  type PriceChartRange,
} from '@/src/features/prices/usePriceChartSeries';
import {
  PRICE_CHART_PLOT_HEIGHTS,
  resolvePriceChartHistoryPresentation,
  type PriceChartHistory,
} from '@/src/ui/charts/priceChartPresentation';
import { STRUCTURE_ROW } from '@/src/ui/charts/structureRowPresentation';
import { MIN_TAP_TARGET_PT } from '@/src/ui/primitives/tapTargetPresentation';
import { kitType, spacing } from '@/src/ui/tokens';

/** PriceChart's own opening window, when nothing is carried in. */
export const TOKEN_DETAIL_DEFAULT_RANGE: PriceChartRange = '1D';

export const TOKEN_DETAIL_GUTTER = PRICE_CHART_SCREEN_GUTTER;

export function resolveTokenDetailRangeParam(raw: unknown): PriceChartRange | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  return (PRICE_CHART_RANGES as readonly string[]).includes(value)
    ? (value as PriceChartRange)
    : null;
}

/** The window token detail opens on: the carried range, else PriceChart's default. */
export function resolveTokenDetailInitialRange(raw: unknown): PriceChartRange {
  return resolveTokenDetailRangeParam(raw) ?? TOKEN_DETAIL_DEFAULT_RANGE;
}

export function resolveTokenDetailActiveRange(input: {
  chosen: PriceChartRange;
  visible: readonly PriceChartRange[];
}): PriceChartRange {
  return resolvePriceChartActiveRange(
    input.chosen,
    resolveShownPriceChartRanges(undefined, input.visible),
  );
}

/** The history PriceChart presents for one window, handed back to the page. */
export type TokenDetailPresentedHistory = {
  range: PriceChartRange;
  state: PriceChartHistory;
};

export function resolveTokenDetailPresentedHistory(input: {
  range: PriceChartRange;
  fetched: PriceChartHistory;
  presented: TokenDetailPresentedHistory | null;
}): PriceChartHistory {
  return input.presented !== null &&
    input.presented.range === input.range &&
    priceChartRangeIntervalMs(input.range) != null
    ? input.presented.state
    : input.fetched;
}

export type TokenDetailWindowChange = {
  /** `+39.1% · 1D` — the figure and the window it describes. */
  text: string;
  percentText: string;
  range: PriceChartRange;
  tone: string;
};

export function resolveTokenDetailWindowChange(input: {
  history: PriceChartHistory;
  range: PriceChartRange;
}): TokenDetailWindowChange | null {
  const presentation = resolvePriceChartHistoryPresentation({
    history: input.history,
    // The percent reads the window's first and last bars, not the geometry.
    width: 320,
    height: PRICE_CHART_PLOT_HEIGHTS.detail,
    scrubIndex: null,
    condensed: true,
  });
  if (presentation.kind !== 'chart') return null;
  return {
    text: `${presentation.deltaText} · ${input.range}`,
    percentText: presentation.deltaText,
    range: input.range,
    tone: presentation.deltaTone,
  };
}

export const TOKEN_DETAIL_CHART_COPY = Object.freeze({
  low: 'Low',
  high: 'High',
});

export type TokenDetailChartFoot = {
  /** `Low $0.0418 · High $0.0701` */
  bounds: string;
  /** The as-of clock of the chart read. */
  source: string | null;
  /** The coverage caveat line(s), kept on the card. */
  coverage: string[];
};

export function resolveTokenDetailChartFoot(input: {
  minLabel: string;
  maxLabel: string;
  attribution: string | null;
}): TokenDetailChartFoot {
  const lines = (input.attribution ?? '')
    .split('\n')
    .filter((line) => line.length > 0);
  const source = lines[0] ?? null;
  return {
    bounds: `${TOKEN_DETAIL_CHART_COPY.low} ${input.minLabel} · ${TOKEN_DETAIL_CHART_COPY.high} ${input.maxLabel}`,
    source,
    coverage: lines.slice(1),
  };
}

export type TokenDetailStatGrid = {
  low: { label: string; value: string };
  high: { label: string; value: string };
  /** The coverage caveat, printed under Low and High, never apart from them. */
  coverage: string[];
  /** The as-of clock of the chart read. */
  stamp: string | null;
};

export function resolveTokenDetailStatGrid(input: {
  minLabel: string;
  maxLabel: string;
  attribution: string | null;
}): TokenDetailStatGrid {
  const foot = resolveTokenDetailChartFoot(input);
  return {
    low: { label: TOKEN_DETAIL_CHART_COPY.low, value: input.minLabel },
    high: { label: TOKEN_DETAIL_CHART_COPY.high, value: input.maxLabel },
    coverage: foot.coverage,
    stamp: foot.source,
  };
}

export const TOKEN_DETAIL_CHART_CARD = Object.freeze({
  paddingTop: 14,
  paddingBottom: 14,
  paddingHorizontal: 16,
  headerHeight: MIN_TAP_TARGET_PT,
  faceGap: spacing.xs,
  plotHeight: PRICE_CHART_PLOT_HEIGHTS.detail,
  footFontSize: kitType.caption,
  footLineHeight: 17,
  footLineGap: 2,
  footColumnGap: 10,
  structureFaceGap: STRUCTURE_ROW.faceGap,
  structureHeight: STRUCTURE_ROW.height,
  maxHeight: 290,
});

function estimateFootTextWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.52) + 4;
}

export function resolveTokenDetailChartFootLines(input: {
  foot: TokenDetailChartFoot;
  contentWidth: number;
  /** The reader's text size: 1 is the default, 1.3 is 130 %. */
  fontScale?: number;
}): { footLines: number; coverageLines: number } {
  const C = TOKEN_DETAIL_CHART_CARD;
  const fontSize = C.footFontSize * (input.fontScale ?? 1);
  const rows = (text: string) =>
    Math.max(1, Math.ceil(estimateFootTextWidth(text, fontSize) / input.contentWidth));
  const bounds = estimateFootTextWidth(input.foot.bounds, fontSize);
  const source = input.foot.source == null
    ? null
    : estimateFootTextWidth(input.foot.source, fontSize);
  const oneRow = source == null
    ? bounds <= input.contentWidth
    : bounds + C.footColumnGap + source <= input.contentWidth;
  return {
    footLines: oneRow
      ? 1
      : rows(input.foot.bounds) + (input.foot.source == null ? 0 : rows(input.foot.source)),
    coverageLines: input.foot.coverage.reduce((total, line) => total + rows(line), 0),
  };
}

/**
 * The folded card's height, for a foot of `footLines` rows plus the caveat.
 * A larger text size grows the text rows only: the paddings, the 44 dp header
 * carrier, the plot and the fixed 44 dp Structure row keep their size.
 */
export function resolveTokenDetailChartCardHeight(input: {
  footLines: number;
  coverageLines: number;
  structureShown: boolean;
  /** The reader's text size: 1 is the default, 1.3 is 130 %. */
  fontScale?: number;
}): number {
  const C = TOKEN_DETAIL_CHART_CARD;
  const textLines = input.footLines + input.coverageLines;
  const height =
    C.paddingTop +
    C.headerHeight +
    C.faceGap +
    C.plotHeight +
    C.faceGap +
    textLines * C.footLineHeight * (input.fontScale ?? 1) +
    Math.max(0, textLines - 1) * C.footLineGap +
    (input.structureShown ? C.structureFaceGap + C.structureHeight : 0) +
    C.paddingBottom;
  return Math.round(height * 10) / 10;
}
