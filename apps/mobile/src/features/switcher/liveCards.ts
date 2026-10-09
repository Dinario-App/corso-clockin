import type { ConnectedTake } from '@/src/features/ask/connectedBrainAsk';
import { copy } from '@/constants/copy';
import type {
  AskAnswer,
  AskSellDoor,
  AskSwapHandoff,
} from '@/src/features/ask/askClient';
import type { HoldingsSnapshot } from '@/src/features/balances/computeFiatTotal';
import { formatAtomicAmount } from '@/src/features/swap/tokens';
import type {
  VitalsDisambiguation,
  VitalsPayload,
} from '@/src/features/tokenVitals/types';

export type LiveCardStatus = 'needs-sign' | 'signed' | 'expired';

export type LiveCardDone = {
  payText: string;
  receiveText: string;
  receiveSymbol: string;
};

export type LiveThreadItem = {
  id: string;
  role: 'user' | 'coach';
  text: string;
};

export type LiveCard = {
  connectedTake?: ConnectedTake;
  connectedTakeAllowed?: true;
  id: string;
  kind: 'swap' | 'ask' | 'movers' | 'vitals';
  createdAtMs: number;
  /** Header: `USDC → JUP` for a swap, the question for an ask. */
  title: string;
  /** Mute size line under the header: `200 USDC`. */
  subtitle: string | null;
  status: LiveCardStatus | null;
  thread: LiveThreadItem[];
  /** The server-resolved handoff the `Review` pill re-sends to `/swap`. */
  swap: AskSwapHandoff | null;
  /** Display size for the swap (`200`), from the from-token's decimals. */
  swapAmountText: string | null;
  /** Set once signed: the done pair (`200 → 1,842`). */
  done: LiveCardDone | null;
  /** The thread asked about Moving: the 3-row widget lands in it. */
  movers: boolean;
  /** Server follow-up chips. Tap = send as the next Ask. */
  chips: string[];
  sellDoors: AskSellDoor[];
  vitals: VitalsPayload | null;
  /**
   * The name matched more than one mint: the server refused to guess and sent
   * the rows. A tap re-issues the intent by exact mint through the app-only
   * BFF path (`fetchVitals`), never through the model.
   */
  vitalsChoices: VitalsDisambiguation | null;
  unavailable: boolean;
  perClientRateLimit?: true;
  /** Refused amount: the only next action is the Buy door. */
  addMoney?: true;
  updatedAtMs?: number;
  name?: string | null;
  pinned?: boolean;
  pinnedAtMs?: number;
};

export type LiveCardsState = {
  cards: LiveCard[];
  /** The card on Home. `NO_FOCUS` after New: no card, the next ask mints one. */
  focusIndex: number;
};

export const EMPTY_LIVE_CARDS: LiveCardsState = Object.freeze({
  cards: [],
  focusIndex: 0,
}) as LiveCardsState;

export function pairTitle(
  swap: Pick<AskSwapHandoff, 'fromSymbol' | 'toSymbol'>,
): string {
  return `${swap.fromSymbol} → ${swap.toSymbol}`;
}

function fromDecimals(
  holdings: HoldingsSnapshot | null,
  symbol: string,
): number | null {
  const line = holdings?.lines.find((entry) => entry.symbol === symbol);
  return line ? line.decimals : null;
}

export function swapAmountText(
  swap: AskSwapHandoff,
  holdings: HoldingsSnapshot | null,
): string | null {
  const decimals = fromDecimals(holdings, swap.fromSymbol);
  if (decimals === null || !/^\d+$/.test(swap.inAmountAtomic)) return null;
  return formatAtomicAmount(swap.inAmountAtomic, decimals);
}

export const MOVERS_CARD_ID = 'card:movers';

export function isMovingAsk(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === copy.v1.whatsMoving.toLowerCase() ||
    normalized === copy.v1.whatIsTrending.toLowerCase() ||
    normalized === copy.ask.quickActions.movingFill.toLowerCase()
  );
}

export function threadRecencyMs(
  card: Pick<LiveCard, 'createdAtMs' | 'updatedAtMs'>,
): number {
  return typeof card.updatedAtMs === 'number' &&
    Number.isFinite(card.updatedAtMs)
    ? card.updatedAtMs
    : card.createdAtMs;
}

export function clampFocus(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(index)));
}

export const NO_FOCUS = -1;

export function applyAskToLiveCards(input: ApplyAskInput): LiveCardsState {
  const next = landAskOnLiveCards(input);
  const landed = next.cards[next.focusIndex];
  if (!landed) return next;
  const cards = next.cards.slice();
  cards[next.focusIndex] = { ...landed, updatedAtMs: input.nowMs };
  return { cards, focusIndex: next.focusIndex };
}

