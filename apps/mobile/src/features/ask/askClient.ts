import { trustedCopy } from './askText';
import {
  answerFromText,
  readModelText,
  readServerText,
  readCopyRefs,
} from './askAnswerBoundary';
export { answerFromText } from './askAnswerBoundary';
import { computeFiatTotal } from '@/src/features/balances/computeFiatTotal';
import type {
  FiatTotalResult,
  HoldingsSnapshot,
  PriceQuoteMap,
} from '@/src/features/balances/computeFiatTotal';
import { copy } from '@/constants/copy';
import { SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS } from '@corso/wallet';
import {
  acquireDefaultConsentLease,
  captureAiConsentOwner,
  ensureAiConsentHydrated,
  type AiConsentLease,
} from '@/src/features/aiConsent/aiConsentStore';
import {
  SOL_MINT,
  formatAtomicAmount,
  usdcMintForCluster,
} from '@/src/features/swap/tokens';
import { fetchTokenSearch } from '@/src/features/swap/fetchTokenSearch';
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import {
  MOVING_ROW_COUNT,
  type MovingSnapshot,
} from '@/src/features/moving/types';
import {
  classifyUnfundedAsk,
  emptyWalletText,
  type UnfundedAskCapability,
} from './emptyWalletAnswers';
import type { RoutineDraft } from '@/src/features/routines/types';
import { parseVitalsAnswer } from '@/src/features/tokenVitals/parseVitals';
import type { VitalsAnswer } from '@/src/features/tokenVitals/types';
import {
  SIGNAL_KINDS,
  SIGNAL_TIMEFRAMES,
  type SignalTimeframe,
} from '@/src/features/signals/types';

const ASK_UNAVAILABLE = copy.ask.unavailable;
/** Exact body `createAskProtection()` returns on 429. Not user-facing copy. */
const PER_CLIENT_ASK_RATE_LIMIT_MESSAGE =
  'Too many Ask requests. Try again shortly.';
export const ASK_CLIENT_TIMEOUT_MS = 13_000;

const CONFLUENCE_BANDS = [
  'strong_bear',
  'bear',
  'neutral',
  'bull',
  'strong_bull',
] as const;
const CONFLUENCE_KINDS = [
  'market_structure',
  'order_block',
  'fvg',
  'liquidity',
  'divergence',
  'premium_discount',
] as const;
const CONFLUENCE_REASONS = ['stale', 'unpriced', 'unreadable'] as const;

export type AskConfluenceBand = (typeof CONFLUENCE_BANDS)[number];
export type AskConfluenceKind = (typeof CONFLUENCE_KINDS)[number];
export type AskConfluenceReason = (typeof CONFLUENCE_REASONS)[number];

/** Server read. A score is present only with `restsOn: 'closed_bars'`. */
export type AskConfluenceAnswer =
  | {
      status: 'read';
      score: number;
      band: AskConfluenceBand;
      contributors: ReadonlyArray<{ kind: AskConfluenceKind }>;
      restsOn: 'closed_bars';
      timeframe: SignalTimeframe;
      asOf: string;
      bars: number;
      degradedCount: number;
    }
  | { status: 'unknown'; reason: AskConfluenceReason };

function isConfluenceBand(value: unknown): value is AskConfluenceBand {
  return (
    typeof value === 'string' &&
    (CONFLUENCE_BANDS as readonly string[]).includes(value)
  );
}

function isConfluenceKind(value: unknown): value is AskConfluenceKind {
  return (
    typeof value === 'string' &&
    (CONFLUENCE_KINDS as readonly string[]).includes(value)
  );
}

function isConfluenceReason(value: unknown): value is AskConfluenceReason {
  return (
    typeof value === 'string' &&
    (CONFLUENCE_REASONS as readonly string[]).includes(value)
  );
}

function isAskTimeframe(value: unknown): value is SignalTimeframe {
  return (
    typeof value === 'string' &&
    (SIGNAL_TIMEFRAMES as readonly string[]).includes(value)
  );
}

function isCounted(value: unknown, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

/**
 * Keep a confluence body only when it is a read that names its basis, or an
 * Unknown with a reason. A score riding on Unknown is dropped with the field
 * rather than shown.
 */
export function parseAskConfluence(value: unknown): AskConfluenceAnswer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.status === 'unknown') {
    return isConfluenceReason(body.reason)
      ? { status: 'unknown', reason: body.reason }
      : null;
  }
  if (body.status !== 'read' || body.restsOn !== 'closed_bars') return null;
  if (
    typeof body.score !== 'number' ||
    !Number.isInteger(body.score) ||
    body.score < 0 ||
    body.score > 100 ||
    !isConfluenceBand(body.band) ||
    !Array.isArray(body.contributors) ||
    body.contributors.length === 0
  ) {
    return null;
  }
  const contributors: Array<{ kind: AskConfluenceKind }> = [];
  for (const row of body.contributors) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    const kind = (row as { kind?: unknown }).kind;
    if (!isConfluenceKind(kind)) return null;
    contributors.push({ kind });
  }
  if (
    !isAskTimeframe(body.timeframe) ||
    typeof body.asOf !== 'string' ||
    !Number.isFinite(Date.parse(body.asOf)) ||
    !isCounted(body.bars, Number.MAX_SAFE_INTEGER) ||
    !isCounted(body.degradedCount, SIGNAL_KINDS.length)
  ) {
    return null;
  }
  return {
    status: 'read',
    score: body.score,
    band: body.band,
    contributors,
    restsOn: 'closed_bars',
    timeframe: body.timeframe,
    asOf: body.asOf,
    bars: body.bars,
    degradedCount: body.degradedCount,
  };
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

