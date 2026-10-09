import { copy } from '@/constants/copy';
import {
  FEAR_GREED_ATTRIBUTION,
  FEAR_GREED_CHIP_KEY,
  FEAR_GREED_CLASSIFICATIONS,
  FEAR_GREED_STALE_MS,
  type FearGreedChip,
  type FearGreedClassification,
  type FearGreedResponse,
} from './types';

const CLASSIFICATIONS = new Set<string>(FEAR_GREED_CLASSIFICATIONS);

export type PresentFearGreedChipRead = {
  snapshot: FearGreedResponse | null;
  nowMs: number;
};

/**
 * Display-only Review chip. Missing, stale, or unreadable mood data returns
 * null so the chip omits. Does not participate in Sign.
 */
export function presentFearGreedChip(
  read: PresentFearGreedChipRead,
): FearGreedChip | null {
  const snapshot = read.snapshot;
  if (!snapshot || snapshot.status !== 'ready') return null;
  if (!CLASSIFICATIONS.has(snapshot.classification)) return null;
  if (
    !Number.isInteger(snapshot.value) ||
    snapshot.value < 0 ||
    snapshot.value > 100
  ) {
    return null;
  }
  if (
    !Number.isFinite(snapshot.observedAtMs) ||
    snapshot.observedAtMs > read.nowMs ||
    read.nowMs - snapshot.observedAtMs > FEAR_GREED_STALE_MS
  ) {
    return null;
  }
  const freshness = freshnessLabel(snapshot.observedAtMs, read.nowMs);
  if (!freshness) return null;
  const classification = snapshot.classification as FearGreedClassification;
  return {
    key: FEAR_GREED_CHIP_KEY,
    label: `${classification} ${snapshot.value} · ${copy.fearGreed.attribution}`,
    value: snapshot.value,
    classification,
    attribution: FEAR_GREED_ATTRIBUTION,
    freshness,
  };
}

function freshnessLabel(observedAtMs: number, nowMs: number): string | null {
  const observedDay = utcDay(observedAtMs);
  const nowDay = utcDay(nowMs);
  const dayDiff = Math.round((nowDay - observedDay) / 86_400_000);
  if (dayDiff === 0) return copy.fearGreed.today;
  if (dayDiff === 1) return copy.fearGreed.yesterday;
  if (dayDiff > 1 && nowMs - observedAtMs <= FEAR_GREED_STALE_MS) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(observedAtMs));
  }
  return null;
}

function utcDay(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
