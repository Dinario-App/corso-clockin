import { copy } from '@/constants/copy';
import { GLASS_FAINT, GLASS_MUTE } from '@/src/ui/glass/glassTokens';
import { colors, radii } from '@/src/ui/tokens';
import { truncateAddress } from '@/src/lib/truncateAddress';
import {
  resolveActivityListChrome,
  resolveActivityStatusLabel,
} from './activityRoutePresentation';
import {
  resolveActivityRowTitle,
  type ActivityRowLabelEvidence,
} from './activityLabels';
import { formatActivityAmount } from './formatActivityAmount';
import { groupActivityByDay } from './groupByDay';
import type { ActivityItem } from './types';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';

/** Em dash — the honest "no number here" placeholder (U+2014). */
export const ACTIVITY_FEED_PLACEHOLDER = '—';

export const ACTIVITY_FEED_ROW_RADIUS = radii.pane;
export const ACTIVITY_FEED_ROW_PADDING_VERTICAL = 15;
export const ACTIVITY_FEED_ROW_PADDING_HORIZONTAL = 16;
export const ACTIVITY_FEED_ROW_GAP = 13;
export const ACTIVITY_FEED_ICON_WELL = 38;
export const ACTIVITY_FEED_ICON_WELL_RADIUS = radii.iconWellLarge;
export const ACTIVITY_FEED_STATUS_DOT = 7;
/** `.pend i` — the pending dot, deliberately smaller than the settled one. */
export const ACTIVITY_FEED_PENDING_DOT = 5;
export const ACTIVITY_FEED_PENDING_CHIP_PADDING_VERTICAL = 3;
export const ACTIVITY_FEED_PENDING_CHIP_PADDING_HORIZONTAL = 9;
export const ACTIVITY_FEED_STATUS_GAP = 6;
/** `.pend i` pulse — 2.2s ease-in-out, 1 → .35 → 1. Reduce Motion kills it. */
export const ACTIVITY_FEED_PENDING_PULSE_MS = 2200;
export const ACTIVITY_FEED_PENDING_PULSE_MIN_OPACITY = 0.35;
export const ACTIVITY_FEED_ASIDE_GAP = 3;
export const ACTIVITY_FEED_ROW_SPACING = 10;
export const ACTIVITY_FEED_SECTION_PADDING_TOP = 28;
export const ACTIVITY_FEED_SECTION_PADDING_BOTTOM = 12;

export type ActivityFeedTone = 'up' | 'down' | 'neutral';

export type ActivityFeedStatusKind = 'pending' | 'settled' | 'failed';

export type ActivityFeedRowView = {
  signature: string;
  kind: ActivityItem['kind'];
  /** Ticker for the accessible reading; null when the row is unclassified. */
  ticker: string | null;
  title: string;
  /** `3D9f…eofc · 2h ago` — counterparty (or signature) and relative time. */
  subLine: string;
  amountText: string;
  amountTone: ActivityFeedTone;
  amountIsPlaceholder: boolean;
  fiatText: string | null;
  statusLabel: string;
  statusTone: ActivityFeedTone;
  statusKind: ActivityFeedStatusKind;
  accessibilityLabel: string;
};

export type ActivityFeedGroupView = {
  key: string;
  label: string;
  rows: ActivityFeedRowView[];
};

export type ActivityFeedState = 'loading' | 'error' | 'empty' | 'rows';

export type ActivityFeedChrome = {
  state: ActivityFeedState;
  showRows: boolean;
  title: string | null;
  /** Supporting line under the headline; null while rows show. */
  body: string | null;
};

export function toneColor(tone: ActivityFeedTone): string {
  switch (tone) {
    case 'up':
      return colors.priceUp;
    case 'down':
      return colors.priceDown;
    default:
      return colors.ink;
  }
}

export function statusToneColor(tone: ActivityFeedTone): string {
  return tone === 'down' ? colors.priceDown : GLASS_MUTE;
}