type ApplyAskInput = {
  state: LiveCardsState;
  text: string;
  answer: AskAnswer;
  holdings: HoldingsSnapshot | null;
  nowMs: number;
  /** Unique per call, and across launches. The store passes `nextLiveCardSeed()`. */
  seed: string;
};

function landAskOnLiveCards(input: ApplyAskInput): LiveCardsState {
  const { state, text, answer, holdings, nowMs, seed } = input;
  const cards = state.cards.slice();
  const focus = clampFocus(state.focusIndex, cards.length);
  const focused = state.focusIndex === NO_FOCUS ? null : (cards[focus] ?? null);
  const userItem: LiveThreadItem = { id: `${seed}:u`, role: 'user', text };
  const coachText = answer.answer.trim() || copy.live.coachReady;
  const coachItem: LiveThreadItem = {
    id: `${seed}:c`,
    role: 'coach',
    text: coachText,
  };
  const movers = isMovingAsk(text);
  const outage = {
    unavailable: answer.status === 'unavailable',
    perClientRateLimit:
      answer.perClientRateLimit === true ? (true as const) : undefined,
  };

  if (answer.swap && !answer.addMoney) {
    const title = pairTitle(answer.swap);
    const amountText = swapAmountText(answer.swap, holdings);
    const subtitle = amountText
      ? `${amountText} ${answer.swap.fromSymbol}`
      : null;
    const samePair =
      focused && focused.kind === 'swap' && focused.title === title
        ? focused
        : null;
    if (samePair) {
      cards[focus] = {
        ...samePair,
        subtitle,
        status: 'needs-sign',
        thread: [...samePair.thread, userItem, coachItem],
        swap: answer.swap,
        swapAmountText: amountText,
        done: null,
        movers: false,
        chips: answer.chips,
        sellDoors: answer.sellDoors ?? [],
        ...outage,
        connectedTake: undefined,
        connectedTakeAllowed: answer.connectedTakeAllowed,
      };
      return { cards, focusIndex: focus };
    }
    cards.push({
      id: `card:${seed}`,
      kind: 'swap',
      createdAtMs: nowMs,
      title,
      subtitle,
      status: 'needs-sign',
      thread: [userItem, coachItem],
      swap: answer.swap,
      swapAmountText: amountText,
      done: null,
      movers: false,
      chips: answer.chips,
      sellDoors: answer.sellDoors ?? [],
      vitals: null,
      vitalsChoices: null,
      ...outage,
      connectedTake: undefined,
      connectedTakeAllowed: answer.connectedTakeAllowed,
    });
    return { cards, focusIndex: cards.length - 1 };
  }

  if (answer.vitals && !answer.addMoney) {
    const vitals =
      answer.vitals.render === 'token_vitals' ? answer.vitals : null;
    const vitalsChoices =
      answer.vitals.render === 'token_vitals_disambiguate'
        ? answer.vitals
        : null;
    const title = vitals
      ? vitals.token.symbol
      : copy.vitals.which(vitalsChoices?.query ?? '');
    // The same token asked again lands on its card; a different one mints.
    const sameToken =
      vitals &&
      focused &&
      focused.kind === 'vitals' &&
      focused.vitals?.token.mint === vitals.token.mint
        ? focused
        : null;
    if (sameToken) {
      cards[focus] = {
        ...sameToken,
        thread: [...sameToken.thread, userItem, coachItem],
        chips: answer.chips,
        sellDoors: answer.sellDoors ?? [],
        vitals,
        vitalsChoices: null,
        ...outage,
        connectedTake: undefined,
        connectedTakeAllowed: answer.connectedTakeAllowed,
      };
      return { cards, focusIndex: focus };
    }
    cards.push({
      id: `card:${seed}`,
      kind: 'vitals',
      createdAtMs: nowMs,
      title,
      subtitle: vitals ? vitals.token.name : null,
      status: null,
      thread: [userItem, coachItem],
      swap: null,
      swapAmountText: null,
      done: null,
      movers: false,
      chips: answer.chips,
      sellDoors: answer.sellDoors ?? [],
      vitals,
      vitalsChoices,
      ...outage,
      connectedTake: undefined,
      connectedTakeAllowed: answer.connectedTakeAllowed,
    });
    return { cards, focusIndex: cards.length - 1 };
  }

  if (movers && focused?.kind === 'movers') {
    cards[focus] = {
      ...focused,
      thread: [...focused.thread, userItem, coachItem],
      chips: answer.chips,
      sellDoors: answer.sellDoors ?? [],
      ...outage,
      connectedTake: undefined,
      connectedTakeAllowed: answer.connectedTakeAllowed,
    };
    return { cards, focusIndex: focus };
  }

  if (movers && !focused) {
    if (state.focusIndex !== NO_FOCUS) {
      const existing = cards.findIndex((card) => card.kind === 'movers');
      if (existing >= 0) {
        const card = cards[existing]!;
        cards[existing] = {
          ...card,
          thread: [...card.thread, userItem, coachItem],
          chips: answer.chips,
          sellDoors: answer.sellDoors ?? [],
          ...outage,
          connectedTake: undefined,
          connectedTakeAllowed: answer.connectedTakeAllowed,
        };
        return { cards, focusIndex: existing };
      }
    }
    cards.push({
      id: state.focusIndex === NO_FOCUS ? `card:${seed}` : MOVERS_CARD_ID,
      kind: 'movers',
      createdAtMs: nowMs,
      title: copy.live.moving,
      subtitle: null,
      status: null,
      thread: [userItem, coachItem],
      swap: null,
      swapAmountText: null,
      done: null,
      movers: true,
      chips: answer.chips,
      sellDoors: answer.sellDoors ?? [],
      vitals: null,
      vitalsChoices: null,
      ...outage,
      connectedTake: undefined,
      connectedTakeAllowed: answer.connectedTakeAllowed,
    });
    return { cards, focusIndex: cards.length - 1 };
  }

  if (focused && !answer.addMoney) {
    cards[focus] = {
      ...focused,
      addMoney: undefined,
      thread: [...focused.thread, userItem, coachItem],
      movers: movers || focused.movers,
      chips: answer.chips,
      sellDoors: answer.sellDoors ?? [],
      ...outage,
      connectedTake: undefined,
      connectedTakeAllowed: answer.connectedTakeAllowed,
    };
    return { cards, focusIndex: focus };
  }

  cards.push({
    id: `card:${seed}`,
    kind: 'ask',
    ...(answer.addMoney ? { addMoney: true as const } : {}),
    createdAtMs: nowMs,
    title: text,
    subtitle: null,
    status: null,
    thread: [userItem, coachItem],
    swap: null,
    swapAmountText: null,
    done: null,
    movers,
    chips: answer.chips,
    sellDoors: answer.sellDoors ?? [],
    vitals: null,
    vitalsChoices: null,
    ...outage,
    connectedTakeAllowed: answer.connectedTakeAllowed,
  });
  return { cards, focusIndex: cards.length - 1 };
}

