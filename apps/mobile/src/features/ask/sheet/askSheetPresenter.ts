import { copy } from '@/constants/copy';
import {
  trustedCopy,
  isTrustedCopy,
  type AskText,
  type ModelText,
} from '../askText';
import { readModelText, readAnswerText } from '../askAnswerBoundary';
import type {
  AskAnswer,
  AskAnswerShape,
  AskConfluenceAnswer,
  AskSwapChoice,
  AskSwapHandoff,
} from '@/src/features/ask/askClient';
import type {
  FiatLineResult,
  HoldingLine,
  HoldingsSnapshot,
  PriceQuoteMap,
} from '@/src/features/balances/computeFiatTotal';
import {
  formatClosedBarStamp,
  formatObservationClock,
} from '@/src/features/home/asOfPresentation';
import { CHART_COVERAGE_THIN_BARS } from '@/src/features/signals/chartCoverage';
import {
  formatCents,
  presentHomeBook,
  type HomeBookRead,
} from '@/src/features/home/book/homeBookPresenter';
import type { SuggestedAsk } from '@/src/features/home/suggestedAsks';
import { formatAtomicAmount, tokenForSymbol } from '@/src/features/swap/tokens';
import {
  formatSwapFeeDisplayValue,
  resolveSwapFeeDisplay,
} from '@/src/features/swap/swapFeeDisplay';
import type { FeeBpsStatus } from '@/src/lib/apiConfig';
import {
  formatAge,
  formatCompactUsd,
  formatCount,
} from '@/src/features/tokenVitals/tokenVitalsPresentation';
import type { SafetyVerdictLevel } from '@/src/features/tokenVitals/types';
import { resolveVerdictWord } from '@/src/features/tokenVitals/verdictSurface';
import { formatCompactTokenAmount } from '@/src/ui/format/numberCraft';
import type {
  AskCardRow,
  AskChip,
  AskSheetCard,
  AskSheetState,
  AskSheetView,
} from '@/src/ui/ethena/askSheetModel';
import {
  classifyProseShape,
  foldQuestion,
  readFoldedQuestion,
} from './askProseAllowlist';

const t = copy.askSheet;

/* ─── Sources → the Looked at line ────────────────────────────────────────── */

/**
 * What an answer read. Each kind names a real input to the card; the line is
 * these, in order, and nothing else.
 */
export type AskSource =
  /** The holdings read, at the time it was observed. */
  | { readonly kind: 'book'; readonly asOfMs: number }
  /** A price quote's own clock. The vendor name is not drawn. */
  | { readonly kind: 'prices'; readonly asOfMs: number }
  /** What a confluence number rests on, or why it is Unknown. */
  | { readonly kind: 'confluence'; readonly label: string };

/**
 * A price source that names a feed. `usdc_peg` is not one: USDC is valued at
 * its peg (`computeFiatTotal`), which read no price from anybody.
 */
function isPriceFeed(source: string): boolean {
  return source.trim() !== '' && source !== 'usdc_peg';
}

