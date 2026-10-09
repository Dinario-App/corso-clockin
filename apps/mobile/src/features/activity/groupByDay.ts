import type { ActivityItem } from './types';

export type ActivityDayGroup = {
  key: string;
  label: string;
  items: ActivityItem[];
};

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(dayStartMs: number, nowMs: number): string {
  const today = startOfLocalDay(nowMs);
  const yesterday = today - 24 * 60 * 60 * 1000;
  if (dayStartMs === today) return 'Today';
  if (dayStartMs === yesterday) return 'Yesterday';
  return new Date(dayStartMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Group items by local calendar day; unknown times go under "Earlier". */
export function groupActivityByDay(
  items: ActivityItem[],
  nowMs: number = Date.now(),
): ActivityDayGroup[] {
  const buckets = new Map<string, ActivityDayGroup>();

  for (const item of items) {
    if (item.blockTimeMs == null) {
      const key = 'earlier';
      const existing = buckets.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        buckets.set(key, { key, label: 'Earlier', items: [item] });
      }
      continue;
    }

    const dayStart = startOfLocalDay(item.blockTimeMs);
    const key = String(dayStart);
    const existing = buckets.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      buckets.set(key, {
        key,
        label: dayLabel(dayStart, nowMs),
        items: [item],
      });
    }
  }

  const groups = [...buckets.values()];
  groups.sort((a, b) => {
    if (a.key === 'earlier') return 1;
    if (b.key === 'earlier') return -1;
    return Number(b.key) - Number(a.key);
  });
  return groups;
}

export function formatActivityTime(blockTimeMs: number | null): string {
  if (blockTimeMs == null) return '';
  return new Date(blockTimeMs).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}
