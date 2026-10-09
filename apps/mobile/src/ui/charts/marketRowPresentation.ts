import type { ViewStyle } from 'react-native';
import { copy } from '@/constants/copy';
import {
  formatClosedBarStamp,
  formatObservationClock,
} from '@/src/features/home/asOfPresentation';
import { kitType, radii } from '@/src/ui/tokens';
import {
  formatCompactUsd,
  formatCount,
  formatPct,
  formatRatio,
} from '@/src/features/tokenVitals/tokenVitalsPresentation';

export const MARKET_ROW_CARD_RADIUS = radii.card;
export const MARKET_ROW_CARD_PAD = 16;
export const MARKET_ROW_BODY_SIZE = kitType.body;
export const MARKET_ROW_TITLE_SIZE = kitType.sub;
export const MARKET_ROW_LABEL_SIZE = kitType.caption;
export const MARKET_ROW_TITLE = 'Market';

export const MARKET_ROW_SCREEN_GUTTER = 16;
export const MARKET_ROW_DESIGN_WIDTH = 412;
export const MARKET_ROW_NARROW_WIDTH = 369;
export const MARKET_ROW_COLUMNS = 2;
export const MARKET_ROW_COLUMN_GAP = 12;
export const MARKET_ROW_ROW_GAP = 12;
/** Floor a 13/400 label like "Volume 24h" still reads at 369. */
export const MARKET_ROW_CELL_MIN_WIDTH = 120;

export type MarketRowSource = {
  market?: {
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    buySellRatio24h: number | null;
    marketCapUsd?: number | null;
    fdvUsd?: number | null;
    source?: string;
    asOf?: string;
  } | null;
  holders?: {
    count: number | null;
    top10Pct: number | null;
    top1Pct: number | null;
    source?: string;
    asOf?: string;
  } | null;
  price?: {
    marketCapUsd: number | null;
    fdvUsd: number | null;
    source?: string;
    asOf?: string;
  } | null;
  token?: {
    ageMinutes: number | null;
  } | null;
};

export type MarketRowCellKey =
  | 'liquidity'
  | 'volume24h'
  | 'buySell'
  | 'holders'
  | 'top1'
  | 'top10'
  | 'capFdv'
  | 'age';

export type MarketRowCell = {
  key: MarketRowCellKey;
  label: string;
  value: string;
  /** Clock of the read that produced the figure. Null only for age. */
  provenance: string | null;
};

export type MarketRowPresentation = {
  title: typeof MARKET_ROW_TITLE;
  cells: MarketRowCell[];
  accessibilityLabel: string;
};

export type MarketRowLayout = {
  cardWidth: number;
  innerWidth: number;
  cellWidth: number;
  columns: typeof MARKET_ROW_COLUMNS;
  fits: boolean;
};