export function lookedAtLine(sources: readonly AskSource[]): string | null {
  const parts: string[] = [];
  const seenPriceClocks = new Set<string>();
  for (const source of sources) {
    if (source.kind === 'book') {
      const clock = formatObservationClock(source.asOfMs);
      if (clock) parts.push(t.lookedAtBook(clock));
    } else if (source.kind === 'prices') {
      const clock = formatObservationClock(source.asOfMs);
      if (!clock || seenPriceClocks.has(clock)) continue;
      seenPriceClocks.add(clock);
      parts.push(t.lookedAtPrices(clock));
    } else if (source.label.trim() !== '') {
      parts.push(source.label.trim());
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

const MONEY_STEMS: readonly string[] = [
  'charg',
  'pay',
  'paid',
  'fee',
  'cost',
  'pric',
  'commission',
  'spread',
  'slippag',
  'rebate',
  'refund',
  'tip',
  'bill',
  'spen',
  'debit',
  'deduct',
  'withh',
  'markup',
  'gas',
  'expens',
  'toll',
  'rake',
  'overhead',
  'free',
  'cheap',
  'bps',
];

/** Phrases that name money going out and contain none of the stems. */
const MONEY_IDIOMS =
  /\bset\s+(?:\S+\s+){0,2}?back\b|\b(?:take|takes|took|taken|taking)\s+(?:\S+\s+){0,3}?(?:from|off|out\s+of|in\s+fees|as\s+a\s+cut)\b|\bhow\s+much\s+(?:\S+\s+){0,3}?(?:take|takes|took|taken|taking|lose|lost|losing)\b|\b(?:a|the|its|their|your|what|corso['’]s)\s+cut\b|\bcut\s+(?:of|from|on)\b|\bbasis\s+points?\b|\b(?:take|keeps?|earns?|rent|damage)\b|\brun\s+me\b/i;

/** The one normal form both checks read: NFKD, ignorables gone, marks gone. */
function normalized(text: string): string {
  return foldQuestion(text);
}

/**
 * Word tokens. A hyphen joins a compound (`mark-up`, `re-paid`) so the stem
 * sees one token; an apostrophe or other mark does not (`fees'` → `fees`).
 */
function moneyTokens(text: string): readonly string[] {
  return (
    text
      .toLowerCase()
      .replace(/[-‐‑‒–—]/g, '')
      .match(/[a-z0-9]+/g) ?? []
  );
}

/** The stem limb: true when `token` contains any `MONEY_STEMS` entry. */
function tokenContainsMoneyStem(token: string): boolean {
  return MONEY_STEMS.some((stem) => token.includes(stem));
}

/**
 * Stem and idiom veto. True when the folded question names money going out.
 * This is the second gate, inside an allowed shape. A question this misses
 * still gets no prose unless `classifyProseShape` accepts it and the shape
 * names no token. A token subject is not prose.
 */
export function asksAboutMoney(question: string): boolean {
  const text = foldQuestion(question);
  if (MONEY_IDIOMS.test(text)) return true;
  return moneyTokens(text).some(tokenContainsMoneyStem);
}

const STANDING_POLICY_SHAPES: readonly RegExp[] = [
  // what fees do I pay (on Corso) · could you tell me what fees I pay on Corso
  /^(?:(?:could|can|would)\s+you\s+tell\s+me\s+)?what\s+fees\s+(?:(?:do|will|would)\s+)?(?:i|we)\s+(?:pay|be\s+paying)(?:\s+on\s+corso)?$/,
  // what fees am I paying (on Corso)
  /^what\s+fees\s+(?:am\s+i|are\s+we)\s+paying(?:\s+on\s+corso)?$/,
  // what does Corso charge · how much does Corso charge
  /^(?:what|how\s+much)\s+(?:does|will)\s+corso\s+charge(?:\s+(?:me|us))?$/,
  // what fees does Corso charge
  /^what\s+fees\s+does\s+corso\s+charge(?:\s+(?:me|us))?$/,
  // what is the Corso fee · what's Corso's fee · what are Corso's fees
  /^what(?:['’]?s|\s+is|\s+are)\s+(?:the\s+)?corso(?:['’]s)?\s+fees?$/,
  // what are the fees on Corso
  /^what\s+are\s+the\s+fees\s+on\s+corso$/,
  // what will I be charged (on Corso) (next time)
  /^what\s+will\s+(?:i|we)\s+be\s+charged(?:\s+on\s+corso)?(?:\s+next\s+time)?$/,
];

/** The question, trimmed of surrounding space and end punctuation. */
const QUESTION_BODY = /^\s*([\s\S]*?)[\s?.!]*$/;

/** A token a person would not type as an English word: a ticker, a figure. */
function tickerLikeToken(question: string): boolean {
  const words = foldQuestion(question).match(/\S+/g) ?? [];
  return words.some((raw, at) => {
    // a figure, a currency sign, or a mark inside a word ($SOL, 2, USDC-USDT)
    if (/[\p{N}$€£¥]|\p{L}[^\p{L}'’\s]+\p{L}/u.test(raw)) return true;
    // a capital after the first letter (PAY, TIME, BoNk)
    if (/\p{L}\p{L}*?\p{Lu}/u.test(raw)) return true;
    // a capital inside the sentence is a name; only I and Corso are admitted
    return (
      at > 0 &&
      /^[^\p{L}]*\p{Lu}/u.test(raw) &&
      !/^[^\p{L}]*(?:I|Corso(?:['’]s)?)[^\p{L}]*$/u.test(raw)
    );
  });
}

/**
 * A standing fee-policy question: no ticker-like token, and the lowercased
 * question body is one of `STANDING_POLICY_SHAPES`. Anything else fails
 * toward Can't answer yet: a sum of past costs, a quote for one order, a
 * pair or an exemption.
 */
export function isFeePolicyQuestion(question: string): boolean {
  if (tickerLikeToken(question)) return false;
  const body = QUESTION_BODY.exec(foldQuestion(question).toLowerCase())?.[1];
  if (body == null) return false;
  return STANDING_POLICY_SHAPES.some((shape) => shape.test(body));
}

/**
 * The percent Review shows for a committed `corsoFeeBps`.
 *
 * A known status is passed as the number arm of `resolveSwapFeeDisplay`,
 * the same arm Review uses for `frozenIntent.corsoFeeBps`: the config is
 * not consulted, and a non-integer fails closed. Null (still loading) is
 * resolving. Unknown config is unavailable. No literal rate lives here.
 */
function reviewCommittedFeeDisplay(feeStatus: FeeBpsStatus | null) {
  if (feeStatus == null) return resolveSwapFeeDisplay(null, null);
  switch (feeStatus.state) {
    case 'known':
      return resolveSwapFeeDisplay(feeStatus.bps, null);
    case 'unknown':
      return resolveSwapFeeDisplay(null, feeStatus);
    default: {
      const neverStatus: never = feeStatus;
      return neverStatus;
    }
  }
}

/** Standing fee policy. No model text. No open target. */
function presentFeePolicy(feeStatus: FeeBpsStatus | null): CandidateOutcome {
  return {
    state: 'fact',
    card: {
      kind: 'fact',
      title: t.feePolicyTitle,
      rows: [
        {
          key: 'corsoFee',
          label: copy.swap.corsoFee,
          value: formatSwapFeeDisplayValue(reviewCommittedFeeDisplay(feeStatus)),
        },
        {
          key: 'network',
          label: copy.swap.networkFee,
          value: t.networkFeeInSol,
        },
      ],
      openLabel: null,
    },
    sources: [],
    actions: NO_ACTIONS,
  };
}

/**
 * Symbols this device holds, plus SOL / USDC on the book's cluster, each
 * mapped to a mint. This names a holding. It does not admit model prose.
 * A server `token_vitals` mint is not an entry: the model chooses that
 * query, so the mint is not proof the question was about that token.
 */
export type TokenSubjectProof = {
  readonly heldOrKnown: ReadonlyMap<string, string>;
};

const EMPTY_PROOF: TokenSubjectProof = {
  heldOrKnown: new Map(),
};

/**
 * The symbol is on this device's book (or is SOL / USDC on its cluster).
 * A letters pattern is not this, and neither is a vitals mint the model
 * named for a different word.
 */
export function subjectResolves(
  symbol: string,
  proof: TokenSubjectProof,
): boolean {
  return proof.heldOrKnown.has(symbol.trim().toUpperCase());
}

/** Mints this device can name from its own book. */
export function proofForAsk(book: AskSheetBook): TokenSubjectProof {
  const heldOrKnown = new Map<string, string>();
  rememberKnownSymbols(book, heldOrKnown);
  for (const line of book.holdings?.lines ?? []) {
    const symbol = line.symbol.trim();
    const mint = line.mint.trim();
    if (symbol.length > 0 && mint.length > 0)
      heldOrKnown.set(symbol.toUpperCase(), mint);
  }
  return { heldOrKnown };
}

/**
 * The question's token subject, when it has one. Null for a subject-free
 * shape and for a question that is not a shape. Money stems do not clear
 * this: "is PAY safe?" still names PAY.
 */
function tokenSubject(question: string): string | null {
  const folded = readFoldedQuestion(question);
  if (folded === null) return null;
  return classifyProseShape(folded)?.symbol ?? null;
}

export function mayRenderModelProse(
  question: string,
  proof: TokenSubjectProof = EMPTY_PROOF,
): boolean {
  const folded = readFoldedQuestion(question);
  if (folded === null) return false;
  const hit = classifyProseShape(folded);
  if (hit === null) return false;
  if (hit.symbol !== null) return false;
  if (asksAboutMoney(question)) return false;
  return true;
}

const KNOWN_SYMBOLS = ['SOL', 'USDC'] as const;

function rememberKnownSymbols(
  book: AskSheetBook,
  into: Map<string, string>,
): void {
  const cluster = book.holdings?.cluster;
  if (cluster !== 'mainnet-beta' && cluster !== 'devnet') return;
  for (const known of KNOWN_SYMBOLS) {
    const token = tokenForSymbol(known, cluster);
    into.set(token.symbol.toUpperCase(), token.mint);
  }
}

/**
 * A name for a mint that this device holds, from its own book, or one of the
 * two tokens Corso itself names (SOL, and USDC on the book's cluster). Never
 * the answer's symbol: that is text the model extracted from the question.
 */
function deviceSymbol(book: AskSheetBook, mint: string | null): string | null {
  const holdings = book.holdings;
  if (!mint || !holdings) return null;
  const held = holdings.lines.find((line) => line.mint === mint);
  if (held && held.symbol.trim() !== '') return held.symbol;
  // Corso's own names are per cluster; an unknown cluster names nothing.
  const cluster = holdings.cluster;
  if (!cluster) return null;
  for (const known of KNOWN_SYMBOLS) {
    const token = tokenForSymbol(known, cluster);
    if (token.mint === mint) return token.symbol;
  }
  return null;
}

/**
 * A fee question's card. It is handed no answer: only the resolver's
 * structured trade (the destination mint and the base-unit amount), the
 * shape read from the holdings this device sent, the device's book, and the
 * handoff Review opens with (an action, never drawn). A trade whose two
 * symbols the device cannot name has no model-free form: Can't answer yet.
 */
function presentFeeQuestion(input: {
  trade: { readonly toMint: string; readonly inAmountAtomic: string } | null;
  review: AskSwapHandoff | null;
  shape: AskAnswerShape | null;
  book: AskSheetBook;
  swapsEnabled: boolean;
}): CandidateOutcome {
  const { trade, review, shape, book } = input;
  if (!trade || !review) return presentCantAnswer();
  const fromSymbol = deviceSymbol(book, shape?.fromMint ?? null);
  const toSymbol = deviceSymbol(book, trade.toMint);
  if (!fromSymbol || !toSymbol) return presentCantAnswer();
  return presentTrade(
    { fromSymbol, toSymbol, inAmountAtomic: trade.inAmountAtomic },
    review,
    shape,
    book,
    input.swapsEnabled,
  );
}

/* ─── The answer side: what the card would show ───────────────────────────── */

/**
 * A second-person (or "your") assertion that money already went out. Present
 * and forward statements land: "you pay 0.85%", "it will cost you", "you'd
 * pay", "your fee will be". In each pattern a word between the subject and
 * the verb may not be a modal ("you would have paid" is not an assertion),
 * and a sentence runs to its end, where a decimal point ("$0.42") is not one.
 */
const PAST_COST_ASSERTIONS: readonly RegExp[] = [
  // you paid · you've paid · you have already paid · you just spent
  /\byou(?:['’]ve|\s+have|\s+had)?\s+(?:(?!(?:will|would|could|might|may|should|can|shall|to)\b)[\w'’]+\s+){0,2}?(?:paid|spent|incurred)\b/i,
  // you were charged · you got billed · you've been charged
  /\byou(?:['’]ve)?\s+(?:(?!(?:will|would|could|might|may|should|can|shall|to)\b)[\w'’]+\s+){0,2}?(?:were|was|got|been)\s+(?:(?!(?:will|would|could|might|may|should|can|shall|to)\b)[\w'’]+\s+)?(?:charged|billed)\b/i,
  // Corso charged you · billed you
  /\b(?:charged|billed)\s+you\b/i,
  // that swap cost you · your last trade set you back · it cost you
  /\b(?:it|that|this|your|the|last|previous|recent)\s+(?:(?!(?:will|would|could|might|may|should|can|shall|to)\b)[\w'’]+\s+){0,2}?(?:cost|set)\s+you\b/i,
  // your fee was · fees came to · the fee on your last swap was
  /\b(?:fees?|costs?|charges?|commissions?|spreads?)\b(?:[^.!?]|\.(?=\d)){0,40}?\b(?:was|were|came\s+to|totall?ed|amounted\s+to|added\s+up\s+to)\b/i,
  // took $0.42 from you · deducted 0.85% in fees
  /\b(?:took|deducted|withheld)\s+(?:\S+\s+){0,3}?(?:from\s+(?:you|your)|in\s+fees)\b/i,
  // the 2 SOL swap cost $0.42 · your last trade had a fee (singular: "swaps
  // cost 0.85%" is the present)
  /\b(?:your|that|the|this|last|previous)\s+(?:\S+\s+){0,3}?(?:swap|trade|order)\s+(?:cost\b(?!\s+(?:is|will|would|could|should|might|may|of|to)\b)|had\b|carried\b|came\s+with\b|incurred\b)/i,
  // a figure or a fee beside "your last swap", either order
  /(?:\b(?:fees?|costs?|charges?|commissions?|spreads?|paid|spent)\b|\$\d)(?:[^.!?]|\.(?=\d)){0,60}?\byour\s+(?:most\s+recent|last|previous|recent|latest|earlier)\s+(?:swaps?|trades?|orders?)\b/i,
  /\byour\s+(?:most\s+recent|last|previous|recent|latest|earlier)\s+(?:swaps?|trades?|orders?)\b(?:[^.!?]|\.(?=\d)){0,60}?(?:\b(?:fees?|costs?|charges?|commissions?|spreads?)\b|\$\d)/i,
];

/** Structural fields: not words anyone reads. */
const NOT_SHOWN = /^(?:key|kind|tone)$/;

function shownStrings(value: unknown, into: string[]): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value))
    for (const item of value) shownStrings(item, into);
  else if (value && typeof value === 'object')
    for (const [field, inner] of Object.entries(value))
      if (!NOT_SHOWN.test(field)) shownStrings(inner, into);
  return into;
}

/**
 * The answer side: would this outcome SHOW an assertion about the asker's own
 * past costs? Every string on the card is read — whatever field carries it,
 * so a new card field is covered without a list to extend — and the Looked
 * at line the sheet draws beside it.
 */
export function showsOwnPastCost(
  outcome: AskSheetOutcome | CandidateOutcome,
): boolean {
  const shown = shownStrings(outcome.card, []);
  const lookedAt = lookedAtLine(outcome.sources);
  if (lookedAt) shown.push(lookedAt);
  return shown.some((text) => {
    const said = normalized(text);
    return PAST_COST_ASSERTIONS.some((assertion) => assertion.test(said));
  });
}

/** A figure or a word a fee rate is stated in. */
const RATE_WORDING =
  /\d|%|\b(?:percent|per\s*cent|bps|basis\s+points?|free|zero|nothing)\b/i;

/** A percent or basis-point figure. */
const PERCENT_FIGURE =
  /\d[\d.,]*\s*(?:%|percent\b|per\s*cent\b|bps\b|basis\s+points?\b)/i;

/** The product or an order: what a bare percent is a rate of. */
const RATE_BASE =
  /\b(?:corso|swaps?|swapping|trades?|orders?|transactions?)\b/i;

/**
 * The fee topic: what a platform takes, in any unit. Whole words with their
 * inflections, a rate unit, or a percent sign. `take`/`keep`/`cut` are here
 * because "Corso takes one twentieth" states a rate with no fee noun.
 */
const FEE_TOPIC =
  /%|\b(?:fees?|charg\w*|costs?|costing|commissions?|spreads?|takes?|keeps?|kept|cut|pay\w*|paid|percent|per\s*cent|bps|bips?|basis)\b/i;
const CURRENCY = /[$€£¥]|\b(?:cents?|penn(?:y|ies)|dollars?|usd)\b/i;

export function modelTextTouchesFees(text: string): boolean {
  const said = normalized(text);
  if (FEE_TOPIC.test(said) || MONEY_IDIOMS.test(said)) return true;
  return /\bcorso/i.test(said) && CURRENCY.test(said);
}

const MODEL_OUTPUT_ALLOWSET: ReadonlySet<string> = new Set([
  'Tap a trade card to open Review.',
  'Review quotes this again before you sign.',
  'Open a token to see its facts.',
  'Pick one.',
  'Which one?',
  'Open Review',
  'Add cash to continue.',
]);

function allowsModelOutput(text: ModelText): boolean {
  return MODEL_OUTPUT_ALLOWSET.has(text.text);
}

function allowsText(text: AskText): boolean {
  return text.kind === 'trusted'
    ? isTrustedCopy(text)
    : allowsModelOutput(text);
}

/**
 * The two answer-drawn text channels the sheet renders: the card line
 * (`AskSheet` `card.line`) and every chip or door label (`chip.label`),
 * read off the card itself so a server-named pick is covered as well as
 * the model's own chips. Device cards (fact, facts, table, trade) carry
 * neither channel.
 */
function answerChannels(card: CandidateCard): readonly AskText[] {
  switch (card.kind) {
    case 'line':
      return [card.line, ...card.doors.map((door) => door.label)];
    case 'clarify':
      return [card.line, ...card.chips.map((chip) => chip.label)];
    default:
      return [];
  }
}

/**
 * The answer side: would this outcome SHOW a claim about what Corso charges?
 * A shown string that names money going out (`asksAboutMoney`, the same stem
 * and idiom property the question side reads) beside a figure or a rate word,
 * or a percent figure beside the product or an order ("About 0.85% of the
 * trade"). Every shown string is read, like `showsOwnPastCost`. Corso's
 * device-built rows keep label and figure in separate strings, so the fee
 * card and a trade card are not claims; a model sentence is one string.
 */
export function showsFeeRateClaim(
  outcome: AskSheetOutcome | CandidateOutcome,
): boolean {
  const shown = shownStrings(outcome.card, []);
  const lookedAt = lookedAtLine(outcome.sources);
  if (lookedAt) shown.push(lookedAt);
  return shown.some((text) => {
    const said = normalized(text);
    if (asksAboutMoney(said) && RATE_WORDING.test(said)) return true;
    return PERCENT_FIGURE.test(said) && RATE_BASE.test(said);
  });
}

/* ─── The book, as the sheet reads it ─────────────────────────────────────── */

/** The slice of `useFiatTotal()` the sheet reads — the Book's own read. */
export type AskSheetBook = HomeBookRead & {
  quotes: PriceQuoteMap;
  result: HomeBookRead['result'] & { sources?: readonly string[] };
};

function lineOf(
  book: AskSheetBook,
  mint: string,
): { holding: HoldingLine; fiat: FiatLineResult | undefined } | null {
  const holding = book.holdings?.lines.find((line) => line.mint === mint);
  if (!holding) return null;
  return {
    holding,
    fiat: book.result.lines.find((line) => line.mint === mint),
  };
}

function cents(fiat: FiatLineResult | undefined): bigint | null {
  if (!fiat?.priced || fiat.fiatAmount == null) return null;
  const match = /^(\d+)\.(\d{2})$/.exec(fiat.fiatAmount);
  return match ? BigInt(match[1]) * 100n + BigInt(match[2]) : null;
}

function quantity(line: HoldingLine): string | null {
  if (!/^\d+$/.test(line.atomic)) return null;
  const decimal = formatAtomicAmount(line.atomic, line.decimals);
  return decimal
    ? (formatCompactTokenAmount(decimal)?.compact ?? decimal)
    : null;
}

function bookSources(
  book: AskSheetBook,
  priceReads: readonly { source: string; asOfMs: number }[],
): AskSource[] {
  const sources: AskSource[] = [];
  if (book.holdings)
    sources.push({ kind: 'book', asOfMs: book.holdings.asOfMs });
  const seen = new Set<number>();
  for (const read of priceReads) {
    if (!isPriceFeed(read.source) || seen.has(read.asOfMs)) continue;
    seen.add(read.asOfMs);
    sources.push({ kind: 'prices', asOfMs: read.asOfMs });
  }
  return sources;
}

/** Clocks of the quotes that priced this table, in line order. */
function tablePriceReads(
  book: AskSheetBook,
): { source: string; asOfMs: number }[] {
  const names = new Set((book.result.sources ?? []).filter(isPriceFeed));
  const reads: { source: string; asOfMs: number }[] = [];
  for (const line of book.result.lines) {
    if (line.priced !== true) continue;
    const quote = book.quotes[line.mint];
    if (!quote || !names.has(quote.source)) continue;
    reads.push({ source: quote.source, asOfMs: quote.asOfMs });
  }
  return reads;
}

/* ─── Answers → cards ─────────────────────────────────────────────────────── */

/** What a tap on a card does. Held beside the card, never drawn. */
export type AskCardActions = {
  /** Fact / Facts: the subject's screen. */
  readonly openMint: string | null;
  /** Trade: the exact server handoff, passed to Review unchanged. */
  readonly review: AskSwapHandoff | null;
  readonly chips: Readonly<
    Record<
      string,
      | { readonly kind: 'ask'; readonly text: string }
      | { readonly kind: 'pair'; readonly choice: AskSwapChoice }
      | { readonly kind: 'asset'; readonly mint: string }
    >
  >;
  readonly doors: Readonly<
    Record<
      string,
      | {
          readonly kind: 'href';
          readonly door: NonNullable<AskAnswer['sellDoors']>[number];
        }
      | { readonly kind: 'addCash' }
    >
  >;
};

export type AskSheetOutcome = {
  readonly state: Exclude<AskSheetState, 'empty' | 'thinking'>;
  readonly card: AskSheetCard;
  readonly sources: readonly AskSource[];
  readonly actions: AskCardActions;
};

type CandidateChip = Omit<AskChip, 'label'> & { readonly label: AskText };
type CandidateCard =
  | Exclude<AskSheetCard, { kind: 'line' | 'clarify' }>
  | {
      readonly kind: 'line';
      readonly tone: 'refused' | 'cantYet' | 'unavailable';
      readonly line: AskText;
      readonly doors: readonly CandidateChip[];
    }
  | {
      readonly kind: 'clarify';
      readonly line: AskText;
      readonly chips: readonly CandidateChip[];
    };
type CandidateOutcome = Omit<AskSheetOutcome, 'card'> & {
  readonly card: CandidateCard;
};

function rendered(outcome: CandidateOutcome): AskSheetOutcome {
  const card = outcome.card;
  if (card.kind === 'line')
    return {
      ...outcome,
      card: {
        ...card,
        line: card.line.text,
        doors: card.doors.map((door) => ({ ...door, label: door.label.text })),
      },
    };
  if (card.kind === 'clarify')
    return {
      ...outcome,
      card: {
        ...card,
        line: card.line.text,
        chips: card.chips.map((chip) => ({ ...chip, label: chip.label.text })),
      },
    };
  return { ...outcome, card };
}

const NO_ACTIONS: AskCardActions = {
  openMint: null,
  review: null,
  chips: {},
  doors: {},
};

function line(
  tone: 'refused' | 'cantYet' | 'unavailable',
  text: AskText,
  doors: CandidateChip[] = [],
  actions: AskCardActions = NO_ACTIONS,
): CandidateOutcome {
  return {
    state: tone,
    card: { kind: 'line', tone, line: text, doors },
    sources: [],
    actions,
  };
}

/** Neutral refusal. Not a claim about fees. */
function presentCantAnswer(): CandidateOutcome {
  return line('cantYet', trustedCopy('askSheet', 'cantAnswer'));
}

function candidateCantYet(): CandidateOutcome {
  return line(
    'cantYet',
    trustedCopy('askSheet', 'cantYet', trustedCopy('askSheet', 'cantYetFees')),
  );
}

/** The model string is on this card. A device card that contains it is not device-built. */
function modelTextInCard(
  card: AskSheetCard | CandidateCard,
  modelText: string,
): boolean {
  const needle = modelText.trim();
  if (needle === '') return false;
  return shownStrings(card, []).some((text) => text.includes(needle));
}

/**
 * A book table or a holding fact, drawn from this device, with the model
 * string absent. Fee questions do not reach this: the caller checks
 * `asksAboutMoney` first.
 */
function deviceBuiltCard(
  outcome: CandidateOutcome,
  modelText: string,
): boolean {
  const kind = outcome.card.kind;
  if (kind !== 'table' && kind !== 'fact') return false;
  return !modelTextInCard(outcome.card, modelText);
}

function candidateAskAnswer(input: {
  /** The question as asked — read for the prose gate, never shown from the answer. */
  question: string;
  answer: AskAnswer;
  /** What the server said the answer is, read beside the answer. */
  shape: AskAnswerShape | null;
  book: AskSheetBook;
  /** The stored book name — the table's total row label. */
  bookName: string;
  swapsEnabled: boolean;
  nowMs: number;
  /**
   * The same fee status Review loads with `resolveFeeBpsStatus`. Null while
   * that read has not settled. The model never supplies this number.
   */
  feeStatus?: FeeBpsStatus | null;
}): CandidateOutcome {
  const proof = proofForAsk(input.book);
  const subject = tokenSubject(input.question);
  // A question the stem catches stays on the fee card (device trade, or
  // Can't answer yet). PREPAID and "is PAY safe?" are tickers and money.
  // The token card is for a subject the stem does not catch.
  const outcome = mayRenderModelProse(input.question, proof)
    ? presentResolved(input)
    : subject !== null && !asksAboutMoney(input.question)
      ? presentTokenSubject(input, subject, proof)
      : presentNonToken(input);
  if (showsOwnPastCost(outcome)) return candidateCantYet();
  if (!answerChannels(outcome.card).every(allowsText))
    return isFeePolicyQuestion(input.question)
      ? presentFeePolicy(input.feeStatus ?? null)
      : presentCantAnswer();
  // Trusted copy, including percent controls, is not model vocabulary.
  // Keep the rate-claim backstop for structured cards outside prose channels.
  if (answerChannels(outcome.card).length === 0 && showsFeeRateClaim(outcome))
    return isFeePolicyQuestion(input.question)
      ? presentFeePolicy(input.feeStatus ?? null)
      : presentCantAnswer();
  return outcome;
}

/**
 * A token-subject question. The model's line, chips, and trade are not
 * inputs. Matching `token_vitals` wins when the server symbol is this
 * subject, because that card is the server's facts. Otherwise a held mint
 * is the device's holding fact. Anything else is Can't answer yet.
 */
function presentTokenSubject(
  input: {
    answer: AskAnswer;
    book: AskSheetBook;
    nowMs: number;
  },
  symbol: string,
  proof: TokenSubjectProof,
): CandidateOutcome {
  const vitals = input.answer.vitals;
  const subject = symbol.trim().toUpperCase();
  if (
    vitals?.render === 'token_vitals' &&
    vitals.token.mint.trim().length > 0 &&
    vitals.token.symbol.trim().toUpperCase() === subject
  ) {
    const facts = presentVitalsFacts(
      vitals,
      input.answer.confluence,
      input.nowMs,
    );
    if (!modelTextInCard(facts.card, input.answer.answer)) return facts;
  }
  if (subjectResolves(symbol, proof)) {
    const mint = proof.heldOrKnown.get(subject);
    if (mint) {
      const fact = presentFact(input.book, mint);
      if (fact && !modelTextInCard(fact.card, input.answer.answer)) return fact;
    }
  }
  return presentCantAnswer();
}

function presentNonToken(input: {
  question: string;
  answer: AskAnswer;
  shape: AskAnswerShape | null;
  book: AskSheetBook;
  bookName: string;
  swapsEnabled: boolean;
  nowMs: number;
  feeStatus?: FeeBpsStatus | null;
}): CandidateOutcome {
  const resolved = presentResolved(input);
  if (
    !asksAboutMoney(input.question) &&
    deviceBuiltCard(resolved, input.answer.answer)
  ) {
    return resolved;
  }
  const traded = presentFeeQuestion({
    // Only a trade the answer would have drawn, and only its structure.
    trade:
      resolved.card.kind === 'trade' && input.answer.swap
        ? {
            toMint: input.answer.swap.toMint,
            inAmountAtomic: input.answer.swap.inAmountAtomic,
          }
        : null,
    review: resolved.actions.review,
    shape: input.shape,
    book: input.book,
    swapsEnabled: input.swapsEnabled,
  });
  if (traded.state === 'trade') return traded;
  if (isFeePolicyQuestion(input.question))
    return presentFeePolicy(input.feeStatus ?? null);
  return traded;
}

const SAFETY_LEVELS = new Set<SafetyVerdictLevel>([
  'green',
  'amber',
  'red',
  'unknown',
]);

function safetyRow(
  vitals: Extract<NonNullable<AskAnswer['vitals']>, { render: 'token_vitals' }>,
): AskCardRow | null {
  const verdict = vitals.safety?.verdict;
  if (!SAFETY_LEVELS.has(verdict)) return null;
  return { key: 'safety', label: t.safety, value: resolveVerdictWord(verdict) };
}

/** Label the close. A bar end of hh:59:59.999 is the following minute. */
function closedBarStamp(asOf: string, nowMs: number): string | null {
  const ms = Date.parse(asOf);
  if (!Number.isFinite(ms)) return null;
  return formatClosedBarStamp(ms % 1000 === 999 ? ms + 1 : ms, nowMs);
}

function confluenceBasisLine(
  read: Extract<AskConfluenceAnswer, { status: 'read' }>,
  nowMs: number,
): string | null {
  const clock = closedBarStamp(read.asOf, nowMs);
  if (!clock) return null;
  const notes: string[] = [];
  if (read.bars < CHART_COVERAGE_THIN_BARS) {
    notes.push(copy.chartEdge.thin(read.bars));
  }
  if (read.degradedCount > 0) {
    notes.push(copy.fullChart.degraded(read.degradedCount));
  }
  return t.confluenceBasis(read.timeframe, clock, notes);
}

/**
 * The confluence read beside safety. A score is drawn only when the server
 * said it rests on closed bars and named at least one contributor. Unknown
 * is the word plus the reason, and it carries no digit.
 */
function confluenceRows(
  read: AskConfluenceAnswer | undefined,
  nowMs: number,
): {
  rows: AskCardRow[];
  source: AskSource | null;
} {
  if (!read) return { rows: [], source: null };
  if (read.status === 'unknown') {
    const reason = t.confluenceReason[read.reason];
    return {
      rows: [
        {
          key: 'confluence',
          label: copy.chartEdge.confluence,
          value: t.confluenceUnknown,
        },
        {
          key: 'confluence-reason',
          label: t.confluenceReasonLabel,
          value: reason,
        },
      ],
      source: {
        kind: 'confluence',
        label: `${t.confluenceUnknown}. ${reason}`,
      },
    };
  }
  if (read.restsOn !== 'closed_bars' || read.contributors.length === 0) {
    return { rows: [], source: null };
  }
  const names = read.contributors.map((row) => t.contributor[row.kind]);
  if (names.length === 0) return { rows: [], source: null };
  const basis = confluenceBasisLine(read, nowMs);
  if (!basis) return { rows: [], source: null };
  return {
    rows: [
      {
        key: 'confluence',
        label: copy.chartEdge.confluence,
        value: t.confluenceValue(copy.fullChart.band[read.band], read.score),
      },
      {
        key: 'confluence-from',
        label: t.confluenceFrom,
        value: names.join(', '),
      },
      {
        key: 'confluence-rests',
        label: t.confluenceRestsOn,
        value: basis,
      },
    ],
    source: {
      kind: 'confluence',
      label: `${basis} · ${copy.fullChart.informationNotAdvice}`,
    },
  };
}

/** Server vitals facts. The model's line is not read. */
function presentVitalsFacts(
  vitals: Extract<NonNullable<AskAnswer['vitals']>, { render: 'token_vitals' }>,
  confluence: AskConfluenceAnswer | undefined,
  nowMs: number,
): CandidateOutcome {
  const safety = safetyRow(vitals);
  const read = confluenceRows(confluence, nowMs);
  const rows: AskCardRow[] = [
    ...(safety ? [safety] : []),
    ...read.rows,
    {
      key: 'liquidity',
      label: t.liquidity,
      value: formatCompactUsd(vitals.market?.liquidityUsd) ?? t.notKnown,
    },
    {
      key: 'holders',
      label: t.holders,
      value: formatCount(vitals.holders?.count) ?? t.notKnown,
    },
    {
      key: 'verified',
      label: t.verified,
      value: vitals.token.isVerified ? t.yes : t.no,
    },
    {
      key: 'age',
      label: t.age,
      value:
        vitals.token.ageMinutes == null
          ? t.notKnown
          : formatAge(vitals.token.ageMinutes).replace(/^age /, ''),
    },
  ];
  return {
    state: 'facts',
    card: {
      kind: 'facts',
      title: vitals.token.symbol,
      rows,
      openLabel: t.open,
    },
    sources: read.source ? [read.source] : [],
    actions: { ...NO_ACTIONS, openMint: vitals.token.mint },
  };
}

function presentResolved(input: {
  answer: AskAnswer;
  shape: AskAnswerShape | null;
  book: AskSheetBook;
  bookName: string;
  swapsEnabled: boolean;
  nowMs: number;
}): CandidateOutcome {
  const { answer, shape, book } = input;
  const prose = readAnswerText(answer);

  if (answer.status === 'unavailable') return line('unavailable', prose.line);

  if (answer.sellDoors && answer.sellDoors.length > 0) {
    const doors: CandidateChip[] = [];
    const doorActions: Record<string, AskCardActions['doors'][string]> = {};
    for (const door of answer.sellDoors) {
      const key = `sell:${door.mint}`;
      doors.push({ key, label: readModelText(door.label), marker: null });
      doorActions[key] = { kind: 'href', door };
    }
    return line('refused', prose.line, doors, {
      ...NO_ACTIONS,
      doors: doorActions,
    });
  }

  if (answer.swap)
    return presentTrade(
      answer.swap,
      answer.swap,
      shape,
      book,
      input.swapsEnabled,
    );

  if (answer.swapChoices && answer.swapChoices.length > 0) {
    const chips: CandidateChip[] = [];
    const chipActions: Record<string, AskCardActions['chips'][string]> = {};
    for (const choice of answer.swapChoices) {
      const key = `pair:${choice.mint}`;
      chips.push({
        key,
        label: readModelText(
          choice.name ? `${choice.symbol} · ${choice.name}` : choice.symbol,
        ),
        marker: choice.isVerified === true ? null : t.unverified,
      });
      chipActions[key] = { kind: 'pair', choice };
    }
    return {
      state: 'clarify',
      card: { kind: 'clarify', line: prose.line, chips },
      sources: [],
      actions: { ...NO_ACTIONS, chips: chipActions },
    };
  }

  if (answer.vitals?.render === 'token_vitals') {
    return presentVitalsFacts(answer.vitals, answer.confluence, input.nowMs);
  }

  if (answer.vitals?.render === 'token_vitals_disambiguate') {
    const chips: CandidateChip[] = [];
    const chipActions: Record<string, AskCardActions['chips'][string]> = {};
    for (const choice of answer.vitals.choices) {
      const key = `asset:${choice.mint}`;
      chips.push({
        key,
        label: readModelText(
          choice.name ? `${choice.symbol} · ${choice.name}` : choice.symbol,
        ),
        marker: choice.isVerified === true ? null : t.unverified,
      });
      chipActions[key] = { kind: 'asset', mint: choice.mint };
    }
    return {
      state: 'clarify',
      card: { kind: 'clarify', line: prose.line, chips },
      sources: [],
      actions: { ...NO_ACTIONS, chips: chipActions },
    };
  }

  if (shape?.intent === 'PORTFOLIO') {
    const table = presentTable(book, input.bookName, input.nowMs);
    if (table) return table;
    return line('unavailable', trustedCopy('ask', 'moneyUnavailable'));
  }

  if (shape?.intent === 'HOLDING_FACT' && shape.subjectMint) {
    const fact = presentFact(book, shape.subjectMint);
    if (fact) return fact;
    return line('unavailable', trustedCopy('ask', 'moneyUnavailable'));
  }

  if (answer.addMoney) {
    return line(
      'refused',
      prose.line,
      [
        {
          key: 'addCash',
          label: trustedCopy('askSheet', 'addCash'),
          marker: null,
        },
      ],
      { ...NO_ACTIONS, doors: { addCash: { kind: 'addCash' } } },
    );
  }

  if (answer.chips.length > 0) {
    const chips: CandidateChip[] = [];
    const chipActions: Record<string, AskCardActions['chips'][string]> = {};
    answer.chips.forEach((chip, at) => {
      const key = `ask:${at}`;
      chips.push({ key, label: prose.chips[at], marker: null });
      chipActions[key] = { kind: 'ask', text: chip };
    });
    return {
      state: 'clarify',
      card: { kind: 'clarify', line: prose.line, chips },
      sources: [],
      actions: { ...NO_ACTIONS, chips: chipActions },
    };
  }
  return line('refused', prose.line);
}

/** PORTFOLIO — the Book's own sections, subtotals and total. */
function presentTable(
  book: AskSheetBook,
  bookName: string,
  nowMs: number,
): CandidateOutcome | null {
  const model = presentHomeBook(book, nowMs);
  if (!model.sections || model.hero.kind !== 'value') return null;
  const rows: AskCardRow[] = model.sections.map((section) => ({
    key: section.key,
    label: section.label,
    value: section.subtotal,
  }));
  const adds = model.state === 'book' || model.state === 'cashOnly';
  const total: AskCardRow | null = adds
    ? {
        key: 'total',
        label: bookName,
        value: `${model.hero.amount}${model.hero.cents ?? ''}`,
      }
    : null;
  return {
    state: 'table',
    card: { kind: 'table', rows, total },
    sources: bookSources(book, tablePriceReads(book)),
    actions: NO_ACTIONS,
  };
}

/** HOLDING_FACT — one line of the book: quantity, value, share of book. */
function presentFact(
  book: AskSheetBook,
  mint: string,
): CandidateOutcome | null {
  const found = lineOf(book, mint);
  if (!found || book.holdings?.quantityStatus !== 'ready') return null;
  const amount = quantity(found.holding);
  if (!amount) return null;
  const value = cents(found.fiat);
  const model = presentHomeBook(book, 0);
  // A share needs a whole book as its denominator (the Book's own rule).
  const whole =
    (model.state === 'book' || model.state === 'cashOnly') &&
    model.hero.kind === 'value' &&
    model.hero.cents !== null;
  const total = whole ? sumPriced(book) : null;
  const rows: AskCardRow[] = [
    {
      key: 'holding',
      label: t.holding,
      value: `${amount} ${found.holding.symbol}`,
    },
    {
      key: 'value',
      label: t.value,
      value: value === null ? copy.homeBook.notPriced : formatCents(value),
    },
  ];
  if (value !== null && total !== null && total > 0n) {
    rows.push({
      key: 'share',
      label: t.shareOfBook,
      value: `${(value * 100n) / total}%`,
    });
  }
  const quote = book.quotes[mint];
  return {
    state: 'fact',
    card: {
      kind: 'fact',
      title: found.holding.symbol,
      rows,
      openLabel: t.open,
    },
    sources: bookSources(
      book,
      value !== null && quote
        ? [{ source: quote.source, asOfMs: quote.asOfMs }]
        : [],
    ),
    actions: { ...NO_ACTIONS, openMint: mint },
  };
}

function sumPriced(book: AskSheetBook): bigint {
  let total = 0n;
  const held = new Set(
    (book.holdings?.lines ?? [])
      .filter(
        (line) =>
          line.includeInHomeTotal &&
          /^\d+$/.test(line.atomic) &&
          BigInt(line.atomic) > 0n,
      )
      .map((line) => line.mint),
  );
  for (const fiat of book.result.lines) {
    if (!held.has(fiat.mint)) continue;
    total += cents(fiat) ?? 0n;
  }
  return total;
}

function presentTrade(
  shown: {
    readonly fromSymbol: string;
    readonly toSymbol: string;
    readonly inAmountAtomic: string;
  },
  review: AskSwapHandoff,
  shape: AskAnswerShape | null,
  book: AskSheetBook,
  swapsEnabled: boolean,
): CandidateOutcome {
  const fromDecimals = shape?.fromDecimals ?? null;
  const spend =
    fromDecimals === null
      ? null
      : formatAtomicAmount(shown.inAmountAtomic, fromDecimals);
  const rows: AskCardRow[] = [
    {
      key: 'sell',
      label: t.sell,
      value: spend ? `${spend} ${shown.fromSymbol}` : shown.fromSymbol,
    },
    { key: 'for', label: t.for, value: shown.toSymbol },
  ];
  const fromMint = shape?.fromMint ?? null;
  const quote = fromMint ? book.quotes[fromMint] : null;
  return {
    state: 'trade',
    card: {
      kind: 'trade',
      title: t.trade(shown.fromSymbol, shown.toSymbol),
      rows,
      note: t.requote,
      openReviewLabel: t.openReview,
      openReviewEnabled: swapsEnabled,
      disabledLine: swapsEnabled ? null : t.swapsOff,
      waitLabel: t.wait,
    },
    sources: bookSources(
      book,
      quote ? [{ source: quote.source, asOfMs: quote.asOfMs }] : [],
    ),
    actions: { ...NO_ACTIONS, review },
  };
}

export function presentSuggestions(
  holdings: HoldingsSnapshot | null,
  built: readonly SuggestedAsk[],
): { chips: AskChip[]; actions: Record<string, SuggestedAsk> } {
  const kept = built.filter((chip) => chip.id !== 'moving');
  const held =
    holdings?.quantityStatus === 'ready' &&
    holdings.lines.some(
      (line) =>
        line.includeInHomeTotal &&
        /^\d+$/.test(line.atomic) &&
        BigInt(line.atomic) > 0n,
    );
  const all: SuggestedAsk[] = held
    ? [{ id: 'split', label: t.bookSplit, action: 'ask' }, ...kept]
    : kept;
  const chips = all.slice(0, 3).map((chip) => ({
    key: chip.id,
    label: chip.id === 'fund' ? t.addCash : chip.label,
    marker: null,
  }));
  const actions: Record<string, SuggestedAsk> = {};
  for (const chip of all.slice(0, 3)) actions[chip.id] = chip;
  return { chips, actions };
}

/* ─── The whole view ──────────────────────────────────────────────────────── */

export type AskSheetPhase =
  | { readonly kind: 'empty' }
  | { readonly kind: 'thinking'; readonly question: string }
  | {
      readonly kind: 'answered';
      readonly question: string;
      readonly outcome: AskSheetOutcome;
    };

export function presentAskSheet(input: {
  phase: AskSheetPhase;
  askEnabled: boolean;
  suggestions: readonly AskChip[];
}): AskSheetView {
  const { phase } = input;
  const closeLabel = t.close;
  const composer = {
    placeholder: input.askEnabled
      ? t.placeholder
      : copy.ask.disabledPlaceholder,
    sendLabel: t.send,
    enabled: input.askEnabled && phase.kind !== 'thinking',
  };
  if (phase.kind === 'empty') {
    return {
      state: input.askEnabled ? 'empty' : 'unavailable',
      title: t.placeholder,
      card: input.askEnabled
        ? null
        : {
            kind: 'line',
            tone: 'unavailable',
            line: copy.ask.disabledNotice,
            doors: [],
          },
      lookedAt: null,
      closeLabel,
      suggestions: input.askEnabled ? input.suggestions : [],
      composer,
    };
  }
  if (phase.kind === 'thinking') {
    return {
      state: 'thinking',
      title: phase.question,
      card: null,
      lookedAt: null,
      closeLabel,
      suggestions: [],
      composer,
    };
  }
  return {
    state: phase.outcome.state,
    title: phase.question,
    card: phase.outcome.card,
    lookedAt: lookedAtLine(phase.outcome.sources),
    closeLabel,
    suggestions: [],
    composer,
  };
}

export function presentAskAnswer(
  input: Parameters<typeof candidateAskAnswer>[0],
): AskSheetOutcome {
  return rendered(candidateAskAnswer(input));
}
export function presentCantYet(): AskSheetOutcome {
  return rendered(candidateCantYet());
}
