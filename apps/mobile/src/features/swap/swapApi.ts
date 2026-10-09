import { SOL_MINT } from '@/src/features/swap/tokens';
/**
 * Thin-API swap client — Jupiter key stays on pulse-api.
 */
import { VersionedTransaction } from '@solana/web3.js';
import { isStablecoinToStablecoinSwap, SWAP_ORDER_KEYS_HEADER } from '@corso/swap-config';
import { Buffer } from 'buffer';
import { isReviewedCorsoFeeBps } from '@/src/features/security/corsoFeeAccount';
import { computeSwapQuoteDigest } from '@/src/features/swap/quoteDigest';

export type SwapOrderResponse = {
  requestId: string;
  transaction: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  corsoFeeBps: number;
  quoteFeeBps: number;
  feeMint: string | null;
  platformFeeBps: number;
  platformFeeAmount: string | null;
  /** Decoded message base plus rounded-up priority fee; absent/null means estimating. */
  networkFeeLamports?: string | null;
  accountRentLamports?: string | null;
  positiveSlippageBps: number;
  feeDestination: string | null;
  referralAccount: string | null;
  router: string | null;
  mode: string | null;
  priceImpactPct: string | null;
  slippageBps: number;
  expireAt: string | null;
  lastValidBlockHeight: number | null;
  quoteDigest: string;
  feeDropped: boolean;
  feeDisplayName: string;
  instructionVersion: string | null;
};

export type SwapExecuteResponse = {
  status: 'Success';
  signature: string;
  totalInputAmount: string | null;
  totalOutputAmount: string | null;
};

export class SwapApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SwapApiError';
    this.code = code;
  }
}

/**
 * The swap was submitted to the network but Corso could not prove whether it
 * landed. This is NOT a failure and must never be presented as one — the user
 * gets the signature and is told to check before swapping again. Telling them
 * "failed" here is how someone pays twice.
 */
export class SwapLandUncertainError extends SwapApiError {
  readonly signature: string | null;

  constructor(message: string, signature: string | null) {
    super('swap_land_uncertain', message);
    this.name = 'SwapLandUncertainError';
    this.signature = signature;
  }
}

/** Metis landing result. `landed` means confirmed on-chain, nothing weaker. */
export type SwapLandResponse = {
  outcome: 'landed';
  signature: string;
  confirmationStatus: 'confirmed' | 'finalized';
  slot: number | null;
};

export function swapApiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

/** Bearer header shared with the holdings-cap routes. A thrown or padded token is omitted. */
export async function swapBearerAuthorization(
  getAccessToken?: () => Promise<string | null>,
): Promise<string | null> {
  let token: string | null = null;
  try {
    token = (await getAccessToken?.()) ?? null;
  } catch {
    token = null;
  }
  if (!token || token.trim() !== token) return null;
  return `Bearer ${token}`;
}

