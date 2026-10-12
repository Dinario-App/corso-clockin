import { copy } from '@/constants/copy';
import { whyMoodV2 } from '@/constants/copy/why';
import {
  FEAR_GREED_ATTRIBUTION,
  FEAR_GREED_CHIP_KEY,
  FEAR_GREED_CLASSIFICATIONS,
  FEAR_GREED_MOOD,
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
  const mood = moodWord(classification);
  if (!mood) return null;
  return {
    key: FEAR_GREED_CHIP_KEY,
    label: `${mood.charAt(0).toUpperCase()}${mood.slice(1)} ${snapshot.value} · ${copy.fearGreed.attribution}`,
    value: snapshot.value,
    classification,
    mood,
    attribution: FEAR_GREED_ATTRIBUTION,
    freshness,
  };
}

function moodWord(classification: FearGreedClassification): string | null {
  if (!Object.hasOwn(FEAR_GREED_MOOD, classification)) return null;
  const word = whyMoodV2[FEAR_GREED_MOOD[classification]];
  return typeof word === 'string' && word.length > 0 ? word : null;
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