function positive(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function usd(value: number | null | undefined): string | null {
  const n = positive(value);
  if (n == null) return null;
  const text = formatCompactUsd(n);
  if (!text || text === '$0') return null;
  return text;
}

function ratio(value: number | null | undefined): string | null {
  const n = positive(value);
  if (n == null) return null;
  const text = formatRatio(n);
  if (!text) return null;
  if (text === '0.0×' || text === '0×') return '<0.1×';
  return text;
}

function pct(value: number | null | undefined): string | null {
  const n = positive(value);
  if (n == null) return null;
  const text = formatPct(n);
  if (!text) return null;
  if (text === '0%' || text === '0.0%') return '<0.1%';
  return text;
}

function count(value: number | null | undefined): string | null {
  const n = positive(value);
  if (n == null) return null;
  const text = formatCount(n);
  if (!text || text === '0') return null;
  return text;
}

function age(ageMinutes: number | null | undefined): string | null {
  if (ageMinutes == null || !Number.isFinite(ageMinutes) || ageMinutes <= 0) {
    return null;
  }
  const minutes = Math.floor(ageMinutes);
  if (minutes < 1) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days}d`;
  const years = Math.floor(days / 365);
  if (years < 1) return null;
  return `${years}y`;
}

function knownFigureSource(source: string | undefined): boolean {
  return (
    source === 'birdeye' ||
    source === 'geckoterminal' ||
    source === 'jupiter'
  );
}

/** A dollar or a count with no source and no clock is not a measurement. */
function figureProvenance(
  source: string | undefined,
  asOf: string | undefined,
  nowMs: number | undefined,
): string | null {
  if (!knownFigureSource(source) || asOf == null) return null;
  const parsed = Date.parse(asOf);
  const clock =
    nowMs == null
      ? formatObservationClock(parsed)
      : formatClosedBarStamp(parsed, nowMs);
  if (!clock) return null;
  return copy.chart.attribution(clock);
}

function push(
  cells: MarketRowCell[],
  key: MarketRowCellKey,
  label: string,
  value: string | null,
  provenance: string | null,
  requireClock: boolean,
): void {
  if (!value) return;
  if (requireClock && provenance == null) return;
  cells.push({ key, label, value, provenance });
}

export function resolveMarketRowPresentation(
  source: MarketRowSource | null | undefined,
  nowMs?: number,
): MarketRowPresentation | null {
  if (!source) return null;
  const cells: MarketRowCell[] = [];
  const market = source.market;
  const holders = source.holders;
  const token = source.token;

  const marketClock = figureProvenance(market?.source, market?.asOf, nowMs);
  const holderClock = figureProvenance(holders?.source, holders?.asOf, nowMs);

  push(
    cells,
    'liquidity',
    copy.vitals.liquidity,
    usd(market?.liquidityUsd),
    marketClock,
    true,
  );
  push(
    cells,
    'volume24h',
    copy.vitals.volume24h,
    usd(market?.volume24hUsd),
    marketClock,
    true,
  );
  push(
    cells,
    'buySell',
    copy.vitals.buySell,
    ratio(market?.buySellRatio24h),
    marketClock,
    true,
  );
  push(
    cells,
    'holders',
    copy.vitals.holders,
    count(holders?.count),
    holderClock,
    true,
  );
  push(cells, 'top1', 'Top 1', pct(holders?.top1Pct), holderClock, true);
  push(cells, 'top10', 'Top 10', pct(holders?.top10Pct), holderClock, true);

  const mc = usd(market?.marketCapUsd);
  const fdv = usd(market?.fdvUsd);
  if (mc && fdv) {
    push(cells, 'capFdv', 'MC / FDV', `${mc} / ${fdv}`, marketClock, true);
  } else if (mc) {
    push(cells, 'capFdv', 'Market cap', mc, marketClock, true);
  } else if (fdv) {
    push(cells, 'capFdv', 'FDV', fdv, marketClock, true);
  }

  push(cells, 'age', 'Age', age(token?.ageMinutes ?? null), null, false);

  if (cells.length === 0) return null;
  return {
    title: MARKET_ROW_TITLE,
    cells,
    accessibilityLabel: `${MARKET_ROW_TITLE}: ${cells
      .map((cell) =>
        cell.provenance
          ? `${cell.label} ${cell.value}, ${cell.provenance}`
          : `${cell.label} ${cell.value}`,
      )
      .join(', ')}`,
  };
}

export function resolveMarketRowLayout(viewportWidth: number): MarketRowLayout {
  const cardWidth = viewportWidth - MARKET_ROW_SCREEN_GUTTER * 2;
  const innerWidth = cardWidth - MARKET_ROW_CARD_PAD * 2;
  const cellWidth =
    (innerWidth - MARKET_ROW_COLUMN_GAP * (MARKET_ROW_COLUMNS - 1)) /
    MARKET_ROW_COLUMNS;
  return {
    cardWidth,
    innerWidth,
    cellWidth,
    columns: MARKET_ROW_COLUMNS,
    fits: cellWidth >= MARKET_ROW_CELL_MIN_WIDTH,
  };
}

export function resolveMarketRowCellStyle(): ViewStyle {
  return {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: MARKET_ROW_CELL_MIN_WIDTH,
    gap: 2,
  };
}
