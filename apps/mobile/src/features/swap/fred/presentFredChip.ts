import { copy } from '@/constants/copy';
import {
  FRED_ATTRIBUTION_NOTICE,
  FRED_CHIP_KEY,
  FRED_DAILY_STALE_MS,
  FRED_MONTHLY_STALE_MS,
  FRED_SECONDARY_SERIES,
  type FredChip,
  type FredFed,
  type FredResponse,
  type FredSecondary,
} from './types';

const SECONDARIES = new Set<string>(FRED_SECONDARY_SERIES);

export type PresentFredChipRead = {
  snapshot: FredResponse | null;
  nowMs: number;
};

/**
 * Display-only Review chip. Missing, stale, or unreadable macro data returns
 * null so the chip omits, and the FRED notice omits with it. The notice is
 * part of the chip. Does not participate in Sign.
 */
export function presentFredChip(read: PresentFredChipRead): FredChip | null {
  const snapshot = read.snapshot;
  if (!snapshot) return null;
  if (snapshot.status !== 'ready') return null;
  if (snapshot.attribution !== FRED_ATTRIBUTION_NOTICE) return null;
  if (copy.fred.notice !== FRED_ATTRIBUTION_NOTICE) return null;
  const fedText = formatFed(snapshot.fed);
  if (!fedText) return null;
  const fedStale = staleWindow(snapshot.fed.kind === 'effective');
  if (!isFresh(snapshot.fed.observedAtMs, read.nowMs, fedStale)) return null;

  const secondary = usableSecondary(snapshot.secondary, read.nowMs);
  const secondaryText = secondary
    ? formatSecondary(secondary, snapshot.fed.observedAtMs)
    : null;
  const freshness = freshnessLabel(
    snapshot.fed.observedAtMs,
    read.nowMs,
    fedStale,
  );
  if (!freshness) return null;

  return {
    key: FRED_CHIP_KEY,
    label: secondaryText ? `${fedText} · ${secondaryText}` : fedText,
    freshness,
    notice: FRED_ATTRIBUTION_NOTICE,
  };
}

function usableSecondary(
  secondary: FredSecondary | null,
  nowMs: number,
): FredSecondary | null {
  if (!secondary) return null;
  if (!SECONDARIES.has(secondary.seriesId)) return null;
  if (!Number.isFinite(secondary.value)) return null;
  const stale = staleWindow(secondary.seriesId === 'CPIAUCSL');
  if (!isFresh(secondary.observedAtMs, nowMs, stale)) return null;
  return secondary;
}

function formatFed(fed: FredFed): string | null {
  switch (fed.kind) {
    case 'target-range':
      if (
        !Number.isFinite(fed.lower) ||
        !Number.isFinite(fed.upper) ||
        fed.lower > fed.upper
      ) {
        return null;
      }
      return `${copy.fred.fed} ${fed.lower.toFixed(2)}\u2013${fed.upper.toFixed(2)}%`;
    case 'effective':
      if (!Number.isFinite(fed.value)) return null;
      return `${copy.fred.fed} ${formatPp(fed.value)}`;
    default: {
      const never: never = fed;
      return never;
    }
  }
}

function formatSecondary(
  secondary: FredSecondary,
  fedObservedAtMs: number,
): string | null {
  const body = secondaryBody(secondary);
  if (!body) return null;
  if (utcDay(secondary.observedAtMs) === utcDay(fedObservedAtMs)) return body;
  const stamp = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(secondary.observedAtMs));
  return `${body} (${stamp})`;
}

function secondaryBody(secondary: FredSecondary): string | null {
  switch (secondary.seriesId) {
    case 'DGS10':
      return `${copy.fred.tenYear} ${formatPp(secondary.value)}`;
    case 'T10Y2Y':
      return `${copy.fred.curve} ${formatPp(secondary.value)}`;
    case 'DTWEXBGS':
      return `${copy.fred.dollar} ${secondary.value.toFixed(1)}`;
    case 'CPIAUCSL':
      if (
        secondary.changeRatio == null ||
        !Number.isFinite(secondary.changeRatio)
      ) {
        return null;
      }
      return `${copy.fred.cpi} ${formatChange(secondary.changeRatio * 100)}`;
    default: {
      const never: never = secondary.seriesId;
      return never;
    }
  }
}

function formatPp(value: number): string {
  const sign = value < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function formatChange(percent: number): string {
  if (percent < 0) return formatPp(percent);
  return `+${Math.abs(percent).toFixed(2)}%`;
}

function staleWindow(monthly: boolean): number {
  return monthly ? FRED_MONTHLY_STALE_MS : FRED_DAILY_STALE_MS;
}

function isFresh(
  observedAtMs: number,
  nowMs: number,
  staleMs: number,
): boolean {
  return (
    Number.isFinite(observedAtMs) &&
    observedAtMs <= nowMs &&
    nowMs - observedAtMs <= staleMs
  );
}

function freshnessLabel(
  observedAtMs: number,
  nowMs: number,
  staleMs: number,
): string | null {
  if (!isFresh(observedAtMs, nowMs, staleMs)) return null;
  const dayDiff = Math.round(
    (utcDay(nowMs) - utcDay(observedAtMs)) / 86_400_000,
  );
  if (dayDiff < 0) return null;
  if (dayDiff === 0) return copy.fred.today;
  if (dayDiff === 1) return copy.fred.yesterday;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(observedAtMs));
}

function utcDay(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
