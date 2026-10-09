/**
 * Swap review/confirm intent binding — generation gate + frozen review intent.
 * Old quote responses must not overwrite current state; Confirm executes only
 * the frozen reviewed intent (full field set + recomputed digest).
 */
import { computeSwapQuoteDigest } from '@/src/features/swap/quoteDigest';
import type { SwapOrderResponse } from '@/src/features/swap/swapApi';
import { SwapApiError } from '@/src/features/swap/swapApi';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import {
  assertReviewedOutputTokenFactsIntent,
  freezeReviewedOutputTokenFacts,
  isReviewedOutputTokenFactsFresh,
  reviewedOutputTokenFactsSnapshotsEqual,
  type ReviewedOutputTokenFactsSnapshot,
} from '@/src/features/tokenFacts/reviewedTokenFacts';
import type { TokenFactsResponse } from '@/src/features/tokenFacts/types';

function freezeReviewedToken2022OutputFacts(args: {
  facts: TokenFactsResponse | null | undefined;
  quoteDigest: string;
}): ReviewedOutputTokenFactsSnapshot | null {
  if (!args.facts) return null;
  const snapshot = freezeReviewedOutputTokenFacts({
    facts: args.facts,
    quoteDigest: args.quoteDigest,
  });
  return snapshot.tokenProgram === 'token-2022' ? snapshot : null;
}

export type QuoteGenerationGate = {
  /** Begin a new in-flight quote request; returns its generation id. */
  begin(): number;
  /** True iff `id` is still the latest generation (not superseded/aborted). */
  isCurrent(id: number): boolean;
  /** Invalidate all in-flight quote responses (flip / unmount / abort). */
  invalidate(): void;
  /** Latest generation id (0 before any begin). */
  current(): number;
};

export function createQuoteGenerationGate(): QuoteGenerationGate {
  let current = 0;
  return {
    begin() {
      current += 1;
      return current;
    },
    isCurrent(id: number) {
      return id === current && id > 0;
    },
    invalidate() {
      current += 1;
    },
    current() {
      return current;
    },
  };
}

/** Synchronous confirm-valid cell — cleared by mutations before React state. */
export type ConfirmValidCell = { current: boolean };

/**
 * Testable sync clear used by amount/percent/max/flip/token/cluster mutations
 * and by every quote generation begin/apply.
 */
export function clearConfirmValidSync(cell: ConfirmValidCell): void {
  cell.current = false;
}

export function markConfirmValidSync(cell: ConfirmValidCell): void {
  cell.current = true;
}

/**
 * Apply a quote result only if its generation is still current.
 * Returns false when a newer request superseded this response (race).
 */
export function applyQuoteIfCurrent<T>(args: {
  generation: number;
  gate: QuoteGenerationGate;
  apply: () => T;
}): T | null {
  if (!args.gate.isCurrent(args.generation)) {
    return null;
  }
  return args.apply();
}

/**
 * Begin a new quote generation only after synchronously clearing confirm-valid.
 * Call at every quote-generation start so Confirm cannot race a prior epoch.
 */
export function beginQuoteGeneration(args: {
  gate: QuoteGenerationGate;
  confirmValid: ConfirmValidCell;
}): number {
  clearConfirmValidSync(args.confirmValid);
  return args.gate.begin();
}

/**
 * Apply a quote only if current — clears confirm-valid synchronously before apply
 * so a racing Confirm cannot treat the new quote as an already-reviewed epoch.
 */
export function applyQuoteIfCurrentClearingConfirm<T>(args: {
  generation: number;
  gate: QuoteGenerationGate;
  confirmValid: ConfirmValidCell;
  apply: () => T;
}): T | null {
  clearConfirmValidSync(args.confirmValid);
  return applyQuoteIfCurrent({
    generation: args.generation,
    gate: args.gate,
    apply: args.apply,
  });
}

export type SwapReviewRequest = Readonly<{
  inputMint: string;
  outputMint: string;
  amount: string;
}>;

/**
 * Every displayed and consumed review field — frozen at Review, compared at Confirm.
 */
export type FrozenSwapReviewIntent = Readonly<{
  requestId: string;
  quoteDigest: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  transaction: string;
  corsoFeeBps: number;
  quoteFeeBps: number;
  platformFeeBps: number;
  platformFeeAmount: string | null;
  networkFeeLamports?: string | null;
  accountRentLamports?: string | null;
  positiveSlippageBps: number;
  feeMint: string | null;
  feeDestination: string | null;
  referralAccount: string | null;
  feeDisplayName: string;
  feeDropped: boolean;
  router: string | null;
  mode: string | null;
  priceImpactPct: string | null;
  slippageBps: number;
  expireAt: string | null;
  lastValidBlockHeight: number | null;
  /** Pinned Jupiter instruction format ('V1' on Metis, null on Meta). */
  instructionVersion: string | null;
  paySymbol: string;
  receiveSymbol: string;
  generation: number;
  request: SwapReviewRequest;
  /** Minimal immutable Token-2022 semantics copied at Review, never API payload. */
  reviewedOutputTokenFacts: ReviewedOutputTokenFactsSnapshot | null;
  reviewedInputTokenFacts?: ReviewedOutputTokenFactsSnapshot | null;
}>;

