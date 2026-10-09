import type { TextStyle, ViewStyle } from 'react-native';
import {
} from '@/src/features/tokenVitals/verdictSurface';
import { canonNumerals, canonTracking } from '@/src/ui/cards/canonType.js';
import type { MaterialState } from '@/src/ui/glass/materialTokens.js';
import { ONGLASS } from '@/src/ui/glass/materialTokens.js';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import { normalizeTokenMarkTicker } from '@/src/ui/primitives/tokenMarkPresentation.js';
import {
  colors,
  kitType,
  kitWeight,
  radii,
  typography,
} from '@/src/ui/tokens';

export const FEED_CARD_RADIUS = radii.pane;
/** `.fcard{padding:15px 16px}` */
export const FEED_CARD_PADDING_VERTICAL = 15;
export const FEED_CARD_PADDING_HORIZONTAL = 16;
/** `.fcard{gap:13px}` — icon well → body. */
export const FEED_CARD_GAP = 13;
export const FEED_CARD_ICON_WELL = 38;
export const FEED_CARD_ICON_WELL_RADIUS = radii.iconWellLarge;
export const FEED_CARD_GLYPH_SIZE = 16;
export const FEED_CARD_TITLE_GAP = 8;
export const FEED_CARD_TITLE_MARGIN_BOTTOM = 3;
export const FEED_CARD_VERDICT_GAP = 3;
export const FEED_CARD_VERDICT_ROW_GAP = 6;
export const FEED_CARD_VERDICT_DOT = 7;
export const FEED_CARD_TICKER_MAX_LENGTH = 4;
export const FEED_CARD_TICKER_BLEED = 8;

export const FEED_CARD_TITLE_SIZE = kitType.body;
export const FEED_CARD_PCT_SIZE = kitType.sub;
export const FEED_CARD_SUB_SIZE = kitType.sub;
export const FEED_CARD_TICKER_SIZE = kitType.caption;
export const FEED_CARD_VERDICT_WORD_SIZE = kitType.sub;
export const FEED_CARD_RISK_SIZE = kitType.sub;
export const FEED_CARD_TITLE_LINE_HEIGHT = 22;
export const FEED_CARD_TEXT_LINE_HEIGHT = 20;

/* ─── Vocabulary ──────────────────────────────────────────────────────────── */

export const FEED_CARD_VERDICT_TONES = [
  'buy',
  'caution',
  'avoid',
  'neutral',
] as const;
export type FeedCardVerdictTone = (typeof FEED_CARD_VERDICT_TONES)[number];

export const FEED_CARD_DIRECTIONS = ['up', 'down', 'flat'] as const;
export type FeedCardDirection = (typeof FEED_CARD_DIRECTIONS)[number];

export const FEED_CARD_STATES = ['rest', 'active'] as const;
export type FeedCardState = (typeof FEED_CARD_STATES)[number];

export type FeedCardPresentation = {
  /** What `<Material>` gets: `card` weight, `hi` on the active variant. */
  materialState: MaterialState;
  borderRadius: number;
  contentStyle: ViewStyle;
  wellStyle: ViewStyle;
  wellLabelStyle: TextStyle;
  bodyStyle: ViewStyle;
  titleRowStyle: ViewStyle;
  titleStyle: TextStyle;
  pctStyle: TextStyle;
  subStyle: TextStyle;
  verdictColumnStyle: ViewStyle;
  verdictRowStyle: ViewStyle;
  verdictDotStyle: ViewStyle;
  verdictWordStyle: TextStyle;
  metaStyle: TextStyle;
  /** Ticker text for the well, or null when the row draws a glyph. */
  wellLabel: string | null;
  glyph: CorsoIconName | null;
  glyphSize: number;
  glyphColor: string;
  titleText: string;
  pctText: string | null;
  subText: string;
  verdictWord: string | null;
  metaText: string | null;
  showVerdictStack: boolean;
  /** Title, percent, sub, verdict, meta — what a screen reader announces. */
  accessibilityLabel: string;
};

