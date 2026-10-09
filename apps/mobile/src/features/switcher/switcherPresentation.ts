import { copy } from '@/constants/copy';
import type { MovingSnapshot } from '@/src/features/moving/types';
import {
  resolveMovingStripView,
  type MovingRowView,
} from '@/src/features/moving/movingPresentation';
import { GLASS_IDLE_DOT, GLASS_LIVE_DOT } from '@/src/ui/glass/glassTokens';
import type { AskSellDoor } from '@/src/features/ask/askClient';
import { resolveVerdictWord } from '@/src/features/tokenVitals/verdictSurface';
import type { LiveCard, LiveCardStatus } from './liveCards';

/* ─── Geometry: one card in focus, neighbours peek ~28pt ───────────────────── */

export const SWITCHER_PEEK = 28;
export const SWITCHER_GAP = 12;

export type SwitcherGeometry = {
  cardWidth: number;
  snapInterval: number;
  sideInset: number;
  gap: number;
};

export function resolveSwitcherGeometry(input: {
  windowWidth: number;
}): SwitcherGeometry {
  const width = Number.isFinite(input.windowWidth)
    ? Math.max(0, input.windowWidth)
    : 0;
  const sideInset = SWITCHER_PEEK + SWITCHER_GAP;
  const cardWidth = Math.max(0, width - sideInset * 2);
  return {
    cardWidth,
    snapInterval: cardWidth + SWITCHER_GAP,
    sideInset,
    gap: SWITCHER_GAP,
  };
}

export function resolveSwitcherFocus(input: {
  offsetX: number;
  snapInterval: number;
  count: number;
}): number {
  if (input.count <= 0 || !(input.snapInterval > 0)) return 0;
  const raw = Math.round(input.offsetX / input.snapInterval);
  return Math.min(input.count - 1, Math.max(0, raw));
}

/* ─── Home view: Door vs live ───────────────────────────────────────────────── */

export type HomeView = 'door' | 'live';

/**
 * Zero live cards → Door. Cards exist → the switcher is Home, unless they
 * asked for the Door (the bag line on the live view). The Door's `N live`
 * hint is the way back.
 */
export function resolveHomeView(input: {
  cardCount: number;
  doorRequested: boolean;
}): HomeView {
  if (input.cardCount <= 0) return 'door';
  return input.doorRequested ? 'door' : 'live';
}

export function resolveLiveHint(cardCount: number): string | null {
  return cardCount > 0 ? copy.live.liveCount(cardCount) : null;
}

/* ─── Status pill: only the locked words ───────────────────────────────────── */

export type StatusPillPresentation = {
  label: string;
  dotColor: string;
};

export function resolveStatusPill(input: {
  status: LiveCardStatus | null;
}): StatusPillPresentation | null {
  switch (input.status) {
    case 'needs-sign':
      return {
        label: copy.live.needs,
        dotColor: GLASS_LIVE_DOT,
      };
    case 'signed':
      return { label: copy.live.signed, dotColor: GLASS_IDLE_DOT };
    default:
      return null;
  }
}

/* ─── Pills under the reply: tap = send, except the two doors ──────────────── */

export type LivePillAction =
  /** Send the label as the next Ask through the existing submit path. */
  | { kind: 'ask'; text: string }
  /** Open the existing `/swap` compose → Review → confirm with this handoff. */
  | { kind: 'review' }
  /** Put the sentence back in Ask with the size to edit. Sends nothing. */
  | { kind: 'edit-size'; text: string }
  /** Existing Send sheet. */
  | { kind: 'send' }
  /** Existing Fund sheet. */
  | { kind: 'fund' }
  | { kind: 'add-money' }
  | { kind: 'details'; mint: string }
  | { kind: 'vitals-review' }
  | { kind: 'sell-door'; door: AskSellDoor };

export type LivePill = { id: string; label: string; action: LivePillAction };

export const LIVE_PILL_MAX = 3;

