import { copy } from '@/constants/copy';
import type { LiveCard } from '@/src/features/switcher/liveCards';
import { resolveStatusPill } from '@/src/features/switcher/switcherPresentation';
import {
  resolvePriceRow,
  resolveSafety,
} from '@/src/features/tokenVitals/tokenVitalsPresentation';
import { resolveReadRing } from '@/src/features/tokenVitals/readRingCatalog';
import type { SafetyVerdictLevel } from '@/src/features/tokenVitals/types';
import {
  resolveVerdictWord,
} from '@/src/features/tokenVitals/verdictSurface';
import type {
  FeedCardDirection,
  FeedCardState,
  FeedCardVerdictTone,
} from '@/src/ui/cards/feedCardPresentation';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';

export const HOME_FEED_ROWS = 3;

export type HomeFeedRow = {
  key: string;
  /** Index in the live-card store, for `focusLiveCard`. */
  index: number;
  ticker: string | null;
  glyph: CorsoIconName | null;
  title: string;
  sub: string;
  pct: string | null;
  direction: FeedCardDirection | null;
  verdictWord: string | null;
  verdictTone: FeedCardVerdictTone | null;
  meta: string | null;
  state: FeedCardState;
  accessibilityLabel: string;
};

/**
 * A safety verdict → the feed card's tone. ⚠️ A **colour** mapping only; the
 * word beside the dot is `resolveVerdictWord`'s.
 */
export function resolveFeedVerdictTone(
  verdict: SafetyVerdictLevel,
): FeedCardVerdictTone {
  switch (verdict) {
    case 'green':
      return 'buy';
    case 'amber':
      return 'caution';
    case 'red':
      return 'avoid';
    default:
      return 'neutral';
  }
}

/** `priceTone`'s colour answer, as the feed card's direction vocabulary. */
function resolveDirection(changeText: string | null): FeedCardDirection | null {
  if (changeText === null) return null;
  if (changeText.startsWith('+')) return 'up';
  if (changeText.startsWith('−') || changeText.startsWith('-'))
    return 'down';
  return 'flat';
}

/** The last thing Corso said in this thread — the row's second line. */
function lastCoachLine(card: LiveCard): string | null {
  const line = [...card.thread]
    .reverse()
    .find((item) => item.role === 'coach');
  return line?.text ?? null;
}

function rowFor(card: LiveCard, index: number): HomeFeedRow | null {
  if (card.kind === 'movers') return null;

  const sub = card.subtitle ?? lastCoachLine(card) ?? '';
  if (card.title.trim().length === 0) return null;

  const base = {
    key: card.id,
    index,
    state: 'rest' as FeedCardState,
  };

  if (card.kind === 'vitals' && card.vitals) {
    const payload = card.vitals;
    const safety = resolveSafety(payload);
    const price = resolvePriceRow(payload);
    const ring = resolveReadRing(payload.safety);
    const verdictWord = resolveVerdictWord(payload.safety.verdict);
    return {
      ...base,
      ticker: payload.token.symbol,
      glyph: null,
      title: payload.token.name || payload.token.symbol,
      sub: sub || safety.sourcesLine || '',
      pct: price?.changeText ?? null,
      direction: resolveDirection(price?.changeText ?? null),
      verdictWord,
      verdictTone: resolveFeedVerdictTone(payload.safety.verdict),
      meta: ring === null ? null : ring.coverageShort,
      accessibilityLabel: [
        payload.token.name || payload.token.symbol,
        price?.changeText,
        sub,
        verdictWord,
        ring === null ? null : ring.coverageShort,
      ]
        .filter((part): part is string => part != null && part.length > 0)
        .join(', '),
    };
  }

  const status =
    card.kind === 'swap'
      ? resolveStatusPill({ status: card.status })
      : null;

  return {
    ...base,
    ticker: null,
    glyph: card.kind === 'swap' ? 'swap' : 'sparkle',
    title: card.title,
    sub,
    pct: null,
    direction: null,
    verdictWord: status?.label ?? null,
    verdictTone:
      status === null ? null : card.status === 'signed' ? 'buy' : 'neutral',
    meta: null,
    accessibilityLabel: [card.title, sub, status?.label]
      .filter((part): part is string => part != null && part.length > 0)
      .join(', '),
  };
}

export function resolveHomeFeed(input: {
  cards: readonly LiveCard[];
  focusIndex: number;
}): HomeFeedRow[] {
  const rows: HomeFeedRow[] = [];
  /** Newest first — the same order the threads panel lists. */
  for (let index = 0; index < input.cards.length; index += 1) {
    if (index === input.focusIndex) continue;
    const row = rowFor(input.cards[index]!, index);
    if (row) rows.push(row);
    if (rows.length === HOME_FEED_ROWS) break;
  }
  return rows;
}

/** The feed's section header, when there is a feed to head. */
export function resolveHomeFeedHeader(rowCount: number): string | null {
  return rowCount > 0 ? copy.live.threadsTitle : null;
}