async function readError(response: Response): Promise<SwapApiError> {
  try {
    const body = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    } | null;
    const capRefusal = body?.error === 'sleeve_cap_unknown' ||
      body?.error === 'sleeve_cap_exceeded' ||
      body?.error === 'sleeve_book_unreadable' ||
      body?.error === 'swap_owner_mismatch';
    return new SwapApiError(
      typeof body?.error === 'string' ? body.error : `http_${response.status}`,
      !capRefusal && typeof body?.message === 'string' ? body.message : "Couldn't complete swap request.",
    );
  } catch {
    return new SwapApiError(
      `http_${response.status}`,
      "Couldn't complete swap request.",
    );
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isDigitString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

function isBps(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10_000;
}

const CANONICAL_BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Solana packet / serialized tx hard limit (bytes). */
export const SOLANA_MAX_TX_BYTES = 1232;
export const TRANSACTION_V1_PREFIX = 0x81;
/** Base64 length bound for max Solana tx (ceil(1232/3)*4). */
const SOLANA_MAX_TX_BASE64_CHARS = Math.ceil(SOLANA_MAX_TX_BYTES / 3) * 4;
const MIN_TX_BYTES = 16;
const MAX_REQUEST_ID_LEN = 128;
const MAX_FEE_DISPLAY_NAME_LEN = 64;
const MAX_MODE_LEN = 32;
const MAX_EXPIRE_AT_LEN = 64;
const MAX_MINT_LEN = 64;
const MAX_DIGIT_AMOUNT_LEN = 40;

/** Exact response schema — every base key required; cost fields are optional for legacy API compatibility. */
const SWAP_ORDER_REQUIRED_KEYS = [
  'requestId',
  'transaction',
  'inputMint',
  'outputMint',
  'inAmount',
  'outAmount',
  'otherAmountThreshold',
  'corsoFeeBps',
  'quoteFeeBps',
  'feeMint',
  'platformFeeBps',
  'platformFeeAmount',
  'positiveSlippageBps',
  'feeDestination',
  'referralAccount',
  'router',
  'mode',
  'priceImpactPct',
  'slippageBps',
  'expireAt',
  'lastValidBlockHeight',
  'quoteDigest',
  'feeDropped',
  'feeDisplayName',
  'instructionVersion',
] as const;
/**
 * Optional keys this build understands. Sent to the API as the
 * SWAP_ORDER_KEYS_HEADER declaration, so the server emits and digests exactly
 * these — `computeSwapQuoteDigest` binds the same set. Adding a key here
 * means adding it to the digest too.
 */
const SWAP_ORDER_OPTIONAL_KEYS = ['networkFeeLamports', 'accountRentLamports'] as const;

function assertValidTransactionBase64(transaction: string): void {
  if (typeof transaction !== 'string' || transaction.length === 0) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (transaction.length > SOLANA_MAX_TX_BASE64_CHARS) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  // Reject whitespace, prefix/suffix junk, non-alphabet, bad padding shape.
  if (
    /[\s]/.test(transaction) ||
    !CANONICAL_BASE64_RE.test(transaction) ||
    transaction.length % 4 !== 0 ||
    /===/.test(transaction) ||
    /=+[^=]+/.test(transaction)
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(transaction, 'base64');
  } catch {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (bytes.length < MIN_TX_BYTES || bytes.length > SOLANA_MAX_TX_BYTES) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (bytes.toString('base64') !== transaction) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  // Prefix gate runs before the deserializer; see TRANSACTION_V1_PREFIX.
  if (bytes[0] === TRANSACTION_V1_PREFIX) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  let decoded: VersionedTransaction;
  try {
    decoded = VersionedTransaction.deserialize(bytes);
  } catch {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  // Reserialize and require exact byte-for-byte equality — trailing decoded
  // bytes or malleable alternate representations fail closed.
  // Quote txs are unsigned at parse time; do not require signatures here.
  // web3.js VersionedTransaction.serialize typings omit options — cast like submitSwap.
  let reserialized: Buffer;
  try {
    const serialize = decoded.serialize.bind(decoded) as (opts?: {
      requireAllSignatures?: boolean;
      verifySignatures?: boolean;
    }) => Uint8Array;
    reserialized = Buffer.from(
      serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }),
    );
  } catch {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (
    reserialized.length !== bytes.length ||
    !reserialized.equals(bytes)
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
}

function assertBoundedString(
  value: unknown,
  maxLen: number,
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
}

function assertPositiveDigitAmount(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^\d+$/.test(value) ||
    value.length > MAX_DIGIT_AMOUNT_LEN ||
    /^0+$/.test(value)
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
}

/**
 * priceImpactPct: null or bounded decimal string (no scientific notation).
 * Jupiter emits full decimal precision for thin-liquidity tokens; preserving
 * those bytes is required because the value is quote-digest-bound.
 */
function assertPriceImpactPct(
  value: unknown,
): asserts value is string | null {
  if (value === null) return;
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (!/^-?(?:0|[1-9]\d{0,2})(?:\.\d{1,60})?$/.test(value)) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < -100 || n > 100) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
}

function assertSafeBlockHeight(
  value: unknown,
): asserts value is number | null {
  if (value === null) return;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
}

function assertCompleteSchema(body: Record<string, unknown>): void {
  for (const required of SWAP_ORDER_REQUIRED_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, required)) {
      throw new SwapApiError(
        'swap_quote_invalid',
        'Quote was incomplete. Try again.',
      );
    }
  }
}

