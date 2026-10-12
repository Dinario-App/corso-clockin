import { copy } from '@/constants/copy';
import type { ReadFailState } from '@/src/features/connectivity/connectivity';
import { getMajorAsset } from '@/src/features/balances/majors';
import {
  presentMarketHead,
  priceThenFromSeries,
} from '@/src/features/balances/majorDetailFace';
import {
  DESK_READ_CHECKING,
  DESK_READ_UNAVAILABLE,
  presentMajorDeskReads,
  type DeskMoodRead,
  type DeskReadKey,
  type DeskVitalsRead,
  type MajorDeskReads,
} from '@/src/features/tokenDesk/majorDeskReads';
import type { DeltaDirection } from '@/src/ui/ethena/deltaInk';
import { LIVE_DESK_MINT, type LiveDeskRead } from './liveDeskRead';

/** The two desk cells the card carries; the Token desk keeps all four. */
export const LIVE_DESK_CELLS: readonly DeskReadKey[] = ['holders', 'buySell'];

export type LiveDeskLine =
  | { state: 'checking'; label: string }
  | { state: 'unavailable'; label: string }
  | {
      state: 'ready';
      points: readonly { timestampMs: number; priceUsd: string }[];
    };

export type LiveDeskCardModel = {
  /** False exactly when prices are off on this build: draw no card. */
  shown: boolean;
  name: string;
  symbol: string;
  priceText: string;
  /** The price slot names a state (*Loading…*, *Price unavailable*). */
  priceQuiet: boolean;
  deltaLine: string | null;
  deltaDirection: DeltaDirection;
  staleLine: string | null;
  line: LiveDeskLine;
  reads: MajorDeskReads;
  /** One sentence for the identity and head, read as a single stop. */
  headAccessibilityLabel: string;
};

export function presentLiveDeskCard(args: {
  read: LiveDeskRead;
  vitals: DeskVitalsRead;
  mood: DeskMoodRead;
  nowMs: number;
  failState?: ReadFailState;
}): LiveDeskCardModel {
  const asset = getMajorAsset(LIVE_DESK_MINT);
  const name = asset?.displayName ?? '';
  const symbol = asset?.symbol ?? '';
  const allReads = presentMajorDeskReads({
    vitals: args.vitals,
    mood: args.mood,
    nowMs: args.nowMs,
  });
  const reads: MajorDeskReads = {
    cells: allReads.cells.filter((c) => LIVE_DESK_CELLS.includes(c.key)),
    mood: allReads.mood,
  };

  if (args.read.status === 'off' || args.read.status === 'loading') {
    const priceText = copy.majorDetail.loading;
    return {
      shown: args.read.status === 'loading',
      name,
      symbol,
      priceText,
      priceQuiet: true,
      deltaLine: null,
      deltaDirection: null,
      staleLine: null,
      line: { state: 'checking', label: DESK_READ_CHECKING },
      reads,
      headAccessibilityLabel: `${name}, ${priceText}`,
    };
  }

  const points =
    args.read.series.status === 'ready' ? args.read.series.points : null;
  const head = presentMarketHead({
    mint: LIVE_DESK_MINT,
    quote: args.read.quote.status === 'ready' ? args.read.quote.quote : null,
    priceThen: points ? priceThenFromSeries(points, args.nowMs) : null,
    nowMs: args.nowMs,
    failState: args.failState,
  });
  // A line beside no price would chart a figure the head just refused.
  const line: LiveDeskLine =
    points && !head.priceUnavailable
      ? { state: 'ready', points }
      : { state: 'unavailable', label: DESK_READ_UNAVAILABLE };
  const spoken = [name, head.priceText, head.deltaLine, head.staleLine]
    .filter((part): part is string => Boolean(part))
    .join(', ');
  return {
    shown: true,
    name,
    symbol,
    priceText: head.priceText,
    priceQuiet: head.priceUnavailable,
    deltaLine: head.deltaLine,
    deltaDirection: head.deltaDirection,
    staleLine: head.staleLine,
    line,
    reads,
    headAccessibilityLabel: spoken,
  };
}

/**
 * The 1D line as SVG paths in a `width` × `height` box: the stroke, the
 * area under it, and the last point (the pulse). Points that do not parse
 * are dropped; fewer than two left draws nothing.
 */
export function liveDeskLinePaths(
  points: readonly { timestampMs: number; priceUsd: string }[],
  width: number,
  height: number,
  inset = 6,
): { stroke: string; area: string; last: { x: number; y: number } } | null {
  const usable = points
    .map((p) => ({ t: p.timestampMs, v: Number(p.priceUsd) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0)
    .sort((a, b) => a.t - b.t);
  if (usable.length < 2 || width <= 0 || height <= inset * 2) return null;
  const t0 = usable[0]!.t;
  const t1 = usable[usable.length - 1]!.t;
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of usable) {
    lo = Math.min(lo, p.v);
    hi = Math.max(hi, p.v);
  }
  const spanT = t1 - t0 || 1;
  const spanV = hi - lo;
  const plot = height - inset * 2;
  const xy = usable.map((p) => ({
    x: ((p.t - t0) / spanT) * width,
    // A flat day sits mid-box, not on the floor.
    y: spanV === 0 ? height / 2 : inset + (1 - (p.v - lo) / spanV) * plot,
  }));
  const r = (n: number) => Math.round(n * 10) / 10;
  const stroke = xy
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${r(p.x)} ${r(p.y)}`)
    .join(' ');
  const last = xy[xy.length - 1]!;
  const area = `${stroke} L${r(last.x)} ${height} L${r(xy[0]!.x)} ${height} Z`;
  return { stroke, area, last: { x: r(last.x), y: r(last.y) } };
}