export function applyVitalsToLiveCards(input: {
  state: LiveCardsState;
  cardId: string;
  vitals: VitalsPayload;
}): LiveCardsState {
  let changed = false;
  const cards = input.state.cards.map((card) => {
    if (card.id !== input.cardId || card.kind !== 'vitals') return card;
    changed = true;
    const thread =
      card.vitalsChoices !== null
        ? [
            ...card.thread,
            {
              id: `${card.id}:pick:${input.vitals.token.mint}`,
              role: 'coach' as const,
              text: copy.vitals.picked(input.vitals.token.symbol),
            },
          ]
        : card.thread;
    return {
      ...card,
      thread,
      title: input.vitals.token.symbol,
      subtitle: input.vitals.token.name,
      vitals: input.vitals,
      vitalsChoices: null,
      // A payload landed: whatever this card last said, it is not an outage now.
      unavailable: false,
      perClientRateLimit: undefined,
    };
  });
  return changed ? { cards, focusIndex: input.state.focusIndex } : input.state;
}

export function markLiveCardSigned(
  state: LiveCardsState,
  cardId: string,
  done: LiveCardDone | null = null,
): LiveCardsState {
  let changed = false;
  const cards = state.cards.map((card) => {
    if (
      card.id !== cardId ||
      card.kind !== 'swap' ||
      card.status === 'signed'
    ) {
      return card;
    }
    changed = true;
    const subtitle = done
      ? copy.live.donePair(done.payText, done.receiveText)
      : card.subtitle;
    const beat: LiveThreadItem[] = done
      ? [
          { id: `${card.id}:signed:u`, role: 'user', text: copy.v1.review },
          {
            id: `${card.id}:signed:c`,
            role: 'coach',
            text: copy.live.coachDone(done.receiveText, done.receiveSymbol),
          },
        ]
      : [];
    return {
      ...card,
      status: 'signed' as const,
      subtitle,
      done,
      thread: [...card.thread, ...beat],
    };
  });
  return changed ? { cards, focusIndex: state.focusIndex } : state;
}