export function resolveLivePills(card: LiveCard): LivePill[] {
  if (card.addMoney) {
    return [{ id: 'add-money', label: copy.v1.addMoney, action: { kind: 'add-money' } }];
  }
  const pills: LivePill[] = [];
  const ask = (label: string): LivePill => ({
    id: `ask:${label}`,
    label,
    action: { kind: 'ask', text: label },
  });

  if (card.kind === 'swap' && card.swap) {
    if (card.status === 'signed') {
      pills.push(ask(copy.v1.whatsMoving));
      pills.push({ id: 'send', label: copy.v1.send, action: { kind: 'send' } });
      pills.push({
        id: 'fund',
        label: copy.v1.addMoneyThenAsk,
        action: { kind: 'fund' },
      });
    } else {
      pills.push({
        id: 'review',
        label: copy.v1.review,
        action: { kind: 'review' },
      });
      pills.push({
        id: 'edit-size',
        label: copy.live.changeSize,
        action: {
          kind: 'edit-size',
          text: copy.live.swapTo(
            card.swapAmountText ?? '',
            card.swap.fromSymbol,
            card.swap.toSymbol,
          ),
        },
      });
      pills.push(ask(copy.v1.whatsMoving));
    }
    return pills.slice(0, LIVE_PILL_MAX);
  }

  if (card.kind === 'vitals' && card.vitals) {
    pills.push({
      id: 'details',
      label: copy.vitals.details,
      action: { kind: 'details', mint: card.vitals.token.mint },
    });
    if (card.vitals.tradeLeadIn) {
      pills.push({
        id: 'vitals-review',
        label: copy.vitals.reviewSwap,
        action: { kind: 'vitals-review' },
      });
    }
    for (const chip of card.chips) {
      if (!pills.some((pill) => pill.label === chip)) pills.push(ask(chip));
    }
    return pills.slice(0, LIVE_PILL_MAX);
  }

  const sellDoors = card.sellDoors ?? [];
  if (sellDoors.length > 0) {
    for (const door of sellDoors) {
      pills.push({
        id: `sell-door:${door.mint}`,
        label: door.label,
        action: { kind: 'sell-door', door },
      });
    }
    return pills.slice(0, LIVE_PILL_MAX);
  }

  for (const chip of card.chips) {
    if (!pills.some((pill) => pill.label === chip)) pills.push(ask(chip));
  }
  return pills.slice(0, LIVE_PILL_MAX);
}

export const MOVERS_CARD_ROWS = 5;

export type MoversCardRow = {
  key: string;
  symbol: string;
  numberText: string;
  numberTone: MovingRowView['numberTone'];
  accessibilityLabel: string;
  /** Tap = send this as the next Ask. Never a swap sentence, never a route. */
  ask: LivePill;
};

export type MoversCard = {
  rows: MoversCardRow[];
  /** `Why is X down?` for the first down-mover, under the rows. */
  whyDownPill: LivePill | null;
};

/** The question a tapped Moving row asks. A question, not an instruction. */
export function resolveMoverRowAsk(
  row: Pick<MovingRowView, 'symbol' | 'numberTone'>,
): LivePill {
  const text =
    row.numberTone === 'priceDown'
      ? copy.live.whyIsDown(row.symbol)
      : copy.live.whyIsUp(row.symbol);
  return {
    id: `ask:why:${row.symbol}`,
    label: text,
    action: { kind: 'ask', text },
  };
}

/**
 * Five rows from the same validated snapshot the in-thread widget reads, in
 * arrival order (never re-sorted — see `moving/types.ts`), with no price
 * column: names + % only. Null until the snapshot is ready.
 */
export function resolveMoversCard(
  snapshot: MovingSnapshot | null,
): MoversCard | null {
  const view = resolveMovingStripView(snapshot);
  if (!view) return null;
  const rows = view.rows.slice(0, MOVERS_CARD_ROWS).map((row) => ({
    key: row.key,
    symbol: row.symbol,
    numberText: row.numberText,
    numberTone: row.numberTone,
    accessibilityLabel: row.accessibilityLabel,
    ask: resolveMoverRowAsk(row),
  }));
  const down = rows.find((row) => row.numberTone === 'priceDown');
  return { rows, whyDownPill: down ? down.ask : null };
}

export function resolveLivePillRows(
  card: LiveCard,
  whyDownPill: LivePill | null,
): LivePill[][] {
  const base = resolveLivePills(card);
  const lead = whyDownPill
    ? [whyDownPill, ...base.filter((pill) => pill.id !== whyDownPill.id)]
    : base;
  if (card.kind === 'swap' && card.movers && whyDownPill) {
    const doorKind = card.status === 'signed' ? 'send' : 'review';
    const door = base.find((pill) => pill.action.kind === doorKind) ?? null;
    const chips = card.chips
      .filter((chip) => chip !== whyDownPill.label)
      .map(
        (chip): LivePill => ({
          id: `ask:${chip}`,
          label: chip,
          action: { kind: 'ask', text: chip },
        }),
      );
    const discovery = [...chips.slice(0, 1), whyDownPill].slice(0, 2);
    return door ? [discovery, [door]] : [discovery];
  }
  return [lead.slice(0, LIVE_PILL_MAX)];
}