function cloneOrderFromFrozen(frozen: FrozenSwapReviewIntent): SwapOrderResponse {
  return Object.freeze({
    requestId: frozen.requestId,
    transaction: frozen.transaction,
    inputMint: frozen.inputMint,
    outputMint: frozen.outputMint,
    inAmount: frozen.inAmount,
    outAmount: frozen.outAmount,
    otherAmountThreshold: frozen.otherAmountThreshold,
    corsoFeeBps: frozen.corsoFeeBps,
    quoteFeeBps: frozen.quoteFeeBps,
    feeMint: frozen.feeMint,
    platformFeeBps: frozen.platformFeeBps,
    platformFeeAmount: frozen.platformFeeAmount,
    networkFeeLamports: frozen.networkFeeLamports,
    accountRentLamports: frozen.accountRentLamports,
    positiveSlippageBps: frozen.positiveSlippageBps,
    feeDestination: frozen.feeDestination,
    referralAccount: frozen.referralAccount,
    router: frozen.router,
    mode: frozen.mode,
    priceImpactPct: frozen.priceImpactPct,
    slippageBps: frozen.slippageBps,
    expireAt: frozen.expireAt,
    lastValidBlockHeight: frozen.lastValidBlockHeight,
    quoteDigest: frozen.quoteDigest,
    feeDropped: frozen.feeDropped,
    feeDisplayName: frozen.feeDisplayName,
    instructionVersion: frozen.instructionVersion,
  });
}

/**
 * Review may only proceed when the ready quote still matches the current form
 * request and the generation that produced it has not been invalidated.
 */
export function assertReadyQuoteMatchesReviewRequest(args: {
  order: SwapOrderResponse;
  quoteDigest: string;
  generation: number;
  gate: QuoteGenerationGate;
  request: SwapReviewRequest;
}): void {
  if (!args.gate.isCurrent(args.generation) || args.generation <= 0) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }
  if (
    args.order.inputMint !== args.request.inputMint ||
    args.order.outputMint !== args.request.outputMint ||
    args.order.inAmount !== args.request.amount ||
    args.order.quoteDigest !== args.quoteDigest
  ) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }
  const recomputed = computeSwapQuoteDigest(args.order);
  if (recomputed !== args.quoteDigest) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote binding mismatch. Try again.',
    );
  }
}

