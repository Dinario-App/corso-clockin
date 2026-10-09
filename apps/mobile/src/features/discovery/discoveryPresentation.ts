import { copy } from '@/constants/copy';
import {
  resolveDiscoverFactsLine,
  resolveReadRing,
  type ReadRingView,
} from '@/src/features/tokenVitals/readRingCatalog';
import { MOVING_MINT_PATTERN } from '@/src/features/moving/types';
import {
  formatCompactUsd,
  formatCount,
  formatPct,
  formatSignedPct,
  priceTone,
} from '@/src/features/tokenVitals/tokenVitalsPresentation';
import { colors } from '@/src/ui/tokens';
import {
  LIFECYCLE_STAGES,
  type DiscoveryFilters,
  type DiscoveryPayload,
  type DiscoveryRow,
  type LifecycleStage,
} from './types';

export const DISCOVERY_FILTER_PRESETS = {
  minLiquidityUsd: 5_000,
  minHolders: 50,
  maxSniperPct: 20,
} as const;

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  minLiquidityUsd: null,
  minHolders: null,
  maxSniperPct: null,
};

/** The order the groups stack on screen. `unknown` only appears when it has rows. */
export const DISCOVERY_GROUP_ORDER: readonly LifecycleStage[] =
  LIFECYCLE_STAGES;

/* ─── Formatting ────────────────────────────────────────────────────────────── */

