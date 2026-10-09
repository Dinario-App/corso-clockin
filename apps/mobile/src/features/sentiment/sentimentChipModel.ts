export const SENTIMENT_ATTRIBUTION = 'LunarCrush';
const FRESH_MS = 6 * 60 * 60 * 1000;

export type SentimentReady = {
  status: 'ready';
  mint: string;
  symbol: string;
  galaxyScore: number;
  altRank: number;
  sentiment: number;
  socialVolume: number;
  fetchedAtMs: number;
  generatedAtMs: number;
  attribution: typeof SENTIMENT_ATTRIBUTION;
};

export type SentimentChipModel =
  | { kind: 'hidden' }
  | {
      kind: 'chip';
      lines: readonly [string, string];
      label: typeof SENTIMENT_ATTRIBUTION;
      accessibilityLabel: string;
    };

export function formatGalaxyScore(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatSocialVolume(count: number): string {
  const n = Math.round(count);
  if (n < 10_000) return n.toLocaleString('en-US');
  if (n < 1_000_000) {
    const thousands = n / 1000;
    const text =
      thousands >= 100
        ? String(Math.round(thousands))
        : (Math.round(thousands * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `${text}k`;
  }
  const millions = n / 1_000_000;
  const text =
    millions >= 100
      ? String(Math.round(millions))
      : (Math.round(millions * 10) / 10).toFixed(1).replace(/\.0$/, '');
  return `${text}m`;
}

export function formatFreshness(ageMs: number): string | null {
  if (ageMs < 0) return ageMs > -120_000 ? 'just now' : null;
  if (ageMs >= FRESH_MS) return null;
  if (ageMs < 45_000) return 'just now';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(ageMs / 3_600_000);
  return `${hours}h ago`;
}

export function presentSentimentChip(
  body: SentimentReady | null,
  nowMs: number,
): SentimentChipModel {
  if (body == null || body.attribution !== SENTIMENT_ATTRIBUTION) {
    return { kind: 'hidden' };
  }
  const freshness = formatFreshness(nowMs - body.generatedAtMs);
  if (freshness == null) return { kind: 'hidden' };
  const galaxy = formatGalaxyScore(body.galaxyScore);
  const posts = formatSocialVolume(body.socialVolume);
  const lines = [
    `Galaxy ${galaxy} · Alt rank ${body.altRank}`,
    `Sentiment ${body.sentiment} · ${posts} posts`,
  ] as const;
  return {
    kind: 'chip',
    lines,
    label: SENTIMENT_ATTRIBUTION,
    accessibilityLabel: `Galaxy ${galaxy}. Alt rank ${body.altRank}. Sentiment ${body.sentiment}. ${posts} posts. ${SENTIMENT_ATTRIBUTION}. ${freshness}.`,
  };
}