export function freezeSwapReviewIntent(args: {
  order: SwapOrderResponse;
  quoteDigest: string;
  paySymbol: string;
  receiveSymbol: string;
  generation: number;
  request: SwapReviewRequest;
  outputTokenFacts?: TokenFactsResponse | null;
  inputTokenFacts?: TokenFactsResponse | null;
  cluster?: PriceCluster;
}): FrozenSwapReviewIntent {
  const {
    order,
    quoteDigest,
    paySymbol,
    receiveSymbol,
    generation,
    request,
  } = args;
  if (!quoteDigest || order.quoteDigest !== quoteDigest) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote binding mismatch. Try again.',
    );
  }
  const recomputed = computeSwapQuoteDigest(order);
  if (recomputed !== quoteDigest) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote binding mismatch. Try again.',
    );
  }
  if (
    order.inputMint !== request.inputMint ||
    order.outputMint !== request.outputMint ||
    order.inAmount !== request.amount
  ) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }
  if (
    args.outputTokenFacts &&
    args.cluster &&
    args.outputTokenFacts.cluster !== args.cluster
  ) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Token facts changed since review. Go back and review again.',
    );
  }
  const reviewedInputTokenFacts = freezeReviewedToken2022OutputFacts({facts: args.inputTokenFacts, quoteDigest});
  if (reviewedInputTokenFacts) {
    assertReviewedOutputTokenFactsIntent({snapshot: reviewedInputTokenFacts,quoteDigest,cluster: args.cluster,outputMint:order.inputMint});
  }
  const reviewedOutputTokenFacts = freezeReviewedToken2022OutputFacts({
    facts: args.outputTokenFacts,
    quoteDigest,
  });
  if (reviewedOutputTokenFacts) {
    try {
      assertReviewedOutputTokenFactsIntent({
        snapshot: reviewedOutputTokenFacts,
        quoteDigest,
        cluster: args.cluster ?? reviewedOutputTokenFacts.cluster,
        outputMint: order.outputMint,
      });
    } catch {
      throw new SwapApiError(
        'swap_quote_mismatch',
        'Token facts changed since review. Go back and review again.',
      );
    }
    if (
      reviewedOutputTokenFacts.chainStatus !== 'ok' ||
      reviewedOutputTokenFacts.tokenProgram == null ||
      typeof reviewedOutputTokenFacts.transferFeeConfigured !== 'boolean' ||
      typeof reviewedOutputTokenFacts.transferHookConfigured !== 'boolean'
    ) {
      throw new SwapApiError(
        'swap_quote_mismatch',
        'Token facts are incomplete. Go back and review again.',
      );
    }
  }
  return Object.freeze({
    requestId: order.requestId,
    quoteDigest,
    inputMint: order.inputMint,
    outputMint: order.outputMint,
    inAmount: order.inAmount,
    outAmount: order.outAmount,
    otherAmountThreshold: order.otherAmountThreshold,
    transaction: order.transaction,
    corsoFeeBps: order.corsoFeeBps,
    quoteFeeBps: order.quoteFeeBps,
    platformFeeBps: order.platformFeeBps,
    platformFeeAmount: order.platformFeeAmount,
    networkFeeLamports: order.networkFeeLamports,
    accountRentLamports: order.accountRentLamports,
    positiveSlippageBps: order.positiveSlippageBps,
    feeMint: order.feeMint,
    feeDestination: order.feeDestination,
    referralAccount: order.referralAccount,
    feeDisplayName: order.feeDisplayName,
    feeDropped: order.feeDropped,
    router: order.router,
    mode: order.mode,
    priceImpactPct: order.priceImpactPct,
    slippageBps: order.slippageBps,
    expireAt: order.expireAt,
    lastValidBlockHeight: order.lastValidBlockHeight,
    instructionVersion: order.instructionVersion,
    paySymbol,
    receiveSymbol,
    generation,
    request: Object.freeze({ ...request }),
    reviewedOutputTokenFacts,
    reviewedInputTokenFacts,
  });
}

/**
 * Confirm must execute exactly the frozen review intent — every displayed and
 * consumed field — against the current quote generation and exact current
 * request. Recomputes the digest and returns a frozen validated clone for
 * execute (never mutate live order state).
 */