export function hasReplyOnScreen(state: LiveCardsState): boolean {
  // After New nothing is on screen, whatever the deck holds.
  if (state.focusIndex === NO_FOCUS) return false;
  const card = state.cards[clampFocus(state.focusIndex, state.cards.length)];
  return card != null && card.unavailable !== true;
}

export function focusLiveCard(
  state: LiveCardsState,
  index: number,
): LiveCardsState {
  const focusIndex = clampFocus(index, state.cards.length);
  return focusIndex === state.focusIndex ? state : { ...state, focusIndex };
}

export function startNewThread(state: LiveCardsState): LiveCardsState {
  if (state.cards.length === 0 || state.focusIndex === NO_FOCUS) return state;
  return { cards: state.cards, focusIndex: NO_FOCUS };
}

export function expireRestoredCard(card: LiveCard): LiveCard {
  let next = card;
  if (card.status === 'needs-sign') {
    const again = [...card.thread]
      .reverse()
      .find((item) => item.role === 'user')?.text;
    next = {
      ...card,
      status: 'expired',
      swap: null,
      chips: again ? [again] : [],
      sellDoors: [],
      thread: [
        ...card.thread,
        {
          id: `${card.id}:expired:${card.thread.length}`,
          role: 'coach',
          text: copy.live.coachExpired,
        },
      ],
    };
  }
  if (next.vitals) {
    const { tradeLeadIn: _dropped, chart, ...vitals } = next.vitals;
    next = {
      ...next,
      vitals: {
        ...vitals,
        price: null,
        market: null,
        holders: null,
        chart: {
          kind: chart.kind,
          mint: chart.mint,
          timeframe: chart.timeframe,
          source: chart.source,
        },
      },
    };
  }
  return next;
}

/**
 * Merge the threads read back from the phone under the ones already in memory.
 *
 * - Saved threads go first (they are older) and pass through
 *   `expireRestoredCard`.
 * - An id already in memory wins: a card that landed while storage was being
 *   read is the live one.
 * - With nothing in memory this is a cold start, so nothing is focused: Home
 *   opens empty and the tab bar shows, exactly as after *New thread*. With a
 *   thread on screen, the focus stays on that same thread.
 */
export function restoreLiveCards(
  state: LiveCardsState,
  restored: readonly LiveCard[],
): LiveCardsState {
  const live = new Set(state.cards.map((card) => card.id));
  const kept = restored
    .filter((card) => !live.has(card.id))
    .map(expireRestoredCard);
  if (kept.length === 0) return state;
  const focusIndex =
    state.cards.length === 0 || state.focusIndex === NO_FOCUS
      ? NO_FOCUS
      : clampFocus(state.focusIndex, state.cards.length) + kept.length;
  return { cards: [...kept, ...state.cards], focusIndex };
}

/* ─── Store: survives the Swap route replacing Home ─────────────────────────── */

type Listener = () => void;

let liveCardsState: LiveCardsState = EMPTY_LIVE_CARDS;
let seedCounter = 0;
function launchMark(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
let seedLaunch = launchMark();
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function readLiveCards(): LiveCardsState {
  return liveCardsState;
}

export function subscribeLiveCards(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function nextLiveCardSeed(): string {
  seedCounter += 1;
  return `${seedLaunch}.${seedCounter}`;
}

export function writeLiveCards(next: LiveCardsState): void {
  if (next === liveCardsState) return;
  liveCardsState = next;
  emit();
}

export function markLiveCardSignedInStore(
  cardId: string,
  done: LiveCardDone | null = null,
): void {
  writeLiveCards(markLiveCardSigned(liveCardsState, cardId, done));
}

export function __resetLiveCardsForTests(): void {
  liveCardsState = EMPTY_LIVE_CARDS;
  seedCounter = 0;
  seedLaunch = launchMark();
  listeners.clear();
}

/** A take belongs to one completed turn and never to a money/sign surface. */
export function canAttachConnectedTake(card: LiveCard): boolean {
  return (
    card.connectedTakeAllowed === true &&
    !card.unavailable &&
    card.kind !== 'swap' &&
    card.status === null &&
    !card.swap &&
    !card.addMoney &&
    card.sellDoors.length === 0 &&
    !card.vitalsChoices &&
    !card.vitals?.tradeLeadIn
  );
}

export function attachConnectedTake(
  state: LiveCardsState,
  coachId: string,
  take: ConnectedTake,
): LiveCardsState {
  const index = state.cards.findIndex(
    (card) => card.thread.at(-1)?.id === coachId,
  );
  const card = state.cards[index];
  if (!card || !canAttachConnectedTake(card)) return state;
  const cards = state.cards.slice();
  cards[index] = {
    ...card,
    connectedTake: { label: take.label, text: take.text },
  };
  return { ...state, cards };
}