declare class ProducedAnswerIdentity {
  private readonly producedAnswerIdentity: void;
}
export type AskAnswer = ProducedAnswerIdentity & {
  status: 'answered' | 'unavailable';
  answer: string;
  chips: string[];
  /** Client-derived: only known informational server answers may get an AI take. */
  connectedTakeAllowed?: true;
  swap?: AskSwapHandoff;
  /** Insufficient funds: only an explicit tap opens Buy. */
  addMoney?: true;
  /** Explicit rows shown after a fail-closed ambiguous mint resolution. */
  swapChoices?: AskSwapChoice[];
  /** Two-leg watch-only intent. The screen still requires a signed Review. */
  routine?: RoutineDraft;
  vitals?: VitalsAnswer;
  confluence?: AskConfluenceAnswer;
  perClientRateLimit?: true;
  consentRequired?: 'default_assistant';
  sellDoors?: AskSellDoor[];
};

/**
 * One exit door. The same triple the token screen's Sell door puts on the route,
 * and nothing else — no amount, no destination, no quote.
 */
export type AskSellDoor = {
  mint: string;
  symbol: string;
  decimals: number;
  /** Open token detail first so unknown-price holdings re-run chain facts gates. */
  assetDetailsOnly?: true;
  /** `copy.ask.sellDoorLabel`. Carried so the pill row renders no literals. */
  label: string;
};

export type AskSwapChoice = {
  mint: string;
  symbol: string;
  name: string | null;
  isVerified: boolean | null;
  liquidityUsd: number | null;
  /**
   * Proven mint-account decimals. A row can only exist with these — a mint
   * whose decimals nobody read cannot be turned into an amount, so the picker
   * drops it (the same rule `jupiterTokenSearch.ts` states for its own rows).
   */
  decimals: number;
  /**
   * Which balance is being spent, resolved from `fromRef` against the holdings
   * this client sent — so a row can only ever name something we hold, with or
   * without an amount attached.
   */
  fromSymbol: string;
  swap?: AskSwapHandoff;
};

export type AskSwapHandoff = {
  /** Which balance is being spent. Resolved from `fromRef` against the
   * holdings this client sent, so it can only ever name something we hold. */
  fromSymbol: string;
  toSymbol: string;
  /** Server-resolved destination mint. */
  toMint: string;
  /** Server-resolved mint-account decimals. */
  toDecimals: number;
  /** Base units of the **from** token, computed server-side. Never a float. */
  inAmountAtomic: string;
  /** Present for every SOL prefill; proves the composer reserve was applied. */
  amountGuard?: 'sol-reserve';
};

export type SubmitAskInput = {
  text: string;
  holdings: HoldingsSnapshot | null;
  result: FiatTotalResult;
  quotes: PriceQuoteMap;
  /** Same-mount, validated Moving snapshot. Exact-mint matches only. */
  movingSnapshot?: MovingSnapshot | null;
  apiBaseUrl?: string | null;
  now?: Date;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  /** Routine-shaped responses stay invisible unless public config enabled them. */
  routinesEnabled?: boolean;
  vitalsEnabled?: boolean;
  requestId?: string;
  onShape?: (shape: AskAnswerShape | null) => void;
};

type SentHolding = {
  ref: string;
  symbol: string;
  balanceBaseUnits: string;
  /** Present on every holding `buildAskPayload` sends. */
  mint?: string;
  decimals?: number;
};

export type AskAnswerIntent =
  | 'SWAP'
  | 'HOLDING_FACT'
  | 'PORTFOLIO'
  | 'CLARIFY'
  | 'REFUSE'
  | 'OUT_OF_SCOPE'
  | 'TOKEN_VITALS';

const ANSWER_INTENTS: readonly AskAnswerIntent[] = [
  'SWAP',
  'HOLDING_FACT',
  'PORTFOLIO',
  'CLARIFY',
  'REFUSE',
  'OUT_OF_SCOPE',
  'TOKEN_VITALS',
];

export type AskAnswerShape = {
  intent: AskAnswerIntent | null;
  subjectMint: string | null;
  fromMint: string | null;
  fromDecimals: number | null;
};

