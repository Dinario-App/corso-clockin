export const HEADLINE_CAP = 3;
export const HEADLINE_TITLE_MAX = 240;
export const HEADLINE_MAX_AGE_MS = 14 * 86_400_000;
export const HEADLINE_FUTURE_SKEW_MS = 60 * 60 * 1000;

export type HeadlineItem = {
  title: string;
  link: string;
  publisher: string;
  publishedAtMs: number;
};

export type HeadlineLane = {
  status: 'ready' | 'unavailable';
  items: HeadlineItem[];
};

export type ReviewHeadlinesResponse = {
  schemaVersion: 1;
  gdelt: HeadlineLane;
  rss: HeadlineLane;
};

export type PresentedHeadline = {
  lane: 'gdelt' | 'rss';
  title: string;
  link: string;
  publisher: string;
  publishedAtMs: number;
  when: string;
};
