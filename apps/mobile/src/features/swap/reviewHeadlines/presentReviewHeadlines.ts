import {
  HEADLINE_CAP,
  HEADLINE_FUTURE_SKEW_MS,
  HEADLINE_MAX_AGE_MS,
  HEADLINE_TITLE_MAX,
  type HeadlineItem,
  type PresentedHeadline,
  type ReviewHeadlinesResponse,
} from './types';

const WHEN = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function httpsLink(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function presentLane(
  lane: 'gdelt' | 'rss',
  items: HeadlineItem[],
  nowMs: number,
): PresentedHeadline[] {
  const ranked = items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        b.item.publishedAtMs - a.item.publishedAtMs || a.index - b.index,
    );
  const rows: PresentedHeadline[] = [];
  for (const { item } of ranked) {
    const title = item.title.trim();
    const link = httpsLink(item.link);
    const publisher = item.publisher.trim();
    if (title.length === 0 || title.length > HEADLINE_TITLE_MAX) continue;
    if (!link || publisher.length === 0 || publisher.length > 80) continue;
    if (!Number.isFinite(item.publishedAtMs)) continue;
    if (item.publishedAtMs > nowMs + HEADLINE_FUTURE_SKEW_MS) continue;
    if (nowMs - item.publishedAtMs > HEADLINE_MAX_AGE_MS) continue;
    rows.push({
      lane,
      title,
      link,
      publisher,
      publishedAtMs: item.publishedAtMs,
      when: WHEN.format(item.publishedAtMs),
    });
    if (rows.length === HEADLINE_CAP) break;
  }
  return rows;
}

/**
 * Display rows for Review. Missing, failed, stale, or empty lanes return
 * null so the strip is omitted. Not a Sign input.
 */
export function presentReviewHeadlines(read: {
  body: ReviewHeadlinesResponse | null;
  nowMs: number;
}): PresentedHeadline[] | null {
  if (!read.body || read.body.schemaVersion !== 1) return null;
  const rows = [
    ...presentLane(
      'gdelt',
      read.body.gdelt.status === 'ready' ? read.body.gdelt.items : [],
      read.nowMs,
    ),
    ...presentLane(
      'rss',
      read.body.rss.status === 'ready' ? read.body.rss.items : [],
      read.nowMs,
    ),
  ];
  return rows.length > 0 ? rows : null;
}