export function readAnswerShape(
  value: unknown,
  sentHoldings: readonly SentHolding[],
): AskAnswerShape | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.status !== 'answered') return null;
  const result = body.result;
  if (!result || typeof result !== 'object' || Array.isArray(result))
    return null;
  const record = result as Record<string, unknown>;
  const intent =
    ANSWER_INTENTS.find((known) => known === record.intent) ?? null;
  const byRef = (ref: unknown) =>
    typeof ref === 'string'
      ? (sentHoldings.find((holding) => holding.ref === ref) ?? null)
      : null;
  const subject = intent === 'HOLDING_FACT' ? byRef(record.subjectRef) : null;
  const swap =
    record.swap &&
    typeof record.swap === 'object' &&
    !Array.isArray(record.swap)
      ? (record.swap as Record<string, unknown>)
      : null;
  const from = intent === 'SWAP' && swap ? byRef(swap.fromRef) : null;
  return {
    intent,
    subjectMint: typeof subject?.mint === 'string' ? subject.mint : null,
    fromMint: typeof from?.mint === 'string' ? from.mint : null,
    fromDecimals:
      typeof from?.decimals === 'number' &&
      Number.isInteger(from.decimals) &&
      from.decimals >= 0 &&
      from.decimals <= 18
        ? from.decimals
        : null,
  };
}