export function formatDiscoveryAge(ageMinutes: number | null): string {
  if (ageMinutes == null || !Number.isFinite(ageMinutes) || ageMinutes < 0)
    return copy.discovery.ageUnknown;
  const minutes = Math.floor(ageMinutes);
  if (minutes < 60) return copy.discovery.ageMinutes(Math.max(1, minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return copy.discovery.ageHours(hours);
  return copy.discovery.ageDays(Math.floor(hours / 24));
}

/** Sub-cent prices need more digits than the compact formatter gives. */
export function formatDiscoveryPrice(priceUsd: number | null): string | null {
  if (priceUsd == null || !Number.isFinite(priceUsd) || priceUsd <= 0)
    return null;
  if (priceUsd >= 1)
    return `$${priceUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (priceUsd >= 0.01) return `$${priceUsd.toFixed(4)}`;
  const exponent = Math.floor(Math.log10(priceUsd));
  const leadingZeros = -exponent - 1;
  const digits = Math.round(priceUsd * 10 ** (leadingZeros + 4));
  const subscript = '₀₁₂₃₄₅₆₇₈₉';
  return `$0.0${subscript[Math.min(leadingZeros, 9)]}${String(digits).slice(0, 3)}`;
}

/* ─── Verdict ───────────────────────────────────────────────────────────────── */

export type DiscoveryVerdictPresentation = {
  label: string;
  color: string;
  /** SVG-free glyph kind for the trailing-edge adjudication mark. */
  glyph: 'dot' | 'triangle' | 'descent' | 'none';
};

export function resolveDiscoveryVerdict(
  row: Pick<DiscoveryRow, 'safety'>,
): DiscoveryVerdictPresentation {
  const verdict = row.safety?.v2?.verdict ?? row.safety?.verdict ?? 'unknown';
  switch (verdict) {
    case 'green':
      return {
        label: copy.discovery.verdict.green,
        color: colors.priceUp,
        glyph: 'dot',
      };
    case 'amber':
      return {
        label: copy.discovery.verdict.amber,
        color: colors.riskDanger,
        glyph: 'triangle',
      };
    case 'red':
      return {
        label: copy.discovery.verdict.red,
        color: colors.priceDown,
        glyph: 'descent',
      };
    /**
     * `muted`, not `GLASS_FAINT`: the Discover row's verdict word renders at
     * 10px/640, which is normal text and owes 4.5:1. See the same call in
     * `tokenVitalsPresentation.ts` for why an unreadable "Unknown" is a product
     * defect before it is an accessibility one.
     */
    default:
      return {
        label: copy.discovery.verdict.unknown,
        color: colors.muted,
        glyph: 'none',
      };
  }
}

/* ─── Row ───────────────────────────────────────────────────────────────────── */

export type DiscoveryRowView = {
  mint: string;
  symbol: string;
  /**
   * The pair's own name, unjoined and unformatted — the bytes the launchpad
   * carried. `subLine` is for READING; this is what the Apple 1.2 report path
   * sends, because a moderation record wants the label a stranger typed, not
   * that label with a market cap glued to it.
   */
  name: string | null;
  /** name · mcap, single line. */
  subLine: string;
  stageLabel: string;
  /** "curve 42%" while on the curve; null once graduated or unknown. */
  curveLabel: string | null;
  priceText: string | null;
  changeText: string | null;
  changeTone: string;
  /**
   * What the ring says in words: the reads that didn't run, then the flags,
   * most severe first — or, on a fully-read clean row, the headline shares.
   * Falls back to the market line (LP · holders · snipers) with no catalog.
   */
  factsLine: string;
  /**
   * The rating, folded once (`resolveReadRing`). `null` on a row whose payload
   * carries no usable catalog: the row then draws its ticker well bare, the
   * way it always has.
   */
  ring: ReadRingView | null;
  /** "thin data · 4 min old" on a thin row; null on a fully-read row. */
  thinLine: string | null;
  ageText: string;
  verdict: DiscoveryVerdictPresentation;
  accessibilityLabel: string;
};

export function resolveDiscoveryRowView(row: DiscoveryRow): DiscoveryRowView {
  const verdict = resolveDiscoveryVerdict(row);
  const ring = resolveReadRing(row.safety);
  const ringFactsLine = resolveDiscoverFactsLine(row.safety);
  const mcap = formatCompactUsd(row.market.marketCapUsd);
  const subParts = [row.name ?? row.symbol, mcap].filter(
    (part): part is string => part != null,
  );
  const lp = formatCompactUsd(row.market.liquidityUsd);
  const holders = formatCount(row.market.holderCount);
  const sniper =
    row.sniper.status === 'known' ? formatPct(row.sniper.pct) : null;
  const curve =
    row.lifecycle.basis === 'bonding_curve'
      ? formatPct(row.lifecycle.curvePct)
      : null;
  const stageLabel = copy.discovery.stage[row.lifecycle.stage];
  return {
    mint: row.mint,
    symbol: row.symbol,
    name: row.name ?? null,
    subLine: subParts.join(' · '),
    stageLabel,
    curveLabel: curve == null ? null : copy.discovery.curve(curve),
    priceText: formatDiscoveryPrice(row.market.priceUsd),
    changeText: formatSignedPct(row.market.priceChange24hPct),
    changeTone: priceTone(row.market.priceChange24hPct),
    factsLine:
      ringFactsLine ??
      [
        lp == null ? copy.discovery.lpUnknown : copy.discovery.lp(lp),
        holders == null
          ? copy.discovery.holdersUnknown
          : copy.discovery.holders(holders),
        sniper == null
          ? copy.discovery.snipersUnknown
          : copy.discovery.snipers(sniper),
      ].join(' · '),
    ring,
    thinLine:
      row.dataCoverage === 'thin'
        ? copy.discovery.thinData(formatDiscoveryAge(row.ageMinutes))
        : null,
    ageText: formatDiscoveryAge(row.ageMinutes),
    verdict,
    accessibilityLabel: copy.discovery.rowA11y(
      row.symbol,
      stageLabel,
      verdict.label,
    ),
  };
}

/* ─── Screen ────────────────────────────────────────────────────────────────── */

export type DiscoveryGroupView = {
  stage: LifecycleStage;
  title: string;
  hint: string;
  rows: DiscoveryRowView[];
};

export type DiscoveryFilterChipView = {
  key: keyof DiscoveryFilters;
  label: string;
  active: boolean;
};

export type DiscoveryScreenView =
  | { state: 'loading'; chips: DiscoveryFilterChipView[] }
  | { state: 'off'; body: string }
  | {
      state: 'unavailable';
      title: string;
      body: string;
      chips: DiscoveryFilterChipView[];
    }
  | {
      state: 'empty';
      title: string;
      body: string;
      clearLabel: string | null;
      chips: DiscoveryFilterChipView[];
      sourcesLine: string;
    }
  | {
      state: 'list';
      groups: DiscoveryGroupView[];
      chips: DiscoveryFilterChipView[];
      sourcesLine: string;
      hiddenLine: string | null;
    };

export function resolveFilterChips(
  filters: DiscoveryFilters,
): DiscoveryFilterChipView[] {
  return [
    {
      key: 'minLiquidityUsd',
      label: copy.discovery.filters.lpFloor(
        formatCompactUsd(DISCOVERY_FILTER_PRESETS.minLiquidityUsd) ?? '',
      ),
      active: filters.minLiquidityUsd != null,
    },
    {
      key: 'minHolders',
      label: copy.discovery.filters.holderFloor(
        formatCount(DISCOVERY_FILTER_PRESETS.minHolders) ?? '',
      ),
      active: filters.minHolders != null,
    },
    {
      key: 'maxSniperPct',
      label: copy.discovery.filters.sniperCeiling(
        formatPct(DISCOVERY_FILTER_PRESETS.maxSniperPct) ?? '',
      ),
      active: filters.maxSniperPct != null,
    },
  ];
}

/** Toggle one preset on or off. Presets are the only values a chip can set. */
export function toggleDiscoveryFilter(
  filters: DiscoveryFilters,
  key: keyof DiscoveryFilters,
): DiscoveryFilters {
  return {
    ...filters,
    [key]: filters[key] == null ? DISCOVERY_FILTER_PRESETS[key] : null,
  };
}

export function anyFilterActive(filters: DiscoveryFilters): boolean {
  return (
    filters.minLiquidityUsd != null ||
    filters.minHolders != null ||
    filters.maxSniperPct != null
  );
}

export function resolveDiscoveryScreen(input: {
  enabled: boolean | null;
  payload: DiscoveryPayload | null;
  fetching: boolean;
  failed: boolean;
  filters: DiscoveryFilters;
}): DiscoveryScreenView {
  const chips = resolveFilterChips(input.filters);
  if (input.enabled === false)
    return { state: 'off', body: copy.discovery.offBody };
  if (!input.payload) {
    if (input.failed)
      return {
        state: 'unavailable',
        title: copy.discovery.unavailableTitle,
        body: copy.discovery.unavailableBody,
        chips,
      };
    return { state: 'loading', chips };
  }
  const payload = input.payload;
  const sourcesLine = copy.discovery.sources;
  const groups: DiscoveryGroupView[] = DISCOVERY_GROUP_ORDER.map((stage) => ({
    stage,
    title: copy.discovery.stage[stage],
    hint: copy.discovery.stageHint[stage],
    rows: payload.groups[stage].map(resolveDiscoveryRowView),
  })).filter((group) => group.rows.length > 0);
  if (groups.length === 0) {
    const hidden =
      payload.filters.hiddenByFilter + payload.filters.hiddenUnknown;
    if (hidden > 0 && anyFilterActive(input.filters)) {
      return {
        state: 'empty',
        title: copy.discovery.emptyTitle,
        body: copy.discovery.emptyBody(
          payload.filters.hiddenByFilter,
          payload.filters.hiddenUnknown,
        ),
        clearLabel: copy.discovery.filters.clear,
        chips,
        sourcesLine,
      };
    }
    return {
      state: 'empty',
      title: copy.discovery.noPairsTitle,
      body: copy.discovery.noPairsBody,
      clearLabel: null,
      chips,
      sourcesLine,
    };
  }
  const hidden = payload.filters.hiddenByFilter + payload.filters.hiddenUnknown;
  return {
    state: 'list',
    groups,
    chips,
    sourcesLine,
    hiddenLine:
      hidden > 0
        ? copy.discovery.emptyBody(
            payload.filters.hiddenByFilter,
            payload.filters.hiddenUnknown,
          )
        : null,
  };
}

/* ─── Tap ───────────────────────────────────────────────────────────────────── */

export type DiscoveryTapEffect = {
  href: { pathname: '/asset/[mint]'; params: { mint: string } };
};

/** Navigation only: the existing Asset route, which owns any swap. Never a quote, never Review. */
export function resolveDiscoveryTapEffect(row: {
  mint: string;
}): DiscoveryTapEffect | null {
  if (!MOVING_MINT_PATTERN.test(row.mint)) return null;
  return { href: { pathname: '/asset/[mint]', params: { mint: row.mint } } };
}
