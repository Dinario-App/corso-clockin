import { colors } from '@/src/ui/tokens';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import { copy } from '@/constants/copy';
import type { Candle, TimeframeId } from './types';

export const CANDLE_MIN_WIDTH = 2;
export const CANDLE_MAX_WIDTH = 9;
export const CANDLE_GAP_RATIO = 0.35;
export const VOLUME_HEIGHT_RATIO = 0.22;
export const CHART_X_PAD = 8;
export const CHART_Y_PAD = 10;
/** Most bars a card ever draws; older ones are dropped from the left. */
export const MAX_VISIBLE_CANDLES = 96;

export type RenderCandle = {
  t: number;
  x: number;
  bodyY: number;
  bodyHeight: number;
  wickTop: number;
  wickBottom: number;
  width: number;
  color: string;
  direction: 'up' | 'down' | 'flat';
  volumeY: number;
  volumeHeight: number;
};

export type CandlestickStubPresentation = {
  kind: 'stub';
  message: string;
};

export type CandlestickReadyPresentation = {
  kind: 'chart';
  candles: RenderCandle[];
  /** Price axis labels, formatted. */
  maxLabel: string;
  minLabel: string;
  /** Y of the last close — the quiet baseline. */
  lastCloseY: number;
  lastCloseText: string;
  showVolume: boolean;
  priceAreaHeight: number;
  volumeAreaTop: number;
};

export type CandlestickPresentation =
  | CandlestickStubPresentation
  | CandlestickReadyPresentation;

/** Decimal string for `formatPriceUsd`, never exponent notation. */
export function priceNumberToDecimalString(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const text = value.toFixed(18).replace(/0+$/, '').replace(/\.$/, '');
  return text.length > 0 ? text : null;
}

export function formatCandlePrice(value: number): string | null {
  const decimal = priceNumberToDecimalString(value);
  return decimal ? formatPriceUsd(decimal) : null;
}

function direction(candle: Candle): 'up' | 'down' | 'flat' {
  if (candle.c > candle.o) return 'up';
  if (candle.c < candle.o) return 'down';
  return 'flat';
}

export function candleColor(dir: 'up' | 'down' | 'flat'): string {
  if (dir === 'up') return colors.priceUp;
  if (dir === 'down') return colors.priceDown;
  return colors.inkTertiary;
}

export function resolveCandlestickPresentation(input: {
  candles: readonly Candle[] | null | undefined;
  width: number;
  height: number;
  showVolume: boolean;
  timeframe: TimeframeId;
}): CandlestickPresentation {
  const all = input.candles ?? [];
  const visible = all.slice(-MAX_VISIBLE_CANDLES);
  if (
    visible.length < 2 ||
    !Number.isFinite(input.width) ||
    input.width <= 32 ||
    !Number.isFinite(input.height) ||
    input.height <= 48
  ) {
    return { kind: 'stub', message: copy.vitals.chartUnavailable };
  }
  for (let index = 1; index < visible.length; index += 1) {
    if (visible[index]!.t <= visible[index - 1]!.t) {
      return { kind: 'stub', message: copy.vitals.chartUnavailable };
    }
  }

  const hasVolume = input.showVolume && visible.some((candle) => candle.v > 0);
  const volumeArea = hasVolume
    ? Math.round(input.height * VOLUME_HEIGHT_RATIO)
    : 0;
  const priceAreaHeight = input.height - volumeArea;
  const drawableWidth = input.width - CHART_X_PAD * 2;
  const drawableHeight = priceAreaHeight - CHART_Y_PAD * 2;

  const slot = drawableWidth / visible.length;
  const width = Math.max(
    CANDLE_MIN_WIDTH,
    Math.min(CANDLE_MAX_WIDTH, slot * (1 - CANDLE_GAP_RATIO)),
  );

  const high = Math.max(...visible.map((candle) => candle.h));
  const low = Math.min(...visible.map((candle) => candle.l));
  const span = high - low || Math.max(high * 0.01, 0.000_001);
  const maxVolume = hasVolume
    ? Math.max(...visible.map((candle) => candle.v))
    : 0;
  const y = (price: number) =>
    CHART_Y_PAD + ((high - price) / span) * drawableHeight;

  const candles: RenderCandle[] = visible.map((candle, index) => {
    const dir = direction(candle);
    const top = y(Math.max(candle.o, candle.c));
    const bottom = y(Math.min(candle.o, candle.c));
    const volumeHeight =
      hasVolume && maxVolume > 0
        ? Math.max(1, (candle.v / maxVolume) * (volumeArea - 4))
        : 0;
    return {
      t: candle.t,
      x: CHART_X_PAD + slot * index + slot / 2,
      bodyY: top,
      bodyHeight: Math.max(1, bottom - top),
      wickTop: y(candle.h),
      wickBottom: y(candle.l),
      width,
      color: candleColor(dir),
      direction: dir,
      volumeY: input.height - volumeHeight,
      volumeHeight,
    };
  });

  const last = visible[visible.length - 1]!;
  return {
    kind: 'chart',
    candles,
    maxLabel: formatCandlePrice(high) ?? '',
    minLabel: formatCandlePrice(low) ?? '',
    lastCloseY: y(last.c),
    lastCloseText: formatCandlePrice(last.c) ?? '',
    showVolume: hasVolume,
    priceAreaHeight,
    volumeAreaTop: priceAreaHeight,
  };
}

/**
 * Merge a refreshed live bar into a seed series: same open time → replace,
 * newer → append (and drop the oldest past the cap), older → ignore.
 */
export function mergeLiveBar(
  candles: readonly Candle[],
  live: Candle | null | undefined,
): Candle[] {
  if (!live) return [...candles];
  const last = candles[candles.length - 1];
  if (!last) return [live];
  if (live.t === last.t) return [...candles.slice(0, -1), live];
  if (live.t > last.t) return [...candles, live].slice(-MAX_VISIBLE_CANDLES);
  return [...candles];
}