/* ─── Input normalisation ─────────────────────────────────────────────────── */

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toCanonMinus(value: string): string {
  return value.replace(/(^|[\s(])-(?=[\d.])/g, '$1−');
}

export function normalizeFeedCardTicker(ticker: unknown): string | null {
  let canonical: string;
  try {
    canonical = normalizeTokenMarkTicker(ticker);
  } catch {
    return null;
  }
  return Array.from(canonical).length > FEED_CARD_TICKER_MAX_LENGTH
    ? null
    : canonical;
}

function directionColor(direction: FeedCardDirection): string {
  if (direction === 'up') return colors.priceUp;
  if (direction === 'down') return colors.priceDown;
  return colors.inkTertiary;
}

function verdictColor(tone: FeedCardVerdictTone): string {
  if (tone === 'buy') return colors.priceUp;
  if (tone === 'avoid') return colors.priceDown;
  if (tone === 'caution') return colors.riskDanger;
  return colors.inkSecondary;
}

export type FeedCardInput = {
  title: unknown;
  sub: unknown;
  /** The 38px well: a ticker OR a glyph, never both, never neither. */
  ticker?: unknown;
  glyph?: unknown;
  /** Pre-formatted percent (`+2.4%`). Requires `direction`, and vice versa. */
  pct?: unknown;
  direction?: unknown;
  verdictWord?: unknown;
  verdictTone?: unknown;
  meta?: unknown;
  state?: unknown;
};

export function resolveFeedCardPresentation(
  input: FeedCardInput,
): FeedCardPresentation | null {
  const titleText = normalizeText(input.title);
  if (titleText === null) return null;

  const subText = normalizeText(input.sub);
  if (subText === null) return null;

  /** Exactly one mark. A well with neither is a hole; with both, a collision. */
  const hasTicker = input.ticker !== undefined;
  const hasGlyph = input.glyph !== undefined;
  if (hasTicker === hasGlyph) return null;

  let wellLabel: string | null = null;
  let glyph: CorsoIconName | null = null;
  if (hasTicker) {
    wellLabel = normalizeFeedCardTicker(input.ticker);
    if (wellLabel === null) return null;
  } else {
    const name = normalizeText(input.glyph);
    if (name === null) return null;
    glyph = name as CorsoIconName;
  }

  /** A number without a direction cannot be painted; a direction without a
   * number has nothing to paint. Both, or neither. */
  const hasPct = input.pct !== undefined;
  const hasDirection = input.direction !== undefined;
  if (hasPct !== hasDirection) return null;

  let pctText: string | null = null;
  let direction: FeedCardDirection = 'flat';
  if (hasPct) {
    const raw = normalizeText(input.pct);
    if (raw === null) return null;
    if (
      input.direction !== 'up' &&
      input.direction !== 'down' &&
      input.direction !== 'flat'
    ) {
      return null;
    }
    direction = input.direction;
    pctText = toCanonMinus(raw);
  }

  /** The verdict stack is a word plus a tone, or nothing at all. */
  const hasWord = input.verdictWord !== undefined;
  const hasTone = input.verdictTone !== undefined;
  if (hasWord !== hasTone) return null;

  let verdictWord: string | null = null;
  let verdictTone: FeedCardVerdictTone = 'neutral';
  if (hasWord) {
    verdictWord = normalizeText(input.verdictWord);
    if (verdictWord === null) return null;
    if (
      !FEED_CARD_VERDICT_TONES.includes(
        input.verdictTone as FeedCardVerdictTone,
      )
    ) {
      return null;
    }
    verdictTone = input.verdictTone as FeedCardVerdictTone;
  }

  let metaText: string | null = null;
  if (input.meta !== undefined) {
    metaText = normalizeText(input.meta);
    if (metaText === null) return null;
  }

  /** A bare "8/8 read" with no verdict word is half an atom. */
  if (metaText !== null && verdictWord === null) return null;

  if (
    input.state !== undefined &&
    input.state !== 'rest' &&
    input.state !== 'active'
  ) {
    return null;
  }
  const state: FeedCardState = input.state === 'active' ? 'active' : 'rest';

  const pctColor = directionColor(direction);
  const wordColor = verdictColor(verdictTone);
  const wellInk = state === 'active' ? colors.ink : colors.inkSecondary;

  return {
    materialState: state === 'active' ? 'hi' : 'rest',
    borderRadius: FEED_CARD_RADIUS,
    contentStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FEED_CARD_GAP,
      paddingVertical: FEED_CARD_PADDING_VERTICAL,
      paddingHorizontal: FEED_CARD_PADDING_HORIZONTAL,
    },
    wellStyle: {
      width: FEED_CARD_ICON_WELL,
      height: FEED_CARD_ICON_WELL,
      borderRadius: FEED_CARD_ICON_WELL_RADIUS,
      backgroundColor: ONGLASS,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    wellLabelStyle: {
      /**
       * Centred ON the well, not clipped BY it — see `FEED_CARD_TICKER_BLEED`.
       * Without this a 4-letter ticker renders as `MO…`.
       */
      position: 'absolute',
      left: -FEED_CARD_TICKER_BLEED,
      right: -FEED_CARD_TICKER_BLEED,
      textAlign: 'center',
      color: wellInk,
      fontSize: FEED_CARD_TICKER_SIZE,
      lineHeight: 16,
      letterSpacing: canonTracking(FEED_CARD_TICKER_SIZE, -0.02),
      fontFamily: typography.face(kitWeight.semibold),
      fontWeight: kitWeight.semibold,
    },
    bodyStyle: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    titleRowStyle: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: FEED_CARD_TITLE_GAP,
      marginBottom: FEED_CARD_TITLE_MARGIN_BOTTOM,
    },
    titleStyle: {
      flexShrink: 1,
      color: colors.ink,
      fontSize: FEED_CARD_TITLE_SIZE,
      lineHeight: FEED_CARD_TITLE_LINE_HEIGHT,
      letterSpacing: canonTracking(FEED_CARD_TITLE_SIZE, -0.012),
      fontFamily: typography.face(kitWeight.regular),
      fontWeight: kitWeight.regular,
    },
    pctStyle: {
      flexShrink: 0,
      color: pctColor,
      fontSize: FEED_CARD_PCT_SIZE,
      lineHeight: FEED_CARD_TEXT_LINE_HEIGHT,
      letterSpacing: canonTracking(FEED_CARD_PCT_SIZE, -0.008),
      fontFamily: typography.face(kitWeight.medium),
      fontWeight: kitWeight.medium,
      fontVariant: canonNumerals(),
    },
    subStyle: {
      color: colors.inkTertiary,
      fontSize: FEED_CARD_SUB_SIZE,
      lineHeight: FEED_CARD_TEXT_LINE_HEIGHT,
      letterSpacing: canonTracking(FEED_CARD_SUB_SIZE, -0.008),
      fontFamily: typography.face(kitWeight.regular),
      fontWeight: kitWeight.regular,
    },
    verdictColumnStyle: {
      flexShrink: 0,
      alignItems: 'flex-end',
      gap: FEED_CARD_VERDICT_GAP,
    },
    verdictRowStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: FEED_CARD_VERDICT_ROW_GAP,
    },
    verdictDotStyle: {
      width: FEED_CARD_VERDICT_DOT,
      height: FEED_CARD_VERDICT_DOT,
      borderRadius: radii.pill,
      backgroundColor: wordColor,
      flexShrink: 0,
    },
    verdictWordStyle: {
      color: wordColor,
      fontSize: FEED_CARD_VERDICT_WORD_SIZE,
      lineHeight: FEED_CARD_TEXT_LINE_HEIGHT,
      letterSpacing: canonTracking(FEED_CARD_VERDICT_WORD_SIZE, -0.008),
      fontFamily: typography.face(kitWeight.medium),
      fontWeight: kitWeight.medium,
    },
    metaStyle: {
      color: colors.inkTertiary,
      fontSize: FEED_CARD_RISK_SIZE,
      lineHeight: FEED_CARD_TEXT_LINE_HEIGHT,
      letterSpacing: canonTracking(FEED_CARD_RISK_SIZE, -0.008),
      fontFamily: typography.face(kitWeight.regular),
      fontWeight: kitWeight.regular,
      fontVariant: canonNumerals(),
    },
    wellLabel,
    glyph,
    glyphSize: FEED_CARD_GLYPH_SIZE,
    glyphColor: wellInk,
    titleText,
    pctText,
    subText,
    verdictWord,
    metaText,
    showVerdictStack: verdictWord !== null,
    accessibilityLabel: [titleText, pctText, subText, verdictWord, metaText]
      .filter((part): part is string => part !== null)
      .join(', '),
  };
}