export function assertConfirmMatchesFrozenIntent(args: {
  frozen: FrozenSwapReviewIntent;
  order: SwapOrderResponse;
  quoteDigest: string;
  paySymbol: string;
  receiveSymbol: string;
  generation: number;
  gate: QuoteGenerationGate;
  request: SwapReviewRequest;
  /** Optional sync cell — must still be true before step-up/sign. */
  confirmValid?: ConfirmValidCell;
  outputTokenFacts?: TokenFactsResponse | null;
  inputTokenFacts?: TokenFactsResponse | null;
  cluster?: PriceCluster;
}): SwapOrderResponse {
  const {
    frozen,
    order,
    quoteDigest,
    paySymbol,
    receiveSymbol,
    generation,
    gate,
    request,
    confirmValid,
  } = args;

  if (confirmValid && !confirmValid.current) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }

  // Current quote epoch must still match the frozen review generation.
  if (
    !gate.isCurrent(frozen.generation) ||
    frozen.generation !== generation ||
    generation <= 0
  ) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }

  // Exact current request must match the frozen review request.
  if (
    frozen.request.inputMint !== request.inputMint ||
    frozen.request.outputMint !== request.outputMint ||
    frozen.request.amount !== request.amount ||
    frozen.inputMint !== request.inputMint ||
    frozen.outputMint !== request.outputMint ||
    frozen.inAmount !== request.amount
  ) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }

  const matches =
    frozen.requestId === order.requestId &&
    frozen.quoteDigest === quoteDigest &&
    frozen.quoteDigest === order.quoteDigest &&
    frozen.inputMint === order.inputMint &&
    frozen.outputMint === order.outputMint &&
    frozen.inAmount === order.inAmount &&
    frozen.outAmount === order.outAmount &&
    frozen.otherAmountThreshold === order.otherAmountThreshold &&
    frozen.transaction === order.transaction &&
    frozen.corsoFeeBps === order.corsoFeeBps &&
    frozen.quoteFeeBps === order.quoteFeeBps &&
    frozen.platformFeeBps === order.platformFeeBps &&
    frozen.platformFeeAmount === order.platformFeeAmount &&
    frozen.networkFeeLamports === order.networkFeeLamports &&
    frozen.accountRentLamports === order.accountRentLamports &&
    frozen.positiveSlippageBps === order.positiveSlippageBps &&
    frozen.feeMint === order.feeMint &&
    frozen.feeDestination === order.feeDestination &&
    frozen.referralAccount === order.referralAccount &&
    frozen.feeDisplayName === order.feeDisplayName &&
    frozen.feeDropped === order.feeDropped &&
    frozen.router === order.router &&
    frozen.mode === order.mode &&
    frozen.priceImpactPct === order.priceImpactPct &&
    frozen.slippageBps === order.slippageBps &&
    frozen.expireAt === order.expireAt &&
    frozen.lastValidBlockHeight === order.lastValidBlockHeight &&
    frozen.instructionVersion === order.instructionVersion &&
    frozen.paySymbol === paySymbol &&
    frozen.receiveSymbol === receiveSymbol;
  if (!matches) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }
  const currentInputTokenFacts = freezeReviewedToken2022OutputFacts({facts:args.inputTokenFacts,quoteDigest});
  if (!reviewedOutputTokenFactsSnapshotsEqual(frozen.reviewedInputTokenFacts ?? null,currentInputTokenFacts) ||
      (frozen.reviewedInputTokenFacts != null && (frozen.reviewedInputTokenFacts.cluster !== args.cluster || !isReviewedOutputTokenFactsFresh(frozen.reviewedInputTokenFacts,Date.now())))) {
    throw new SwapApiError('swap_quote_mismatch','Token facts changed since review. Go back and review again.');
  }
  const currentOutputTokenFacts = freezeReviewedToken2022OutputFacts({
    facts: args.outputTokenFacts,
    quoteDigest,
  });
  const hasTokenFactsAuthority =
    frozen.reviewedOutputTokenFacts !== null ||
    args.outputTokenFacts !== undefined ||
    args.cluster !== undefined;
  if (
    hasTokenFactsAuthority &&
    (args.cluster == null ||
      (frozen.reviewedOutputTokenFacts != null &&
        frozen.reviewedOutputTokenFacts.cluster !== args.cluster) ||
      !reviewedOutputTokenFactsSnapshotsEqual(
        frozen.reviewedOutputTokenFacts,
        currentOutputTokenFacts,
      ) ||
      (frozen.reviewedOutputTokenFacts != null &&
        !isReviewedOutputTokenFactsFresh(
          frozen.reviewedOutputTokenFacts,
          Date.now(),
        )))
  ) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Token facts changed since review. Go back and review again.',
    );
  }
  const clone = cloneOrderFromFrozen(frozen);
  const recomputed = computeSwapQuoteDigest(clone);
  if (recomputed !== frozen.quoteDigest) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote binding mismatch. Try again.',
    );
  }
  return clone;
}

/**
 * Reassert the full frozen generation/request (+ confirm-valid) after an async
 * boundary or immediately before submit. Returns the frozen execute clone.
 */
export function reassertFrozenConfirmAuthority(args: {
  frozen: FrozenSwapReviewIntent;
  order: SwapOrderResponse;
  quoteDigest: string;
  paySymbol: string;
  receiveSymbol: string;
  generation: number;
  gate: QuoteGenerationGate;
  request: SwapReviewRequest;
  confirmValid: ConfirmValidCell;
  outputTokenFacts?: TokenFactsResponse | null;
  inputTokenFacts?: TokenFactsResponse | null;
  cluster?: PriceCluster;
}): SwapOrderResponse {
  return assertConfirmMatchesFrozenIntent(args);
}

/**
 * Sync live check for frozen generation/request (+ confirm-valid).
 * Used before materialization and after every acquisition await.
 */
export function assertFrozenConfirmAuthorityLive(args: {
  confirmValid: ConfirmValidCell;
  reassert: () => void;
}): void {
  if (!args.confirmValid.current) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote changed since review. Go back and quote again.',
    );
  }
  args.reassert();
}

export async function runConfirmWithDeferredAuthorityChecks<TSigner, TResult>(args: {
  confirmValid: ConfirmValidCell;
  reassert: () => void;
  prepare: () => Promise<void>;
  getSigner: (check: () => void) => Promise<TSigner>;
  signExecute: (signer: TSigner) => Promise<TResult>;
}): Promise<TResult> {
  const check = () =>
    assertFrozenConfirmAuthorityLive({
      confirmValid: args.confirmValid,
      reassert: args.reassert,
    });

  check();
  await args.prepare();
  // Post-prepare async boundary — full frozen authority must still hold
  // before getSigner is entered for materialization.
  check();
  const signer = await args.getSigner(check);
  // Post-getSigner async boundary — reassert before any sign/execute.
  check();
  return args.signExecute(signer);
}