/* ─── Movers in the thread: three rows, not ten, not a feed ────────────────── */

export const MOVERS_IN_THREAD_ROWS = 3;

export type MoversWidget = {
  caption: string;
  rows: MovingRowView[];
  /** `Why is X down?` for the first down-mover, sent as an Ask. */
  whyDownPill: LivePill | null;
};

export function resolveMoversWidget(
  snapshot: MovingSnapshot | null,
): MoversWidget | null {
  const view = resolveMovingStripView(snapshot);
  if (!view) return null;
  const rows = view.rows.slice(0, MOVERS_IN_THREAD_ROWS);
  const down = rows.find((row) => row.numberTone === 'priceDown');
  return {
    caption: copy.live.moving,
    rows,
    whyDownPill: down
      ? {
          id: `ask:why:${down.symbol}`,
          label: copy.live.whyIsDown(down.symbol),
          action: { kind: 'ask', text: copy.live.whyIsDown(down.symbol) },
        }
      : null,
  };
}

export function resolveCardAccessibilityLabel(
  card: LiveCard,
  statusPill: StatusPillPresentation | null,
): string {
  return statusPill
    ? copy.live.cardA11y(card.title, statusPill.label)
    : card.title;
}

export type SwitcherLayout = 'rail' | 'grid';

/** A two-finger spread has to change by this much before the layout flips. */
export const PINCH_THRESHOLD = 0.22;

export function pinchDistance(
  touches: ReadonlyArray<{ pageX: number; pageY: number }>,
): number | null {
  if (touches.length < 2) return null;
  const [a, b] = touches;
  return Math.hypot(a!.pageX - b!.pageX, a!.pageY - b!.pageY);
}

/**
 * Pinch in from the rail → grid. Pinch out from the grid → the focused card.
 * Anything under the threshold, or the wrong direction for the layout, is a
 * no-op — a pinch never lands on a different card than the one in focus.
 */
export function resolvePinch(input: {
  layout: SwitcherLayout;
  startDistance: number;
  distance: number;
}): SwitcherLayout | null {
  if (!(input.startDistance > 0) || !(input.distance >= 0)) return null;
  const ratio = input.distance / input.startDistance;
  if (input.layout === 'rail' && ratio < 1 - PINCH_THRESHOLD) return 'grid';
  if (input.layout === 'grid' && ratio > 1 + PINCH_THRESHOLD) return 'rail';
  return null;
}

export const GRID_COLUMNS = 2;
export const GRID_GAP = 12;
export const GRID_INSET = 16;
export const GRID_TILE_MIN_HEIGHT = 158;

export function resolveGridGeometry(input: { windowWidth: number }): {
  tileWidth: number;
  gap: number;
  inset: number;
} {
  const width = Number.isFinite(input.windowWidth)
    ? Math.max(0, input.windowWidth)
    : 0;
  const tileWidth = Math.max(
    0,
    (width - GRID_INSET * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS,
  );
  return { tileWidth, gap: GRID_GAP, inset: GRID_INSET };
}

export type GridTile = {
  id: string;
  pair: string;
  /** Widget thumbnail — pair row only, no thread. */
  thumbLine: string | null;
  thumbNote: string | null;
};

export function resolveGridTile(
  card: LiveCard,
  movers?: MoversCard | null,
): GridTile {
  if (card.kind === 'vitals') {
    return {
      id: card.id,
      pair: card.title,
      thumbLine: card.subtitle,
      thumbNote: card.vitals
        ? resolveVerdictWord(card.vitals.safety.verdict)
        : null,
    };
  }
  if (card.kind === 'movers') {
    const top = movers?.rows[0] ?? null;
    return {
      id: card.id,
      pair: card.title,
      thumbLine: top ? `${top.symbol} ${top.numberText}` : null,
      thumbNote: null,
    };
  }
  return {
    id: card.id,
    pair: card.title,
    thumbLine: card.subtitle,
    thumbNote:
      card.status === 'signed'
        ? copy.live.thumbSigned
        : card.status === 'needs-sign'
          ? copy.live.thumbNeedsSign
          : null,
  };
}
