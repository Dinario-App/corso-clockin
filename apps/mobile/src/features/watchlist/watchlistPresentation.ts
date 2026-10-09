import { copy } from '@/constants/copy';
import {
  formatDiscoveryPrice,
  resolveDiscoveryVerdict,
  type DiscoveryVerdictPresentation,
} from '@/src/features/discovery/discoveryPresentation';
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import type { SafetyVerdict } from '@/src/features/tokenVitals/types';
import { formatSignedPct } from '@/src/features/tokenVitals/tokenVitalsPresentation';
import { formatPriceUsd } from '@/src/ui/format/numberCraft';
import { colors } from '@/src/ui/tokens';
import type { WatchedToken } from './watchlistStore';

/**
 * Em dash — the honest "no number here" placeholder (U+2014). It lives here,
 * beside the numbers it stands in for, not in `copy.ts`: the copy desk bans
 * the em dash in prose, and this is not prose.
 */
export const WATCHLIST_PLACEHOLDER = '—';

/** `.wrow{height:54px}` — a fixed height, because the row is exactly two lines. */
export const WATCHLIST_ROW_HEIGHT = 54;
export const WATCHLIST_PANE_RADIUS = 20;
/** `.wrow{padding:0 10px}` — the pane's own `padding:4px 6px` supplies the rest. */
export const WATCHLIST_ROW_PADDING_HORIZONTAL = 10;
export const WATCHLIST_VERDICT_DOT = 5;
export const WATCHLIST_PANE_PADDING_VERTICAL = 4;
export const WATCHLIST_PANE_PADDING_HORIZONTAL = 6;

export type WatchlistTone = 'up' | 'down' | 'neutral';

export type WatchlistRowView = {
  mint: string;
  symbol: string;
  /** Display name; falls back to the symbol so the line is never blank. */
  name: string;
  /** True when the label was condemned and the row is showing withheld copy. */
  labelWithheld: boolean;
  priceText: string;
  priceIsPlaceholder: boolean;
  /** `+4.2%` / `−0.8%` / em dash. */
  changeText: string;
  changeTone: WatchlistTone;
  changeIsPlaceholder: boolean;
  verdict: DiscoveryVerdictPresentation & { known: boolean };
  accessibilityLabel: string;
};

export type WatchlistScreenState = 'loading' | 'empty' | 'rows';

export type WatchlistChrome = {
  state: WatchlistScreenState;
  showRows: boolean;
  title: string | null;
  body: string | null;
};

/** Browse root segments: Discover is index 0 and the default; Watchlist is 1. */
export const BROWSE_SEGMENTS = ['discover', 'watchlist'] as const;
export type BrowseSegment = (typeof BROWSE_SEGMENTS)[number];

export function browseSegmentLabels(): readonly string[] {
  return [copy.watchlist.segmentDiscover, copy.watchlist.segmentWatchlist];
}

export function resolveBrowseSegment(index: unknown): BrowseSegment {
  return index === 1 ? 'watchlist' : 'discover';
}

export function browseSegmentIndex(segment: BrowseSegment): number {
  return segment === 'watchlist' ? 1 : 0;
}

export function changeToneColor(tone: WatchlistTone): string {
  if (tone === 'up') return colors.priceUp;
  if (tone === 'down') return colors.priceDown;
  /** Flat, or no number at all — `--ink48`, never a colour that implies a move. */
  return colors.inkTertiary;
}

/** Sign the way the rest of the app does: true minus (U+2212), never a hyphen. */
function trueMinus(text: string): string {
  return text.replace(/^-/, '−');
}

function formatPrice(price: string | number | null | undefined): string | null {
  if (price == null) return null;
  if (typeof price === 'number') return formatDiscoveryPrice(price);
  const formatted = formatPriceUsd(price);
  if (formatted) return formatted;
  const asNumber = Number(price);
  return Number.isFinite(asNumber) ? formatDiscoveryPrice(asNumber) : null;
}

/**
 * The star's spoken name. The pill's own label is "Watch" / "Watching"; what
 * it reads out is the token's symbol, which on token detail is Jupiter's word
 * and not Corso's. When the store gate condemns the pair the star STAYS — it
 * is the user's own — and it stores the real symbol so the watchlist keeps
 * pointing at the right mint, but it speaks the withheld copy instead.
 */
export function resolveWatchStarA11y(input: {
  watching: boolean;
  symbol: string;
  labelWithheld?: boolean;
}): string {
  const spoken = input.labelWithheld ? copy.watchlist.withheldSymbol : input.symbol;
  return input.watching
    ? copy.watchlist.unwatchA11y(spoken)
    : copy.watchlist.watchA11y(spoken);
}

export function resolveWatchlistRowView(input: {
  token: WatchedToken;
  /** Live quote: the `/v1/prices` decimal string, or the vitals `price.usd` number. */
  priceUsd: string | number | null | undefined;
  changePct24h: number | null | undefined;
  safety: SafetyVerdict | null | undefined;
  /** Token-facts name, when the star did not carry one. */
  factsName?: string | null;
}): WatchlistRowView {
  const rawName =
    input.token.name ??
    (input.factsName ? input.factsName.trim().slice(0, 48) : null) ??
    input.token.symbol;
  // Judged on BOTH halves and on the facts name the star did not carry, so a
  // clean symbol cannot smuggle a condemned name onto the second line.
  const labelWithheld = isModeratedTokenLabel({
    name: rawName,
    symbol: input.token.symbol,
  });
  const name = labelWithheld ? copy.watchlist.withheldName : rawName;
  const symbol = labelWithheld
    ? copy.watchlist.withheldSymbol
    : input.token.symbol;

  const price = formatPrice(input.priceUsd);
  const change =
    input.changePct24h == null ? null : formatSignedPct(input.changePct24h);
  const rounded =
    input.changePct24h == null || !Number.isFinite(input.changePct24h)
      ? 0
      : Math.round(input.changePct24h * 10) / 10;
  const changeTone: WatchlistTone =
    change === null || rounded === 0 ? 'neutral' : rounded > 0 ? 'up' : 'down';

  const verdictBase = resolveDiscoveryVerdict({ safety: input.safety ?? null });
  const known = (input.safety?.verdict ?? 'unknown') !== 'unknown';

  const priceText = price ?? WATCHLIST_PLACEHOLDER;
  const changeText = change ? trueMinus(change) : WATCHLIST_PLACEHOLDER;

  const spoken = [
    name,
    price ?? copy.watchlist.priceUnknownA11y,
    change ? `${copy.watchlist.change24h} ${changeText}` : copy.watchlist.changeUnknownA11y,
    verdictBase.label,
  ].join(', ');

  return {
    mint: input.token.mint,
    symbol,
    name,
    labelWithheld,
    priceText,
    priceIsPlaceholder: price === null,
    changeText,
    changeTone,
    changeIsPlaceholder: change === null,
    verdict: { ...verdictBase, known },
    accessibilityLabel: spoken,
  };
}

export function resolveWatchlistChrome(input: {
  hydrated: boolean;
  count: number;
}): WatchlistChrome {
  if (!input.hydrated) {
    return { state: 'loading', showRows: false, title: copy.watchlist.loading, body: null };
  }
  if (input.count === 0) {
    return {
      state: 'empty',
      showRows: false,
      title: copy.watchlist.emptyTitle,
      body: copy.watchlist.emptyBody,
    };
  }
  return { state: 'rows', showRows: true, title: null, body: null };
}