export function statusDotColor(_tone: ActivityFeedTone): string {
  return GLASS_FAINT;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Relative time for the sub-line. Coarse on purpose — a feed row is not a
 * receipt; the exact time lives on the detail screen. Unknown block time is
 * said plainly.
 */
export function formatRelativeTime(
  blockTimeMs: number | null,
  nowMs: number,
): string {
  if (blockTimeMs == null || !Number.isFinite(blockTimeMs)) {
    return copy.activity.timeUnknown;
  }
  const delta = Math.max(0, nowMs - blockTimeMs);
  if (delta < MINUTE_MS) return copy.activity.justNow;
  if (delta < HOUR_MS)
    return copy.activity.minutesAgo(Math.floor(delta / MINUTE_MS));
  if (delta < DAY_MS)
    return copy.activity.hoursAgo(Math.floor(delta / HOUR_MS));
  const days = Math.floor(delta / DAY_MS);
  if (days === 1) return copy.activity.yesterday;
  if (days < 7) return copy.activity.daysAgo(days);
  return new Date(blockTimeMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function isPositiveSigned(amount: string): boolean {
  return amount.startsWith('+');
}

function tickerFor(item: ActivityItem): string | null {
  if (item.kind === 'unknown') return null;
  return item.amountSymbol ?? 'SOL';
}

function statusTone(status: ActivityItem['status']): ActivityFeedTone {
  if (status === 'confirmed') return 'up';
  if (status === 'failed') return 'down';
  return 'neutral';
}

/** Which of the two right-stack state renderings this row takes. */
export function statusKindFor(
  status: ActivityItem['status'],
): ActivityFeedStatusKind {
  if (status === 'pending') return 'pending';
  if (status === 'failed') return 'failed';
  return 'settled';
}

/**
 * One feed row. Amount tone is `up` only for a confirmed `+` amount; failed
 * rows print the placeholder because nothing moved.
 */
export function resolveActivityFeedRow(
  item: ActivityItem,
  input: { nowMs: number; labels?: ActivityRowLabelEvidence },
): ActivityFeedRowView {
  const title = resolveActivityRowTitle(item, input.labels);
  const rawAmount =
    item.status === 'failed' ? null : formatActivityAmount(item);
  const amountIsPlaceholder = rawAmount === null;
  const amountText = rawAmount ?? ACTIVITY_FEED_PLACEHOLDER;
  const amountTone: ActivityFeedTone =
    !amountIsPlaceholder &&
    item.status === 'confirmed' &&
    isPositiveSigned(amountText)
      ? 'up'
      : 'neutral';

  const who = item.counterparty
    ? truncateAddress(item.counterparty)
    : truncateAddress(item.signature);
  const when = formatRelativeTime(item.blockTimeMs, input.nowMs);
  const subLine = `${who} · ${when}`;

  const statusLabel =
    resolveActivityStatusLabel(item.status) ?? copy.activity.statusConfirmed;
  const tone = statusTone(item.status);

  const spokenAmount = amountIsPlaceholder
    ? copy.activity.amountUnknownA11y
    : amountText;

  return {
    signature: item.signature,
    kind: item.kind,
    ticker: tickerFor(item),
    title,
    subLine,
    amountText,
    amountTone,
    amountIsPlaceholder,
    /** 🔴 See `fiatText` on the type: no priced source, so no fiat line. */
    fiatText: null,
    statusLabel,
    statusTone: tone,
    statusKind: statusKindFor(item.status),
    accessibilityLabel: `${title}, ${subLine}, ${spokenAmount}, ${statusLabel}`,
  };
}

export function resolveActivityFeedGroups(
  items: ActivityItem[],
  nowMs: number,
  labelsFor: (signature: string) => ActivityRowLabelEvidence | undefined = () =>
    undefined,
): ActivityFeedGroupView[] {
  return groupActivityByDay(items, nowMs).map((group) => ({
    key: group.key,
    label: group.label,
    rows: group.items.map((item) =>
      resolveActivityFeedRow(item, { nowMs, labels: labelsFor(item.signature) }),
    ),
  }));
}

export const ACTIVITY_EMPTY_GLYPH: CorsoIconName = 'swap';

export function resolveActivityFeedChrome(input: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  itemCount: number;
  hasAddress?: boolean;
}): ActivityFeedChrome {
  if (input.hasAddress === false) {
    return {
      state: 'empty',
      showRows: false,
      title: copy.roots.activitySignedOutTitle,
      body: copy.roots.activitySignedOutBody,
    };
  }
  const chrome = resolveActivityListChrome({
    status: input.status === 'idle' ? 'loading' : input.status,
    itemCount: input.itemCount,
    filteredCount: input.itemCount,
    filter: 'all',
  });
  if (chrome.state === 'loading') {
    return {
      state: 'loading',
      showRows: false,
      title: copy.activity.loading,
      body: null,
    };
  }
  if (chrome.state === 'error') {
    return {
      state: 'error',
      showRows: input.itemCount > 0,
      title: copy.activity.error,
      body: copy.roots.activityErrorHint,
    };
  }
  if (chrome.state === 'empty' || chrome.state === 'filtered-empty') {
    return {
      state: 'empty',
      showRows: false,
      title: copy.roots.activityEmptyTitle,
      body: copy.roots.activityEmptyBody,
    };
  }
  return { state: 'rows', showRows: true, title: null, body: null };
}
