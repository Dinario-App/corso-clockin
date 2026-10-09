import { copy } from '@/constants/copy';
import { formatObservationClock } from '@/src/features/home/asOfPresentation';
import {
  GLASS_IDLE_DOT,
  GLASS_LIVE_DOT,
  GLASS_MUTE,
} from '@/src/ui/glass/glassTokens';
import { colors, safetyPalette } from '@/src/ui/tokens';
import { READ_RING_INK } from '@/src/ui/verdict/readRingPresentation';
import { formatCandlePrice } from './candlestickPresentation';
import type {
  SafetyFlagV2,
  SafetyFlagLevel,
  SafetyVerdictLevel,
  TimeframeId,
  VitalKey,
  VitalsPayload,
} from './types';

export type VitalsCardState =
  | 'loading'
  | 'live'
  | 'stale'
  | 'partial'
  | 'error'
  | 'disambiguate';

export const VITALS_LIVE_POLL_MS = 5_000;
/** Stale past 2× the refresh interval. */
export const VITALS_STALE_AFTER_MS = VITALS_LIVE_POLL_MS * 2;
/** Dim numeric rows this much when stale. */
export const VITALS_STALE_OPACITY = 0.8;

export type VitalsPollPlan = {
  /** Whether any request should be issued at all. */
  poll: boolean;
  intervalMs: number | null;
  reason: 'focused' | 'not_focused' | 'backgrounded' | 'disabled' | 'no_mint';
};

export function resolveVitalsPollPlan(input: {
  enabled: boolean;
  focused: boolean;
  appActive: boolean;
  mint: string | null;
}): VitalsPollPlan {
  if (!input.mint) return { poll: false, intervalMs: null, reason: 'no_mint' };
  if (!input.enabled)
    return { poll: false, intervalMs: null, reason: 'disabled' };
  if (!input.appActive)
    return { poll: false, intervalMs: null, reason: 'backgrounded' };
  if (!input.focused)
    return { poll: false, intervalMs: null, reason: 'not_focused' };
  return { poll: true, intervalMs: VITALS_LIVE_POLL_MS, reason: 'focused' };
}

export function resolveVitalsCardState(input: {
  payload: VitalsPayload | null;
  hasChoices: boolean;
  fetching: boolean;
  fetchFailed: boolean;
  lastFetchedAtMs: number | null;
  nowMs: number;
  polling: boolean;
}): VitalsCardState {
  if (input.hasChoices && !input.payload) return 'disambiguate';
  if (!input.payload) return input.fetchFailed ? 'error' : 'loading';
  if (input.fetchFailed && input.lastFetchedAtMs == null) return 'error';
  const age =
    input.lastFetchedAtMs == null ? null : input.nowMs - input.lastFetchedAtMs;
  const stale =
    !input.polling ||
    (age != null && age > VITALS_STALE_AFTER_MS) ||
    input.fetchFailed;
  if (stale) return 'stale';
  const partial =
    input.payload.price === null ||
    input.payload.market === null ||
    input.payload.holders === null ||
    (input.payload.safety.v2?.verdict ?? input.payload.safety.verdict) ===
      'unknown';
  return partial ? 'partial' : 'live';
}

/* ─── Freshness dot — the only motion on the card ───────────────────────────── */

export type FreshnessPresentation = {
  dotColor: string;
  label: string;
  /** Numeric rows dim when stale; never a flash, never a colour pulse. */
  numbersOpacity: number;
};

export function resolveFreshness(input: {
  state: VitalsCardState;
  lastFetchedAtMs: number | null;
  nowMs: number;
}): FreshnessPresentation {
  if (input.state === 'live' || input.state === 'partial') {
    const seconds =
      input.lastFetchedAtMs == null
        ? 0
        : Math.max(
            0,
            Math.floor((input.nowMs - input.lastFetchedAtMs) / 1_000),
          );
    return {
      dotColor: GLASS_LIVE_DOT,
      label: copy.vitals.live(seconds),
      numbersOpacity: 1,
    };
  }
  if (input.state === 'stale') {
    return {
      /**
       * Neutral ink, never amber: staleness is a data-freshness fact, not a
       * provider-backed token-safety warning. Amber stays scoped to safety so
       * a paused feed can never read as "this token is dangerous".
       */
      dotColor: GLASS_MUTE,
      label: copy.vitals.paused,
      numbersOpacity: VITALS_STALE_OPACITY,
    };
  }
  return {
    dotColor: GLASS_IDLE_DOT,
    label: copy.vitals.checking,
    numbersOpacity: 1,
  };
}