/** Router metadata: null or short token-like id; reject URI/script-like values. */
const ROUTER_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function assertRouterShape(router: unknown): asserts router is string | null {
  if (router === null) return;
  if (typeof router !== 'string' || router.length === 0) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (!ROUTER_TOKEN_RE.test(router)) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  const lower = router.toLowerCase();
  if (
    lower.includes('://') ||
    lower.includes('<') ||
    lower.includes('>') ||
    lower.includes('javascript:') ||
    lower.startsWith('data:') ||
    lower.includes('<script')
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
}

/**
 * Parse the complete swap-order API body from unknown with strict validation of
 * every consumed field, fee consistency, fee display metadata, router shape,
 * and valid transaction bytes. Request-bound mint/amount equality is required.
 */
export function parseSwapOrderResponse(
  raw: unknown,
  request: {
    inputMint: string;
    outputMint: string;
    amount: string;
  },
): SwapOrderResponse {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  const body = raw as Record<string, unknown>;
  assertCompleteSchema(body);

  assertBoundedString(body.requestId, MAX_REQUEST_ID_LEN);
  if (!isNonEmptyString(body.transaction)) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  assertValidTransactionBase64(body.transaction);

  assertBoundedString(body.inputMint, MAX_MINT_LEN);
  assertBoundedString(body.outputMint, MAX_MINT_LEN);
  // inAmount may be zero only if request allows; out/min-out must be positive.
  if (
    !isDigitString(body.inAmount) ||
    (body.inAmount as string).length > MAX_DIGIT_AMOUNT_LEN
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  assertPositiveDigitAmount(body.outAmount);
  assertPositiveDigitAmount(body.otherAmountThreshold);

  if (
    !isBps(body.corsoFeeBps) ||
    !isBps(body.quoteFeeBps) ||
    !isBps(body.platformFeeBps) ||
    !isBps(body.positiveSlippageBps) ||
    !isBps(body.slippageBps)
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  if (typeof body.feeDropped !== 'boolean') {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  assertBoundedString(body.feeDisplayName, MAX_FEE_DISPLAY_NAME_LEN);

  // instructionVersion: explicit null, or the exact pinned literal. No other
  // string is accepted — an unknown value must never reach the signing gate
  // and be compared loosely there.
  if (body.instructionVersion !== null && body.instructionVersion !== 'V1' && body.instructionVersion !== 'V2') {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  if (
    !isNonEmptyString(body.quoteDigest) ||
    !/^[0-9a-f]{64}$/i.test(body.quoteDigest)
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  if (body.feeMint != null) assertBoundedString(body.feeMint, MAX_MINT_LEN);
  else if (body.feeMint !== null) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (body.feeDestination != null) {
    assertBoundedString(body.feeDestination, MAX_MINT_LEN);
  } else if (body.feeDestination !== null) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (body.referralAccount != null) {
    assertBoundedString(body.referralAccount, MAX_MINT_LEN);
  } else if (body.referralAccount !== null) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  if (body.mode != null) assertBoundedString(body.mode, MAX_MODE_LEN);
  else if (body.mode !== null) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }
  assertPriceImpactPct(body.priceImpactPct);
  if (body.expireAt != null) assertBoundedString(body.expireAt, MAX_EXPIRE_AT_LEN);
  else if (body.expireAt !== null) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  // platformFeeAmount is a required schema key: null or digit string (never omitted).
  if (body.platformFeeAmount === null) {
    // ok — explicit null
  } else if (
    !isDigitString(body.platformFeeAmount) ||
    (body.platformFeeAmount as string).length > MAX_DIGIT_AMOUNT_LEN
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  // Full decoded message fee: omission/null means estimating, never free.
  const networkFeePresent = Object.prototype.hasOwnProperty.call(
    body,
    'networkFeeLamports',
  );
  if (!networkFeePresent || body.networkFeeLamports === null) {
    // ok — wire omission stays omitted; a newer API may normalize it to null
  } else if (
    !isDigitString(body.networkFeeLamports) ||
    (body.networkFeeLamports as string).length > MAX_DIGIT_AMOUNT_LEN
  ) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote was incomplete. Try again.',
    );
  }

  const accountRentPresent = Object.prototype.hasOwnProperty.call(body, 'accountRentLamports');
  if (accountRentPresent && body.accountRentLamports !== null &&
      (!isDigitString(body.accountRentLamports) || (body.accountRentLamports as string).length > MAX_DIGIT_AMOUNT_LEN)) {
    throw new SwapApiError('swap_quote_invalid', 'Quote account cost was invalid. Try again.');
  }

  assertSafeBlockHeight(body.lastValidBlockHeight);

  assertRouterShape(body.router);

  // Request-bound equality: never review/sign a quote that contradicts the
  // mints/amount the user (and digest) intended.
  if (
    body.inputMint !== request.inputMint ||
    body.outputMint !== request.outputMint ||
    body.inAmount !== request.amount
  ) {
    throw new SwapApiError(
      'swap_quote_mismatch',
      'Quote did not match the requested swap. Try again.',
    );
  }

  if (body.feeDropped) {
    throw new SwapApiError(
      'swap_fee_dropped',
      'Corso fee could not be verified on this quote. Try again later.',
    );
  }

  // Fee consistency: consumed fee fields must agree (mirrors API normalize).
  // Two admissible shapes, and only two:
  //   (a) Corso outer TransferChecked — platformFeeBps === 0 (Jupiter carries no
  //       fee) and the quote names a feeMint + feeDestination + amount. The
  //       signing gate then requires a fully-bound outer fee transfer.
  //   (b) legacy Jupiter-internal — platformFeeBps === corsoFeeBps. The signing
  //       gate refuses any nonzero value of this shape, unchanged.
  // Anything else is an inconsistent fee posture and fails closed here.
  if (body.quoteFeeBps !== body.corsoFeeBps) {
    throw new SwapApiError(
      'swap_fee_dropped',
      'Corso fee could not be verified on this quote. Try again later.',
    );
  }
  const isOuterFeeShape =
    body.platformFeeBps === 0 && (body.corsoFeeBps as number) > 0;
  if (!isOuterFeeShape && body.platformFeeBps !== body.corsoFeeBps) {
    throw new SwapApiError(
      'swap_fee_dropped',
      'Corso fee could not be verified on this quote. Try again later.',
    );
  }
  if (body.instructionVersion === 'V1') {
    const feeExemptPair = isStablecoinToStablecoinSwap({
      inputMint: body.inputMint as string,
      outputMint: body.outputMint as string,
    });
    const expectedFeeBps = feeExemptPair ? 0 : body.corsoFeeBps;
    const feeShapeMatches =
      (feeExemptPair || isReviewedCorsoFeeBps(expectedFeeBps)) &&
      body.corsoFeeBps === expectedFeeBps &&
      body.quoteFeeBps === expectedFeeBps &&
      body.platformFeeBps === expectedFeeBps &&
      (expectedFeeBps === 0
        ? body.feeMint === null &&
          body.feeDestination === null &&
          body.platformFeeAmount === null
        : Boolean(body.feeMint) &&
          Boolean(body.feeDestination) &&
          typeof body.platformFeeAmount === 'string' &&
          !/^0+$/.test(body.platformFeeAmount));
    if (!feeShapeMatches) {
      throw new SwapApiError(
        'swap_fee_dropped',
        'Corso fee could not be verified on this quote. Try again later.',
      );
    }
  }
  if (body.instructionVersion === 'V2') {
    const buyFee = body.platformFeeBps === 0;
    if (!isReviewedCorsoFeeBps(body.corsoFeeBps) || body.quoteFeeBps !== body.corsoFeeBps || !body.feeDestination ||
        body.positiveSlippageBps !== 0 ||
        (buyFee ? body.inputMint !== SOL_MINT || body.feeMint !== SOL_MINT || body.platformFeeAmount !== (BigInt(body.inAmount as string)*BigInt(body.corsoFeeBps as number)/10000n).toString() : body.platformFeeBps !== body.corsoFeeBps || body.feeMint !== body.outputMint)) {
      throw new SwapApiError('swap_fee_dropped','Corso fee could not be verified on this quote. Try again later.');
    }
  }
  if (isOuterFeeShape && !body.feeDestination) {
    throw new SwapApiError(
      'swap_fee_dropped',
      'Corso fee could not be verified on this quote. Try again later.',
    );
  }
  // Required platformFeeAmount semantics: positive fee bps ⇒ fee mint + amount.
  if (
    (body.corsoFeeBps as number) > 0 ||
    (body.quoteFeeBps as number) > 0 ||
    (body.platformFeeBps as number) > 0
  ) {
    if (!body.feeMint || body.platformFeeAmount == null) {
      throw new SwapApiError(
        'swap_quote_invalid',
        'Quote was incomplete. Try again.',
      );
    }
    if (
      !isDigitString(body.platformFeeAmount) ||
      /^0+$/.test(body.platformFeeAmount as string)
    ) {
      throw new SwapApiError(
        'swap_quote_invalid',
        'Quote was incomplete. Try again.',
      );
    }
  }

  const parsed: SwapOrderResponse = {
    requestId: body.requestId as string,
    transaction: body.transaction as string,
    inputMint: request.inputMint,
    outputMint: request.outputMint,
    inAmount: request.amount,
    outAmount: body.outAmount as string,
    otherAmountThreshold: body.otherAmountThreshold as string,
    corsoFeeBps: body.corsoFeeBps as number,
    quoteFeeBps: body.quoteFeeBps as number,
    feeMint: body.feeMint as string | null,
    platformFeeBps: body.platformFeeBps as number,
    platformFeeAmount:
      body.platformFeeAmount == null
        ? null
        : (body.platformFeeAmount as string),
    ...(networkFeePresent
      ? { networkFeeLamports: body.networkFeeLamports as string | null }
      : {}),
    ...(accountRentPresent ? { accountRentLamports: body.accountRentLamports as string | null } : {}),
    positiveSlippageBps: body.positiveSlippageBps as number,
    feeDestination: body.feeDestination as string | null,
    referralAccount: body.referralAccount as string | null,
    router: body.router as string | null,
    mode: body.mode as string | null,
    priceImpactPct: body.priceImpactPct as string | null,
    slippageBps: body.slippageBps as number,
    expireAt: body.expireAt as string | null,
    lastValidBlockHeight:
      body.lastValidBlockHeight == null
        ? null
        : (body.lastValidBlockHeight as number),
    quoteDigest: (body.quoteDigest as string).toLowerCase(),
    feeDropped: false,
    feeDisplayName: body.feeDisplayName as string,
    instructionVersion: body.instructionVersion as string | null,
  };

  // Recompute + compare digest inside the parser (retain downstream defense too).
  const recomputed = computeSwapQuoteDigest(parsed);
  if (recomputed !== parsed.quoteDigest) {
    throw new SwapApiError(
      'swap_quote_invalid',
      'Quote binding mismatch. Try again.',
    );
  }

  return parsed;
}

export async function requestSwapOrder(args: {
  inputMint: string;
  outputMint: string;
  amount: string;
  taker: string;
  /**
   * Corso fee ATA for the output mint, derived OFFLINE from pinned config.
   * Omitted when no fee authority is configured on this build — the API then
   * refuses to issue a Metis quote rather than quoting an uncollectable fee.
   */
  feeAccount?: string | null;
  /** Existing usePrivy().getAccessToken, as used by holdings. Header only. */
  getAccessToken?: () => Promise<string | null>;
  /** Optional AbortSignal so superseded quote requests cannot settle into UI. */
  signal?: AbortSignal;
}): Promise<SwapOrderResponse> {
  const base = swapApiBaseUrl();
  if (!base) {
    throw new SwapApiError(
      'api_unconfigured',
      'Swap API URL is not configured on this build.',
    );
  }

  // Preserve non-Privy/expired-session compatibility. The server cap refuses
  // sleeve buys without verified identity; do not log credential errors.
  const authorization = await swapBearerAuthorization(args.getAccessToken);
  const response = await fetch(`${base}/v1/swap/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [SWAP_ORDER_KEYS_HEADER]: SWAP_ORDER_OPTIONAL_KEYS.join(','),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      inputMint: args.inputMint,
      outputMint: args.outputMint,
      amount: args.amount,
      taker: args.taker,
      ...(args.feeAccount ? { feeAccount: args.feeAccount } : {}),
    }),
    signal: args.signal,
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body: unknown = await response.json();
  return parseSwapOrderResponse(body, {
    inputMint: args.inputMint,
    outputMint: args.outputMint,
    amount: args.amount,
  });
}

export async function executeSwapOrder(args: {
  requestId: string;
  signedTransaction: string;
  quoteDigest: string;
  lastValidBlockHeight?: number | null;
}): Promise<SwapExecuteResponse> {
  const base = swapApiBaseUrl();
  if (!base) {
    throw new SwapApiError(
      'api_unconfigured',
      'Swap API URL is not configured on this build.',
    );
  }

  const payload: Record<string, unknown> = {
    requestId: args.requestId,
    signedTransaction: args.signedTransaction,
    quoteDigest: args.quoteDigest,
  };
  if (args.lastValidBlockHeight != null) {
    payload.lastValidBlockHeight = args.lastValidBlockHeight;
  }

  const response = await fetch(`${base}/v1/swap/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as SwapExecuteResponse;
  if (body.status !== 'Success' || !body.signature) {
    throw new SwapApiError('swap_failed', 'Swap failed to confirm.');
  }
  return body;
}

const UNCERTAIN_FALLBACK_MESSAGE =
  'Your swap was sent but Corso could not confirm it in time. It MAY have completed. Check Activity or an explorer before swapping again.';

export async function landSwapTransaction(args: {
  requestId: string;
  signedTransaction: string;
  quoteDigest: string;
}): Promise<SwapLandResponse> {
  const base = swapApiBaseUrl();
  if (!base) {
    throw new SwapApiError(
      'api_unconfigured',
      'Swap API URL is not configured on this build.',
    );
  }

  const response = await fetch(`${base}/v1/swap/land`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: args.requestId,
      signedTransaction: args.signedTransaction,
      quoteDigest: args.quoteDigest,
    }),
  });

  // 202 = submitted, unproven. Read it BEFORE the !ok branch so it can never be
  // flattened into a generic error.
  if (response.status === 202) {
    let body: { signature?: unknown; message?: unknown } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      /* keep the honest fallback message */
    }
    throw new SwapLandUncertainError(
      typeof body.message === 'string' && body.message.length > 0
        ? body.message
        : UNCERTAIN_FALLBACK_MESSAGE,
      typeof body.signature === 'string' && body.signature.length > 0
        ? body.signature
        : null,
    );
  }

  if (!response.ok) {
    throw await readError(response);
  }

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // A 200 we cannot read is not proof of failure either.
    throw new SwapLandUncertainError(UNCERTAIN_FALLBACK_MESSAGE, null);
  }

  const confirmationStatus = body.confirmationStatus;
  if (
    body.outcome !== 'landed' ||
    typeof body.signature !== 'string' ||
    body.signature.length === 0 ||
    (confirmationStatus !== 'confirmed' && confirmationStatus !== 'finalized')
  ) {
    // Never upgrade an unrecognised 200 into success.
    throw new SwapLandUncertainError(
      UNCERTAIN_FALLBACK_MESSAGE,
      typeof body.signature === 'string' && body.signature.length > 0
        ? body.signature
        : null,
    );
  }

  return {
    outcome: 'landed',
    signature: body.signature,
    confirmationStatus,
    slot: typeof body.slot === 'number' ? body.slot : null,
  };
}
