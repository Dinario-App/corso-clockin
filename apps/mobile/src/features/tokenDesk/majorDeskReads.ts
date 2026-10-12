import { copy } from '@/constants/copy';
import { plainRiskCopy } from '@/constants/copy/plainRisk';
import { formatClosedBarStamp } from '@/src/features/home/asOfPresentation';
import { presentFearGreedChip } from '@/src/features/swap/fearGreed/presentFearGreedChip';
import type { FearGreedResponse } from '@/src/features/swap/fearGreed/types';
import {
  formatCompactUsd,
  formatCount,
  formatRatio,
} from '@/src/features/tokenVitals/tokenVitalsPresentation';
import type {
  VitalsHolders,
  VitalsMarket,
} from '@/src/features/tokenVitals/types';

export const DESK_READ_UNAVAILABLE = copy.send.feeUnavailable;
export const DESK_RISK_LABEL = copy.browse.sort.option.risk;
export const DESK_READ_NOT_ENOUGH_DATA = plainRiskCopy.level.notEnoughData;
/** The shipped in-flight word of the vitals card. */
export const DESK_READ_CHECKING = copy.vitals.checking;

export type DeskVitalsRead =
  /** Vitals are off on this build or network: the desk shows no vitals cells. */
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready';
      market: VitalsMarket | null;
      holders: VitalsHolders | null;
    };

export type DeskMoodRead =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; snapshot: FearGreedResponse };

export type DeskReadKey = 'holders' | 'buySell' | 'liquidity' | 'volume24h';

export type DeskReadState =
  | 'ready'
  | 'checking'
  | 'notEnoughData'
  | 'unavailable';

export type DeskReadCell = {
  key: DeskReadKey;
  label: string;
  value: string;
  /** "as of 14:05" for a ready figure; null for every other state. */
  stamp: string | null;
  state: DeskReadState;
  accessibilityLabel: string;
};

export type DeskMoodLine = {
  value: string;
  /** The index's own day: "today", "yesterday" or a date. */
  stamp: string | null;
  state: DeskReadState;
  accessibilityLabel: string;
};

export type MajorDeskReads = {
  /** Empty when vitals are off: the face draws no vitals cells. */
  cells: DeskReadCell[];
  mood: DeskMoodLine;
};

function positive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function stampOf(
  asOf: string | null | undefined,
  nowMs: number,
): string | null {
  if (typeof asOf !== 'string') return null;
  const asOfMs = Date.parse(asOf);
  // A read stamped in the future is not a read we can date.
  if (!Number.isFinite(asOfMs) || asOfMs > nowMs) return null;
  const clock = formatClosedBarStamp(asOfMs, nowMs);
  return clock ? copy.diyLists.asOf(clock) : null;
}

function cell(
  key: DeskReadKey,
  label: string,
  value: string | null,
  stamp: string | null,
  inFlight: boolean,
): DeskReadCell {
  if (inFlight) {
    return {
      key,
      label,
      value: DESK_READ_CHECKING,
      stamp: null,
      state: 'checking',
      accessibilityLabel: `${label}, ${DESK_READ_CHECKING}`,
    };
  }
  if (stamp != null && value == null) {
    return {
      key,
      label,
      value: DESK_READ_NOT_ENOUGH_DATA,
      stamp: null,
      state: 'notEnoughData',
      accessibilityLabel: `${label}, ${DESK_READ_NOT_ENOUGH_DATA}`,
    };
  }
  if (value == null || stamp == null) {
    return {
      key,
      label,
      value: DESK_READ_UNAVAILABLE,
      stamp: null,
      state: 'unavailable',
      accessibilityLabel: `${label}, ${DESK_READ_UNAVAILABLE}`,
    };
  }
  return {
    key,
    label,
    value,
    stamp,
    state: 'ready',
    accessibilityLabel: `${label}, ${value}, ${stamp}`,
  };
}

function usd(value: number | null | undefined): string | null {
  const n = positive(value);
  if (n == null) return null;
  const text = formatCompactUsd(n);
  return text && text !== '$0' ? text : null;
}

function holderCount(value: number | null | undefined): string | null {
  const n = positive(value);
  if (n == null) return null;
  const text = formatCount(n);
  return text && text !== '0' ? copy.discovery.holders(text) : null;
}

function buySell(value: number | null | undefined): string | null {
  const n = positive(value);
  if (n == null) return null;
  return formatRatio(n);
}

export function presentDeskVitalsCells(
  read: DeskVitalsRead,
  nowMs: number,
): DeskReadCell[] {
  if (read.status === 'off') return [];
  const inFlight = read.status === 'loading';
  const market = read.status === 'ready' ? read.market : null;
  const holders = read.status === 'ready' ? read.holders : null;
  const marketStamp = stampOf(market?.asOf, nowMs);
  const holdersStamp = stampOf(holders?.asOf, nowMs);
  return [
    cell(
      'holders',
      copy.vitals.holders,
      holderCount(holders?.count),
      holdersStamp,
      inFlight,
    ),
    cell(
      'buySell',
      copy.vitals.buySell,
      buySell(market?.buySellRatio24h),
      marketStamp,
      inFlight,
    ),
    cell(
      'liquidity',
      copy.vitals.liquidity,
      usd(market?.liquidityUsd),
      marketStamp,
      inFlight,
    ),
    cell(
      'volume24h',
      copy.vitals.volume24h,
      usd(market?.volume24hUsd),
      marketStamp,
      inFlight,
    ),
  ];
}

/**
 * The mood line is the Review chip, word for word: `Upbeat 71 · alternative.me`
 * and its day. A stale, future-dated or unreadable index is Unavailable.
 */
export function presentDeskMood(
  read: DeskMoodRead,
  nowMs: number,
): DeskMoodLine {
  // The source names the line in every state, the way the ready chip does,
  // so a bare "Unavailable" never stands alone.
  const source = copy.fearGreed.attribution;
  if (read.status === 'loading') {
    const value = `${DESK_READ_CHECKING} · ${source}`;
    return {
      value,
      stamp: null,
      state: 'checking',
      accessibilityLabel: value,
    };
  }
  const chip =
    read.status === 'ready'
      ? presentFearGreedChip({ snapshot: read.snapshot, nowMs })
      : null;
  if (chip == null) {
    const value = `${DESK_READ_UNAVAILABLE} · ${source}`;
    return {
      value,
      stamp: null,
      state: 'unavailable',
      accessibilityLabel: value,
    };
  }
  return {
    value: chip.label,
    stamp: chip.freshness,
    state: 'ready',
    accessibilityLabel: `${chip.label}, ${chip.freshness}`,
  };
}

export function presentMajorDeskReads(args: {
  vitals: DeskVitalsRead;
  mood: DeskMoodRead;
  nowMs: number;
}): MajorDeskReads {
  return {
    cells: presentDeskVitalsCells(args.vitals, args.nowMs),
    mood: presentDeskMood(args.mood, args.nowMs),
  };
}
