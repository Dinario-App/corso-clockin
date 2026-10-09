import {
  HEADLINE_CAP,
  HEADLINE_TITLE_MAX,
  type HeadlineItem,
  type HeadlineLane,
  type ReviewHeadlinesResponse,
} from './types';

export type FetchReviewHeadlinesSuccess = {
  ok: true;
  body: ReviewHeadlinesResponse;
};

export type FetchReviewHeadlinesFailure = {
  ok: false;
};

export type FetchReviewHeadlinesResult =
  | FetchReviewHeadlinesSuccess
  | FetchReviewHeadlinesFailure;

export type FetchReviewHeadlinesArgs = {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  apiBaseUrl?: string | null;
  signal?: AbortSignal;
};

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function parseItem(raw: unknown): HeadlineItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.title !== 'string' || typeof row.link !== 'string')
    return null;
  if (
    typeof row.publisher !== 'string' ||
    typeof row.publishedAtMs !== 'number'
  )
    return null;
  const title = row.title.trim();
  const publisher = row.publisher.trim();
  if (title.length === 0 || title.length > HEADLINE_TITLE_MAX) return null;
  if (publisher.length === 0 || publisher.length > 80) return null;
  if (!Number.isFinite(row.publishedAtMs)) return null;
  try {
    if (new URL(row.link).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return {
    title,
    link: row.link,
    publisher,
    publishedAtMs: row.publishedAtMs,
  };
}

function parseLane(raw: unknown): HeadlineLane | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const lane = raw as { status?: unknown; items?: unknown };
  if (lane.status === 'unavailable')
    return { status: 'unavailable', items: [] };
  if (lane.status !== 'ready' || !Array.isArray(lane.items)) return null;
  const items: HeadlineItem[] = [];
  for (const item of lane.items) {
    const parsed = parseItem(item);
    if (!parsed) continue;
    items.push(parsed);
    if (items.length === HEADLINE_CAP) break;
  }
  return { status: 'ready', items };
}

function parseBody(raw: unknown): ReviewHeadlinesResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as {
    schemaVersion?: unknown;
    gdelt?: unknown;
    rss?: unknown;
  };
  if (body.schemaVersion !== 1) return null;
  const gdelt = parseLane(body.gdelt);
  const rss = parseLane(body.rss);
  if (!gdelt || !rss) return null;
  return { schemaVersion: 1, gdelt, rss };
}

export async function fetchReviewHeadlines(
  args: FetchReviewHeadlinesArgs = {},
): Promise<FetchReviewHeadlinesResult> {
  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { ok: false };
  try {
    const response = await (args.fetchImpl ?? fetch)(
      `${base}/v1/review/headlines`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: args.signal,
      },
    );
    if (!response.ok) return { ok: false };
    const body = parseBody(await response.json());
    if (!body) return { ok: false };
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}