/* ─── Formatting ────────────────────────────────────────────────────────────── */

export function formatCompactUsd(
  value: number | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  const abs = Math.abs(value);
  const fmt = (n: number, suffix: string) => {
    const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
    // 1000 of a unit is the next suffix ($999,950 → $1M, not $1,000K).
    if (rounded === 1000) {
      const next =
        suffix === 'K'
          ? 'M'
          : suffix === 'M'
            ? 'B'
            : suffix === 'B'
              ? 'T'
              : null;
      if (next) return `$1${next}`;
    }
    return `$${rounded.toLocaleString('en-US', { maximumFractionDigits: 1 })}${suffix}`;
  };
  if (abs >= 1e9) return fmt(value / 1e9, 'B');
  if (abs >= 1e6) return fmt(value / 1e6, 'M');
  if (abs >= 1e3) return fmt(value / 1e3, 'K');
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function formatSignedPct(
  value: number | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}

export function formatPct(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function formatAge(ageMinutes: number | null): string {
  if (ageMinutes == null || !Number.isFinite(ageMinutes) || ageMinutes < 0)
    return copy.vitals.ageUnknown;
  const minutes = Math.floor(ageMinutes);
  if (minutes < 60) return copy.vitals.age(`${Math.max(1, minutes)}m`);
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return copy.vitals.age(`${hours}h`);
  const days = Math.floor(hours / 24);
  if (days < 365) return copy.vitals.age(`${days}d`);
  return copy.vitals.age(`${Math.floor(days / 365)}y`);
}

export function formatCount(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value).toLocaleString('en-US');
}

export function formatRatio(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return `${(Math.round(value * 10) / 10).toFixed(1)}×`;
}

export function priceTone(changePct: number | null): string {
  if (changePct == null || !Number.isFinite(changePct) || changePct === 0)
    return colors.inkSecondary;
  return changePct > 0 ? colors.priceUp : colors.priceDown;
}

/* ─── Rows ──────────────────────────────────────────────────────────────────── */

export type VitalsHeaderPresentation = {
  symbol: string;
  name: string;
  verifiedLabel: string | null;
  verdictPill: { label: string; color: string } | null;
  accessibilityLabel: string;
};

export function resolveVitalsHeader(
  payload: VitalsPayload,
): VitalsHeaderPresentation {
  const verdict = resolveVerdictPresentation(
    payload.safety.v2?.verdict ?? payload.safety.verdict,
  );
  return {
    symbol: payload.token.symbol,
    name: payload.token.name,
    verifiedLabel: payload.token.isVerified ? copy.vitals.verified : null,
    verdictPill: { label: verdict.label, color: verdict.color },
    accessibilityLabel: copy.vitals.cardA11y(
      payload.token.symbol,
      verdict.label,
    ),
  };
}

export type VitalsPriceRowPresentation = {
  priceText: string;
  changeText: string | null;
  changeTone: string;
  frameLabel: TimeframeId;
  ageText: string;
  capText: string | null;
};

export function resolvePriceRow(
  payload: VitalsPayload,
): VitalsPriceRowPresentation | null {
  const price = payload.price;
  if (!price) return null;
  const priceText = formatCandlePrice(price.usd);
  if (!priceText) return null;
  const change = price.changePctFrame ?? price.changePct24h;
  const mc = formatCompactUsd(price.marketCapUsd);
  const fdv = formatCompactUsd(price.fdvUsd);
  return {
    priceText,
    changeText: formatSignedPct(change),
    changeTone: priceTone(change),
    frameLabel: payload.timeframe,
    ageText: formatAge(payload.token.ageMinutes),
    capText:
      mc && fdv ? copy.vitals.marketCapFdv(mc, fdv) : mc ? `MC ${mc}` : null,
  };
}

export type VitalsMarketCell = { label: string; value: string };

export function resolveMarketRow(payload: VitalsPayload): {
  cells: VitalsMarketCell[];
  cached: boolean;
  attribution: string | null;
} | null {
  const market = payload.market;
  if (!market) return null;
  const na = copy.vitals.notAvailable;
  const clock = formatObservationClock(Date.parse(market.asOf));
  return {
    cells: [
      {
        label: copy.vitals.liquidity,
        value: formatCompactUsd(market.liquidityUsd) ?? na,
      },
      {
        label: copy.vitals.volume24h,
        value: formatCompactUsd(market.volume24hUsd) ?? na,
      },
      {
        label: copy.vitals.buySell,
        value: formatRatio(market.buySellRatio24h) ?? na,
      },
    ],
    cached: market.cached === true,
    attribution: clock ? copy.chart.attribution(clock) : null,
  };
}

export const TOP10_BAR_AMBER_PCT = 50;

export type VitalsHoldersPresentation = {
  countText: string | null;
  top10Text: string | null;
  top1Text: string | null;
  /** 0..1 fill for the concentration bar. */
  barFill: number;
  barColor: string;
  tags: string[];
  cached: boolean;
};

export function resolveHoldersRow(
  payload: VitalsPayload,
): VitalsHoldersPresentation | null {
  const holders = payload.holders;
  if (!holders) return null;
  const top10 = holders.top10Pct;
  const fill = top10 == null ? 0 : Math.max(0, Math.min(1, top10 / 100));
  const counts = new Map<string, number>();
  for (const tag of holders.behaviorTags ?? [])
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return {
    countText: formatCount(holders.count),
    top10Text: top10 == null ? null : copy.vitals.top10(formatPct(top10) ?? ''),
    top1Text:
      holders.top1Pct == null
        ? null
        : copy.vitals.top1(formatPct(holders.top1Pct) ?? ''),
    barFill: fill,
    barColor:
      top10 != null && top10 > TOP10_BAR_AMBER_PCT
        ? colors.riskDanger
        : colors.inkTertiary,
    tags: [...counts.entries()].map(([tag, count]) =>
      copy.vitals.tag(tag, count),
    ),
    cached: holders.cached === true,
  };
}

/* ─── Safety ────────────────────────────────────────────────────────────────── */

export function resolveVerdictPresentation(verdict: SafetyVerdictLevel): {
  label: string;
  color: string;
} {
  switch (verdict) {
    case 'green':
      return {
        label: copy.discovery.verdict.green,
        color: safetyPalette.clear,
      };
    case 'amber':
      return {
        label: copy.discovery.verdict.amber,
        color: safetyPalette.caution,
      };
    case 'red':
      return { label: copy.discovery.verdict.red, color: safetyPalette.danger };
    default:
      return { label: copy.discovery.verdict.unknown, color: colors.muted };
  }
}

export const FLAG_GLYPH: Record<SafetyFlagLevel, string> = {
  danger: '⛔',
  warn: '⚠',
  info: 'ℹ',
  ok: '✓',
};

export const SAFETY_ROW_TONE: Readonly<Record<SafetyFlagLevel, string>> =
  Object.freeze({
    danger: safetyPalette.danger,
    warn: safetyPalette.caution,
    ok: READ_RING_INK,
    info: safetyPalette.neutral,
  });

/** Every tone a safety row may wear — the guard's population. */
export const SAFETY_ROW_TONE_VALUES: ReadonlySet<string> = new Set(
  Object.values(SAFETY_ROW_TONE),
);

export type VitalsFlagRow = {
  key: string;
  glyph: string;
  label: string;
  level: SafetyFlagLevel;
  tone: string;
  sourceLabel: string;
};

export function sourceName(source: SafetyFlagV2['source']): string {
  return source
    .split('+')
    .map((part) =>
      part === 'rugcheck'
        ? 'RugCheck'
        : part === 'birdeye_security'
          ? 'Birdeye'
          : part === 'onchain_intel'
            ? 'on-chain intel'
            : part === 'solana_tracker'
              ? 'Solana Tracker'
              : part === 'unrecognised'
                ? 'an unrecognised source'
                : 'on-chain',
    )
    .join(' + ');
}

export type VitalsSafetyPresentation = {
  verdictLabel: string;
  verdictColor: string;
  verdictLevel: SafetyVerdictLevel;
  sourcesLine: string | null;
  unreconciledLine: string | null;
  rows: VitalsFlagRow[];
  checking: boolean;
};

export function resolveSafety(
  payload: VitalsPayload,
): VitalsSafetyPresentation {
  const safety = payload.safety;
  const effective = safety.v2 ?? safety;
  const verdict = resolveVerdictPresentation(effective.verdict);
  const sources = effective.sources.map((source) => sourceName(source));
  return {
    verdictLabel: verdict.label,
    verdictColor: verdict.color,
    verdictLevel: effective.verdict,
    sourcesLine:
      sources.length > 0 ? copy.vitals.per(sources.join(' + ')) : null,
    unreconciledLine: safety.reconciled ? null : copy.vitals.unreconciled,
    rows: effective.flags.map((flag, index) => ({
      key: `${flag.key}:${index}`,
      glyph: FLAG_GLYPH[flag.level],
      label: flag.label,
      level: flag.level,
      tone: SAFETY_ROW_TONE[flag.level],
      sourceLabel: sourceName(flag.source),
    })),
    // A parsed v2 is present only after the server finished its reads, and
    // every v2 check status is terminal (`parseVitals.ts`).
    checking:
      safety.v2 == null &&
      effective.verdict === 'unknown' &&
      effective.sources.length === 0,
  };
}

/* ─── Section order from `emphasize` ────────────────────────────────────────── */

export type VitalsSectionId = 'chart' | 'market' | 'holders' | 'safety';

const DEFAULT_ORDER: VitalsSectionId[] = [
  'chart',
  'market',
  'holders',
  'safety',
];
const KEY_TO_SECTION: Record<VitalKey, VitalsSectionId> = {
  price: 'chart',
  liquidity: 'market',
  volume: 'market',
  holders: 'holders',
  safety: 'safety',
  age: 'chart',
};

/** Emphasis only reorders; it never adds or removes a section. */
export function resolveSectionOrder(
  emphasize: readonly VitalKey[] | undefined,
): VitalsSectionId[] {
  const lead: VitalsSectionId[] = [];
  for (const key of emphasize ?? []) {
    const section = KEY_TO_SECTION[key];
    if (section && !lead.includes(section)) lead.push(section);
  }
  return [
    ...lead,
    ...DEFAULT_ORDER.filter((section) => !lead.includes(section)),
  ];
}

/* ─── Footer + doors ────────────────────────────────────────────────────────── */

export type VitalsFooterPresentation = {
  informationLine: string;
  sourcesLine: string;
  lossNudge: string;
};

export function resolveFooter(
  payload: VitalsPayload,
): VitalsFooterPresentation {
  return {
    informationLine: copy.vitals.informationNotAdvice,
    sourcesLine: copy.vitals.factsPer(payload.disclosures.sourcesLabel),
    lossNudge: payload.disclosures.lossNudge,
  };
}

export type VitalsLedgerPresentation = {
  title: string;
  previewNote: string;
  rows: Array<{ label: string; value: string }>;
  reviewLabel: string;
};

export function resolveLedgerPreview(
  payload: VitalsPayload,
  payText: string | null,
): VitalsLedgerPresentation | null {
  const lead = payload.tradeLeadIn;
  if (!lead) return null;
  return {
    title: copy.vitals.ledger.title,
    previewNote: copy.vitals.ledger.preview,
    rows: [
      {
        label: copy.vitals.ledger.youPay,
        value: payText
          ? `${payText} ${lead.swap.fromSymbol}`
          : lead.swap.fromSymbol,
      },
      {
        label: copy.vitals.ledger.youReceive,
        value: copy.vitals.ledger.estimate(lead.swap.toSymbol),
      },
      {
        label: copy.vitals.ledger.priceImpact,
        value: copy.vitals.ledger.shownAtReview,
      },
      {
        label: copy.vitals.ledger.networkAndFee,
        value: copy.vitals.ledger.shownAtReview,
      },
    ],
    reviewLabel: copy.vitals.reviewSwap,
  };
}

export type VitalsChoiceRow = {
  key: string;
  mint: string;
  line: string;
  verifiedLabel: string | null;
  liquidityText: string | null;
};

export function resolveChoiceRows(
  choices: ReadonlyArray<{
    mint: string;
    symbol: string;
    isVerified: boolean | null;
    liquidityUsd: number | null;
  }>,
): VitalsChoiceRow[] {
  return choices.map((choice) => ({
    key: choice.mint,
    mint: choice.mint,
    line: copy.vitals.choiceLine(choice.symbol, choice.mint.slice(-5)),
    verifiedLabel: choice.isVerified === true ? copy.vitals.verified : null,
    liquidityText: formatCompactUsd(choice.liquidityUsd),
  }));
}
