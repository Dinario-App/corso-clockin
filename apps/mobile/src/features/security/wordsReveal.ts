import { copy } from '@/constants/copy';

export const WORDS_REVEAL_TIMEOUT_MS = 30_000;

export type WordsRevealState = {
  /** Words on screen right now. */
  wordsVisible: boolean;
  /** Auto-hide fired. Needs an explicit `Show again`. */
  autoHidden: boolean;
  /** Screenshot alert is up and words are gone for good this session. */
  screenshotAlert: boolean;
  remainingMs: number;
  hidesInLabel: string | null;
};

function clampElapsed(elapsedMs: unknown): number {
  return typeof elapsedMs === 'number' &&
    Number.isFinite(elapsedMs) &&
    elapsedMs > 0
    ? elapsedMs
    : 0;
}

export function formatHidesIn(remainingMs: number): string {
  const total = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function resolveWordsReveal(input: {
  revealed: unknown;
  elapsedMs: unknown;
  screenshotDetected: unknown;
}): WordsRevealState {
  const screenshotAlert = input.screenshotDetected === true;
  const elapsed = clampElapsed(input.elapsedMs);
  const remainingMs = Math.max(0, WORDS_REVEAL_TIMEOUT_MS - elapsed);
  const timedOut = remainingMs === 0;
  const wordsVisible = input.revealed === true && !screenshotAlert && !timedOut;
  return {
    wordsVisible,
    autoHidden: input.revealed === true && !screenshotAlert && timedOut,
    screenshotAlert,
    remainingMs,
    hidesInLabel: wordsVisible
      ? copy.v1Security.hidesIn(formatHidesIn(remainingMs))
      : null,
  };
}

export type WordsScreenshotAlert = {
  title: string;
  body: string;
  ctaLabel: string;
};

export function wordsScreenshotAlert(): WordsScreenshotAlert {
  return {
    title: copy.v1Security.screenshotTitle,
    body: copy.v1Security.screenshotBody,
    ctaLabel: copy.v1Security.screenshotCta,
  };
}

/**
 * Only an imported phrase can be revealed. Anything else has no words, so the
 * screen must refuse rather than render an empty grid.
 */
export function canRevealWords(sessionType: unknown): boolean {
  return sessionType === 'imported_seed';
}

/** 12 or 24 cells, numbered from 1. Never trims or pads to a "nice" count. */
export function splitPhraseCells(
  phrase: unknown,
): { index: number; word: string }[] {
  if (typeof phrase !== 'string') {
    return [];
  }
  return phrase
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word, i) => ({ index: i + 1, word }));
}