function endpoint(raw: string | null | undefined): string | null {
  const base = raw?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/v1/ask`;
}

function finiteNumber(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Why a payload could not be built. `empty_wallet` is a fact about the user's
 * balance; `unreadable` is a fault. Distinguishing them is the whole point —
 * see the copy constants above.
 */
export type AskPayloadRefusal = 'empty_wallet' | 'unreadable';

function quantitiesConfirmedZero(
  snapshot: SubmitAskInput['holdings'],
): boolean {
  if (snapshot == null || snapshot.quantityStatus !== 'ready') return false;
  return snapshot.lines
    .filter((line) => line.includeInHomeTotal)
    .every(
      (line) => /^\d+$/.test(line.atomic.trim()) && BigInt(line.atomic) === 0n,
    );
}

export function classifyPayloadRefusal(
  input: SubmitAskInput,
): AskPayloadRefusal {
  const snapshot = input.holdings;
  const totalUsd = finiteNumber(input.result.totalFiat);
  // A wallet holding nothing is empty, full stop. `computeFiatTotal` resolves
  // an all-zero book to `zero` rather than `fully_priced` — with the flag on as
  // well as off — so the old `fully_priced` requirement below could never fire
  // for a genuinely empty wallet, and the old empty-wallet branch was unreachable.
  if (quantitiesConfirmedZero(snapshot)) return 'empty_wallet';

  // Retained: a book that priced completely and summed to zero is also not a
  // fault. That is dust — quantities read, prices complete, total rounds to
  // zero — and it was the only case the old rule actually reached. Widening
  // rather than replacing means nothing that reported "empty" stops doing so.
  const confidentlyZero =
    snapshot != null &&
    snapshot.quantityStatus === 'ready' &&
    input.result.status === 'fully_priced' &&
    totalUsd === 0;

  // Anything less certain is a fault, because telling someone their wallet is
  // empty when it might not be is the worse of the two errors by a wide margin.
  return confidentlyZero ? 'empty_wallet' : 'unreadable';
}

const DISCLOSED_HOLDINGS_CAP = 20;

export function buildAskPayload(
  input: SubmitAskInput,
  unfundedCapability: UnfundedAskCapability,
): Record<string, unknown> | null {
  const snapshot = input.holdings;
  const totalUsd = finiteNumber(input.result.totalFiat);
  const hasFundedContext =
    snapshot != null &&
    snapshot.quantityStatus === 'ready' &&
    (input.result.status === 'fully_priced' ||
      input.result.status === 'partially_priced') &&
    totalUsd !== null &&
    input.result.pricedMintCount > 0 &&
    (totalUsd > 0 || input.result.unpricedMintCount > 0);

  const contextFreeRead =
    !hasFundedContext &&
    quantitiesConfirmedZero(snapshot) &&
    unfundedCapability === 'wallet_independent';
  if (!hasFundedContext && !contextFreeRead) return null;
  const payloadTotalUsd = hasFundedContext && totalUsd !== null ? totalUsd : 0;

  const movingChangeByMint = new Map<string, number>();
  const movingScope: Array<{ symbol: string; mint: string }> = [];
  for (const row of input.movingSnapshot?.rows ?? []) {
    if (
      movingScope.length < MOVING_ROW_COUNT &&
      row.symbol.length > 0 &&
      row.symbol.length <= 32 &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.mint)
    ) {
      movingScope.push({ symbol: row.symbol, mint: row.mint });
    }
    if (row.numberKind !== 'change24hPct') continue;
    const value = Number(row.numberValue);
    if (Number.isFinite(value) && value >= -10_000 && value <= 10_000) {
      movingChangeByMint.set(row.mint, value);
    }
  }

  const included = hasFundedContext
    ? snapshot!.lines.filter(
        (line) =>
          line.includeInHomeTotal &&
          input.result.lines.some(
            (valued) => valued.mint === line.mint && valued.priced,
          ),
      )
    : [];
  const holdings = included.map((line, index) => {
    const spendAtomic =
      line.mint === SOL_MINT && line.symbol === 'SOL'
        ? (line.nativeAtomic ?? line.atomic)
        : line.atomic;
    if (!/^\d+$/.test(spendAtomic)) return null;
    const fiatLine = input.result.lines.find(
      (candidate) => candidate.mint === line.mint,
    );
    // A combined native+wrapped SOL valuation must never become a native pay balance.
    const nativeFiat =
      line.nativeAtomic !== undefined &&
      line.mint === SOL_MINT &&
      line.symbol === 'SOL'
        ? computeFiatTotal({
            holdings: {
              ...snapshot!,
              lines: [{ ...line, atomic: spendAtomic }],
            },
            quotes: input.quotes,
            nowMs: input.quotes[line.mint]?.asOfMs ?? snapshot!.asOfMs,
          }).lines[0]?.fiatAmount
        : fiatLine?.fiatAmount;
    const usd = finiteNumber(nativeFiat);
    const amount = Number(formatAtomicAmount(spendAtomic, line.decimals));
    const quote = input.quotes[line.mint];
    const unitPrice = line.symbol === 'USDC' ? 1 : finiteNumber(quote?.price);
    if (
      !fiatLine?.priced ||
      usd === null ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (amount > 0 && (unitPrice === null || unitPrice <= 0))
    )
      return null;
    return {
      ref: `h${index}`,
      symbol: line.symbol,
      name:
        line.symbol === 'SOL'
          ? 'Solana'
          : line.symbol === 'USDC'
            ? 'USD Coin'
            : line.symbol,
      amount,
      usd,
      pctOfTotal: payloadTotalUsd > 0 ? (usd / payloadTotalUsd) * 100 : 0,
      // The balance/price snapshot carries no 24h field. Reuse only an exact
      // mint match from Home's validated Moving snapshot; absent stays null.
      // Never symbol-join, and never turn unknown into a numeric zero.
      change24hPct: movingChangeByMint.get(line.mint) ?? null,
      // Holdings membership supplies no verification for arbitrary tokens.
      verified:
        line.mint === SOL_MINT ||
        (snapshot!.cluster !== null &&
          line.mint === usdcMintForCluster(snapshot!.cluster)),
      mint: line.mint,
      decimals: line.decimals,
      balanceBaseUnits: spendAtomic,
      unitPriceUsd: unitPrice,
    };
  });
  if (
    holdings.some((holding) => holding === null) ||
    (hasFundedContext &&
      holdings.length === 0 &&
      input.result.unpricedMintCount === 0)
  )
    return null;

  const safeHoldings = holdings.filter((holding) => holding !== null);
  const sol = safeHoldings.find((holding) => holding.symbol === 'SOL');
  // Keep known-zero context for sell refusals on small books. At the cap,
  // positive wallet quantities take slots first; a zero row is not a withheld
  // holding. Combined native/wrapped SOL uses the wallet quantity here, while
  // its native-only spend quantity remains unchanged in the sent record.
  const heldHoldings = safeHoldings.filter(
    (_holding, index) => !/^0+$/.test(included[index]!.atomic),
  );
  const heldSet = new Set(heldHoldings);
  const sentHoldings =
    safeHoldings.length <= DISCLOSED_HOLDINGS_CAP
      ? safeHoldings
      : [
          ...heldHoldings,
          ...safeHoldings.filter((holding) => !heldSet.has(holding)),
        ].slice(0, DISCLOSED_HOLDINGS_CAP);
  const sentSet = new Set(sentHoldings);
  const undisclosedHoldingsCount = heldHoldings.filter(
    (holding) => !sentSet.has(holding),
  ).length;
  return {
    text: input.text,
    holdings: sentHoldings,
    totalUsd: payloadTotalUsd,
    undisclosedHoldingsCount,
    ...(input.result.unpricedMintCount > 0
      ? { unpricedHoldingsCount: input.result.unpricedMintCount }
      : {}),
    solForFees: sol?.amount ?? 0,
    recent: [],
    now: (input.now ?? new Date()).toISOString().slice(0, 10),
    moreHoldingsCount: safeHoldings.length - sentHoldings.length,
    ...(movingScope.length > 0 ? { moving: movingScope } : {}),
  };
}

export function buildSwapHandoff(args: {
  fromRef: string;
  toSymbol: string;
  resolution: unknown;
  inAmount: unknown;
  affordability?: unknown;
  sentHoldings: readonly SentHolding[];
}): AskSwapHandoff | null {
  const resolution = args.resolution;
  if (
    !resolution ||
    typeof resolution !== 'object' ||
    Array.isArray(resolution)
  ) {
    return null;
  }
  const resolved = resolution as {
    status?: unknown;
    mint?: unknown;
    decimals?: unknown;
  };
  if (resolved.status !== 'resolved') return null;
  if (typeof resolved.mint !== 'string') return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(resolved.mint)) return null;
  if (
    typeof resolved.decimals !== 'number' ||
    !Number.isInteger(resolved.decimals) ||
    resolved.decimals < 0 ||
    resolved.decimals > 18
  )
    return null;

  const holding = args.sentHoldings.find((line) => line.ref === args.fromRef);
  if (
    !holding ||
    typeof holding.symbol !== 'string' ||
    holding.symbol.length === 0
  ) {
    return null;
  }

  if (typeof args.inAmount !== 'string' || !/^[0-9]+$/.test(args.inAmount)) {
    return null;
  }
  // Zero is not an amount to open a trade with.
  if (/^0+$/.test(args.inAmount)) return null;

  if (args.toSymbol.length === 0 || args.toSymbol.length > 16) return null;

  if (!/^\d+$/.test(holding.balanceBaseUnits)) return null;
  const proof = parseAffordability(args.affordability);
  if (
    !proof ||
    proof.clamped ||
    proof.balance !== BigInt(holding.balanceBaseUnits)
  )
    return null;
  if (BigInt(args.inAmount) > proof.spendable) return null;

  let amountGuard: AskSwapHandoff['amountGuard'];
  if (holding.symbol === 'SOL') {
    if (proof.reserve !== SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS) return null;
    const expectedSpendable =
      proof.balance > proof.reserve ? proof.balance - proof.reserve : 0n;
    if (proof.spendable !== expectedSpendable) return null;
    amountGuard = 'sol-reserve';
  } else {
    if (proof.reserve !== 0n || proof.spendable !== proof.balance) return null;
  }

  return {
    fromSymbol: holding.symbol,
    toSymbol: args.toSymbol,
    toMint: resolved.mint,
    toDecimals: resolved.decimals,
    inAmountAtomic: args.inAmount,
    ...(amountGuard ? { amountGuard } : {}),
  };
}

function parseAffordability(value: unknown): {
  balance: bigint;
  spendable: bigint;
  reserve: bigint;
  clamped: boolean;
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.balanceBaseUnits !== 'string' ||
    !/^\d+$/.test(record.balanceBaseUnits) ||
    typeof record.spendableBaseUnits !== 'string' ||
    !/^\d+$/.test(record.spendableBaseUnits) ||
    typeof record.reserveBaseUnits !== 'string' ||
    !/^\d+$/.test(record.reserveBaseUnits) ||
    typeof record.clamped !== 'boolean'
  )
    return null;
  return {
    balance: BigInt(record.balanceBaseUnits),
    spendable: BigInt(record.spendableBaseUnits),
    reserve: BigInt(record.reserveBaseUnits),
    clamped: record.clamped,
  };
}

/** Exact mint-account decimals, or null when the row cannot prove them. */
function choiceDecimals(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 18
    ? value
    : null;
}

function buildAmbiguousSwapChoices(args: {
  fromRef: string;
  toSymbol: string;
  resolution: unknown;
  inAmount: unknown;
  affordability: unknown;
  sentHoldings: readonly SentHolding[];
}): AskSwapChoice[] | null {
  if (
    !args.resolution ||
    typeof args.resolution !== 'object' ||
    Array.isArray(args.resolution)
  ) {
    return null;
  }
  const resolution = args.resolution as Record<string, unknown>;
  if (
    resolution.status !== 'ambiguous' ||
    typeof resolution.symbol !== 'string' ||
    resolution.symbol.toUpperCase() !== args.toSymbol.toUpperCase() ||
    !Array.isArray(resolution.candidates)
  )
    return null;

  const amountFactsOffered =
    args.inAmount !== undefined || args.affordability !== undefined;

  const source = args.sentHoldings.find((line) => line.ref === args.fromRef);
  if (
    !source ||
    typeof source.symbol !== 'string' ||
    source.symbol.length === 0
  ) {
    return null;
  }

  const choices: AskSwapChoice[] = [];
  const seen = new Set<string>();
  for (const raw of resolution.candidates) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const candidate = raw as Record<string, unknown>;
    if (
      typeof candidate.mint !== 'string' ||
      seen.has(candidate.mint) ||
      typeof candidate.symbol !== 'string' ||
      candidate.symbol.toUpperCase() !== args.toSymbol.toUpperCase() ||
      !(candidate.name === null || typeof candidate.name === 'string') ||
      !(
        candidate.isVerified === null ||
        typeof candidate.isVerified === 'boolean'
      ) ||
      !(
        candidate.liquidityUsd === null ||
        (typeof candidate.liquidityUsd === 'number' &&
          Number.isFinite(candidate.liquidityUsd) &&
          candidate.liquidityUsd >= 0)
      ) ||
      // The choice rows print a stranger's name and symbol into the thread.
      // A condemned one voids the whole set, the same way every other broken
      // field here does: no row, rather than a row Corso would not say.
      isModeratedTokenLabel({
        name: candidate.name as string | null,
        symbol: candidate.symbol,
      })
    )
      return null;

    // Unknown decimals: not a fault, not a choice. Drop the row, keep the set.
    const decimals = choiceDecimals(candidate.decimals);
    if (decimals === null) continue;

    const swap = amountFactsOffered
      ? buildSwapHandoff({
          fromRef: args.fromRef,
          toSymbol: args.toSymbol,
          resolution: {
            status: 'resolved',
            mint: candidate.mint,
            decimals,
          },
          inAmount: args.inAmount,
          affordability: args.affordability,
          sentHoldings: args.sentHoldings,
        })
      : null;
    // Facts were offered and did not add up. That is still the whole set.
    if (amountFactsOffered && !swap) return null;
    seen.add(candidate.mint);
    choices.push({
      mint: candidate.mint,
      symbol: candidate.symbol,
      name: candidate.name as string | null,
      isVerified: candidate.isVerified as boolean | null,
      liquidityUsd: candidate.liquidityUsd as number | null,
      decimals,
      fromSymbol: source.symbol,
      ...(swap ? { swap } : {}),
    });
  }
  return choices.length > 0 ? choices : null;
}

export function parseAnswer(
  value: unknown,
  /** The holdings this request sent, so `fromRef` resolves to a symbol we hold. */
  sentHoldings: readonly SentHolding[],
  options: { routinesEnabled?: boolean; vitalsEnabled?: boolean } = {},
): AskAnswer | null {
  let parsed = parseAnswerCore(value, sentHoldings, options);
  const body = value as Record<string, unknown> | null;
  const result = body?.result as Record<string, unknown> | undefined;
  // Unknown, refusal, clarification and all money intents fail closed. Never
  // infer permission from prose or from a missing handoff after validation.
  if (
    parsed?.status === 'answered' &&
    body?.status === 'answered' &&
    (body.source === 'front_door' || body.source === 'model') &&
    ['TOKEN_VITALS', 'HOLDING_FACT', 'PORTFOLIO'].includes(
      String(result?.intent),
    ) &&
    !body.action &&
    !result?.swap &&
    !parsed.swap &&
    !parsed.swapChoices &&
    !parsed.routine
  )
    parsed = Object.assign(parsed, { connectedTakeAllowed: true as const });
  if (!parsed || parsed.status !== 'answered' || options.vitalsEnabled !== true)
    return parsed;
  const record = value as Record<string, unknown>;
  const vitals = parseVitalsAnswer(record.vitals);
  const confluence = parseAskConfluence(record.confluence);
  return Object.assign(parsed, {
    ...(vitals ? { vitals } : {}),
    ...(confluence ? { confluence } : {}),
  });
}

function parseAnswerCore(
  value: unknown,
  sentHoldings: readonly SentHolding[],
  options: { routinesEnabled?: boolean } = {},
): AskAnswer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.status === 'consent_required') {
    return body.consent === 'default_assistant'
      ? Object.assign(
          answerFromText(
            'answered',
            trustedCopy('aiConsent', 'defaultDeclinedAnswer'),
          ),
          { consentRequired: 'default_assistant' as const },
        )
      : null;
  }
  if (body.status === 'routine_stage') {
    const routineNotSetUp: AskAnswer = answerFromText(
      'answered',
      trustedCopy('ask', 'routineNotSetUp'),
    );
    if (options.routinesEnabled !== true) return routineNotSetUp;
    const routine = body.routine;
    if (!routine || typeof routine !== 'object' || Array.isArray(routine)) {
      return null;
    }
    const raw = routine as Record<string, unknown>;
    if (raw.kind === 'clarify') {
      return typeof raw.question === 'string' && raw.question.trim() !== ''
        ? answerFromText(
            'answered',
            readServerText(raw.question, readCopyRefs(raw.copyRefs).question),
          )
        : null;
    }
    const validAmount =
      (raw.amountKind === 'all' && raw.amountValue === null) ||
      (['fraction', 'usd', 'absolute'].includes(String(raw.amountKind)) &&
        typeof raw.amountValue === 'number' &&
        Number.isFinite(raw.amountValue) &&
        raw.amountValue > 0);
    if (
      raw.kind !== 'exit' ||
      typeof raw.sourceText !== 'string' ||
      raw.sourceText.trim() === '' ||
      typeof raw.positionMint !== 'string' ||
      !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw.positionMint) ||
      typeof raw.positionSymbol !== 'string' ||
      raw.positionSymbol.length === 0 ||
      raw.positionSymbol.length > 32 ||
      typeof raw.baselinePriceUsd !== 'number' ||
      !Number.isFinite(raw.baselinePriceUsd) ||
      raw.baselinePriceUsd <= 0 ||
      typeof raw.upLegPct !== 'number' ||
      !Number.isFinite(raw.upLegPct) ||
      raw.upLegPct <= 0 ||
      typeof raw.downLegPct !== 'number' ||
      !Number.isFinite(raw.downLegPct) ||
      raw.downLegPct <= 0 ||
      raw.downLegPct > 100 ||
      !validAmount
    )
      // A draft Review cannot show (a one-sided exit, or one out of range).
      return routineNotSetUp;
    return Object.assign(answerFromText('answered', readModelText('')), {
      routine: raw as RoutineDraft,
    });
  }
  if (body.status === 'unavailable' && typeof body.answer === 'string') {
    return answerFromText(
      'unavailable',
      readServerText(body.answer, readCopyRefs(body.copyRefs).answer),
    );
  }
  if (
    body.error === 'rate_limited' &&
    body.message === PER_CLIENT_ASK_RATE_LIMIT_MESSAGE
  ) {
    return Object.assign(
      answerFromText('unavailable', trustedCopy('ask', 'rateLimited')),
      { perClientRateLimit: true as const },
    );
  }
  if (
    body.status !== 'answered' ||
    !body.result ||
    typeof body.result !== 'object'
  ) {
    return null;
  }
  const result = body.result as Record<string, unknown>;
  const refs = readCopyRefs(result.copyRefs);
  const chipRefs = Array.isArray(refs.chips) ? refs.chips : [];
  const chips = Array.isArray(result.chips)
    ? result.chips
        .flatMap((chip, at) =>
          typeof chip === 'string' ? [readServerText(chip, chipRefs[at])] : [],
        )
        .slice(0, 2)
    : [];
  if (body.action === 'add_money' && result.intent === 'CLARIFY') {
    const raw = body.insufficientBalance as Record<string, unknown> | undefined;
    const proof = parseAffordability(body.affordability);
    const holding = sentHoldings.find((line) => line.ref === raw?.fromRef);
    if (
      !raw ||
      !proof ||
      proof.clamped ||
      !holding ||
      !/^\d+$/.test(holding.balanceBaseUnits) ||
      proof.balance !== BigInt(holding.balanceBaseUnits) ||
      typeof raw.requestedBaseUnits !== 'string' ||
      !/^\d+$/.test(raw.requestedBaseUnits) ||
      typeof raw.decimals !== 'number' ||
      !Number.isInteger(raw.decimals) ||
      raw.decimals < 0 ||
      raw.decimals > 18
    )
      return null;
    const requested = BigInt(raw.requestedBaseUnits);
    const reserve =
      holding.symbol === 'SOL' ? SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS : 0n;
    const spendable = proof.balance > reserve ? proof.balance - reserve : 0n;
    if (
      proof.reserve !== reserve ||
      proof.spendable !== spendable ||
      (requested > 0n ? requested <= spendable : spendable > 0n) ||
      (holding.symbol === 'SOL' && raw.decimals !== 9) ||
      (holding.symbol === 'USDC' && raw.decimals !== 6)
    )
      return null;
    const answer =
      requested > 0n
        ? readModelText(
            copy.ask.insufficientAmount(
              formatAtomicAmount(raw.requestedBaseUnits, raw.decimals),
              formatAtomicAmount(holding.balanceBaseUnits, raw.decimals),
              holding.symbol,
            ),
          )
        : typeof result.answer === 'string'
          ? readServerText(result.answer, refs.answer)
          : trustedCopy('ask', 'moneyUnavailable');
    return Object.assign(answerFromText('answered', answer), {
      addMoney: true as const,
    });
  }
  if (typeof result.answer === 'string' && result.answer.trim() !== '') {
    return answerFromText(
      'answered',
      readServerText(result.answer, refs.answer),
      chips,
    );
  }
  if (
    result.intent === 'SWAP' &&
    result.swap &&
    typeof result.swap === 'object' &&
    !Array.isArray(result.swap) &&
    ['resolved', 'ambiguous'].includes(
      String((body.resolution as { status?: unknown } | undefined)?.status),
    )
  ) {
    const swap = result.swap as Record<string, unknown>;
    if (typeof swap.fromRef !== 'string' || typeof swap.toSymbol !== 'string')
      return null;

    const resolutionStatus = (body.resolution as { status?: unknown }).status;
    const handoff =
      resolutionStatus === 'resolved'
        ? buildSwapHandoff({
            fromRef: swap.fromRef,
            toSymbol: swap.toSymbol,
            resolution: body.resolution,
            inAmount: body.inAmount,
            affordability: body.affordability,
            sentHoldings,
          })
        : null;
    const swapChoices =
      resolutionStatus === 'ambiguous'
        ? buildAmbiguousSwapChoices({
            fromRef: swap.fromRef,
            toSymbol: swap.toSymbol,
            resolution: body.resolution,
            inAmount: body.inAmount,
            affordability: body.affordability,
            sentHoldings,
          })
        : null;
    if (resolutionStatus === 'ambiguous' && !swapChoices) return null;

    return Object.assign(
      answerFromText(
        'answered',
        readModelText(
          swapChoices
            ? copy.ask.chooseMint(swap.toSymbol)
            : `Swap ${swap.toSymbol}.`,
        ),
      ),
      {
        ...(handoff ? { swap: handoff } : {}),
        ...(swapChoices ? { swapChoices } : {}),
      },
    );
  }
  return null;
}

type SendConsent =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'abort' }>
  | Readonly<{ kind: 'lease'; lease: AiConsentLease }>;

const NO_CONSENT: SendConsent = Object.freeze({ kind: 'none' });
const ABORT_CONSENT: SendConsent = Object.freeze({ kind: 'abort' });

async function consentReader(
  owner: string | null,
  requestId: string,
): Promise<SendConsent> {
  const binding = captureAiConsentOwner();
  await ensureAiConsentHydrated();
  if (binding !== null && (!binding.stillCurrent() || binding.owner !== owner))
    return ABORT_CONSENT;
  if (owner === null || owner.length === 0) return NO_CONSENT;
  const lease = acquireDefaultConsentLease(owner, requestId);
  return lease === null ? NO_CONSENT : Object.freeze({ kind: 'lease', lease });
}

/** A send nobody named an id for: unique, so no permission can ever match it. */
let unnamedSends = 0;
function sendRequestId(named: string | undefined): string {
  if (typeof named === 'string' && named.length > 0) return named;
  unnamedSends += 1;
  return `ask-send-${unnamedSends}-${Math.random().toString(36).slice(2)}`;
}

export async function submitAsk(input: SubmitAskInput): Promise<AskAnswer> {
  const url = endpoint(input.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_URL);
  if (!url)
    return answerFromText('unavailable', trustedCopy('ask', 'unavailable'));
  const unfundedCapability = classifyUnfundedAsk(input.text);
  const payload = buildAskPayload(input, unfundedCapability);
  if (!payload) {
    return answerFromText(
      'unavailable',
      classifyPayloadRefusal(input) === 'empty_wallet'
        ? emptyWalletText(input.text)
        : trustedCopy('ask', 'moneyUnavailable'),
    );
  }
  const requestId = sendRequestId(input.requestId);
  const consent = await consentReader(
    input.holdings?.address ?? null,
    requestId,
  );
  if (consent.kind === 'abort')
    return answerFromText('unavailable', trustedCopy('ask', 'unavailable'));
  const leaseBroke = () =>
    consent.kind === 'lease' && !consent.lease.stillValid();
  if (leaseBroke())
    return answerFromText('unavailable', trustedCopy('ask', 'unavailable'));
  payload.modelConsent = consent.kind === 'lease';

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? ASK_CLIENT_TIMEOUT_MS,
  );
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const sentHoldings = (payload.holdings as SentHolding[]) ?? [];
    let body: unknown = await response.json();
    if (leaseBroke())
      return answerFromText('unavailable', trustedCopy('ask', 'unavailable'));
    const parseOptions = {
      routinesEnabled: input.routinesEnabled === true,
      vitalsEnabled: input.vitalsEnabled === true,
    };
    let parsed = parseAnswer(body, sentHoldings, parseOptions);

    // The currently deployed Ask contract predates destination decimals. The
    // token-search endpoint already returns mint-account decimals, so resolve
    // the exact server-selected mint before opening Swap. No match means no
    // handoff; the composer must never guess decimals or fall to another pair.
    if (
      parsed?.status === 'answered' &&
      !parsed.swap &&
      body != null &&
      typeof body === 'object' &&
      !Array.isArray(body)
    ) {
      const record = body as Record<string, unknown>;
      const resolution = record.resolution;
      const resolved =
        resolution != null &&
        typeof resolution === 'object' &&
        !Array.isArray(resolution)
          ? (resolution as Record<string, unknown>)
          : null;
      const mint =
        resolved?.status === 'resolved' && typeof resolved.mint === 'string'
          ? resolved.mint
          : null;
      if (mint && resolved?.decimals == null) {
        const candidates = await fetchTokenSearch({
          query: mint,
          signal: controller.signal,
          fetchImpl: input.fetchImpl,
          apiBaseUrl: url.replace(/\/v1\/ask$/, ''),
        });
        const exact = candidates.find(
          (candidate) => candidate.token.mint === mint,
        );
        if (leaseBroke())
          return answerFromText(
            'unavailable',
            trustedCopy('ask', 'unavailable'),
          );
        if (exact) {
          body = {
            ...record,
            resolution: { ...resolved, decimals: exact.token.decimals },
          };
          parsed = parseAnswer(body, sentHoldings, parseOptions);
        }
      }
    }
    if (parsed) input.onShape?.(readAnswerShape(body, sentHoldings));
    return (
      parsed ?? answerFromText('unavailable', trustedCopy('ask', 'unavailable'))
    );
  } catch {
    return answerFromText(
      'unavailable',
      trustedCopy('ask', controller.signal.aborted ? 'timeout' : 'unavailable'),
    );
  } finally {
    clearTimeout(timeout);
  }
}
