/**
 * Pure, provider-independent fiat-total valuation.
 * No I/O, no env, no network — holdings + quotes in, honesty status out.
 * Unknown / stale / bad quotes never become a zero-dollar total.
 */
import { SOL_MINT, usdcMintForCluster } from '@/src/features/swap/tokens';
import { USDC_DECIMALS, isBoundedUsdcMint } from './usdcConstants';

export const SOL_DECIMALS = 9;
/** USD display scale (cents). */
export const FIAT_DECIMALS = 2;

export type FiatCurrency = 'USD';

export type HoldingLine = {
  mint: string;
  symbol: string;
  /** Atomic units as decimal string (bigint-safe). SOL = lamports. */
  atomic: string;
  /** Native lamports only when the valuation line also includes wrapped SOL. */
  nativeAtomic?: string;
  decimals: number;
  /** When false, line is excluded from Home total (e.g. Autopilot pot). */
  includeInHomeTotal: boolean;
  /** Arbitrary held tokens require fresh verified liquid facts before valuation. */
  valuationEligible?: boolean;
};

export type HoldingsSnapshot = {
  /** Display-home (or pot) address — opaque to pricing math. */
  address: string;
  cluster: 'devnet' | 'mainnet-beta' | null;
  asOfMs: number;
  lines: HoldingLine[];
  quantityStatus: 'ready' | 'loading' | 'error' | 'partial';
  /**
   * Optional scope label passed as data (Home vs pot surface).
   * Exclusion is enforced via `includeInHomeTotal`; this is metadata only.
   */
  scope?: 'home' | 'pot' | 'all';
};

export type PriceQuote = {
  mint: string;
  currency: FiatCurrency;
  /** Human units of currency per 1 whole token (decimal string, not float). */
  price: string;
  asOfMs: number;
  source: string;
  /** Max age consumer may accept; pure layer only compares timestamps. */
  maxAgeMs: number;
};

export type PriceQuoteMap = Record<string, PriceQuote | null | undefined>;

export type FiatMethodology =
  | 'unavailable'
  | 'spot'
  | 'usdc_peg_assumed'
  | 'mixed';

export type FiatTotalStatus =
  | 'loading'
  | 'zero'
  | 'fully_priced'
  | 'partially_priced'
  | 'unavailable';

export type FiatLineReason =
  | 'no_quote'
  | 'stale_quote'
  | 'bad_quote'
  | 'excluded'
  | 'zero'
  | 'malformed_amount'
  | 'wrong_decimals'
  | 'mint_mismatch'
  | 'valuation_unverified';

export type FiatLineResult = {
  mint: string;
  symbol: string;
  /** Fiat amount as decimal string (FIAT_DECIMALS), or null if unpriced. */
  fiatAmount: string | null;
  priced: boolean;
  reason?: FiatLineReason;
};

export type FiatTotalResult = {
  status: FiatTotalStatus;
  currency: FiatCurrency;
  /** Null when not safe to show a single hero number under policy. */
  totalFiat: string | null;
  lines: FiatLineResult[];
  methodology: FiatMethodology;
  pricedMintCount: number;
  unpricedMintCount: number;
  asOfMs: number | null;
  sources: string[];
  scope: 'home' | 'pot' | 'all';
};

export type ComputeFiatTotalArgs = {
  holdings: HoldingsSnapshot;
  quotes: PriceQuoteMap;
  nowMs: number;
  currency?: FiatCurrency;
  /**
   * Explicit input policy (not an immutable product lock).
   * When true, bounded native USDC may use $1.00 without an external quote.
   */
  assumeUsdcPeg?: boolean;
  /** If false, partial totals never populate totalFiat (stricter hero honesty). */
  allowPartialTotal?: boolean;
};

type ParsedPrice = {
  /** price * 10^scale as bigint numerator. */
  numerator: bigint;
  scale: number;
};

type LineEval = {
  result: FiatLineResult;
  /** Fiat minor units (10^FIAT_DECIMALS), only when priced. */
  fiatMinor: bigint | null;
  source: string | null;
  quoteAsOfMs: number | null;
  usedPeg: boolean;
  usedSpot: boolean;
  included: boolean;
  fatalShape: boolean;
};

export function computeFiatTotal(args: ComputeFiatTotalArgs): FiatTotalResult {
  const currency: FiatCurrency = args.currency ?? 'USD';
  const assumeUsdcPeg = args.assumeUsdcPeg ?? true;
  const allowPartialTotal = args.allowPartialTotal ?? false;
  const scope = args.holdings.scope ?? 'home';
  const empty = (status: FiatTotalStatus): FiatTotalResult => ({
    status,
    currency,
    totalFiat: null,
    lines: [],
    methodology: 'unavailable',
    pricedMintCount: 0,
    unpricedMintCount: 0,
    asOfMs: null,
    sources: [],
    scope,
  });

  if (args.holdings.quantityStatus === 'loading') {
    return empty('loading');
  }
  if (
    args.holdings.quantityStatus === 'error' ||
    args.holdings.quantityStatus === 'partial'
  ) {
    return empty('unavailable');
  }

  const evals: LineEval[] = args.holdings.lines.map((line) =>
    evaluateLine({
      line,
      cluster: args.holdings.cluster,
      quotes: args.quotes,
      nowMs: args.nowMs,
      currency,
      assumeUsdcPeg,
    }),
  );

  const lines = evals.map((e) => e.result);

  // Any included line with corrupt shape fails the whole book closed.
  if (evals.some((e) => e.included && e.fatalShape)) {
    return {
      status: 'unavailable',
      currency,
      totalFiat: null,
      lines,
      methodology: 'unavailable',
      pricedMintCount: 0,
      unpricedMintCount: evals.filter((e) => e.included).length,
      asOfMs: null,
      sources: [],
      scope,
    };
  }

  const included = evals.filter((e) => e.included);
  const priced = included.filter((e) => e.result.priced);
  const unpriced = included.filter((e) => !e.result.priced);

  const pricedMintCount = priced.length;
  const unpricedMintCount = unpriced.length;

  const sources = uniqueSources(priced);
  const methodology = deriveMethodology(priced);
  const asOfMs = deriveAsOfMs(priced, args.holdings.asOfMs);

  // Known-zero book: every included line is valid zero (or no included lines).
  const allZero =
    included.length === 0 ||
    included.every(
      (e) => e.result.priced && e.result.reason === 'zero' && e.fiatMinor === 0n,
    );

  if (allZero && unpricedMintCount === 0) {
    return {
      status: 'zero',
      currency,
      totalFiat: formatFiatMinor(0n),
      lines,
      methodology: methodology === 'unavailable' ? 'spot' : methodology,
      pricedMintCount,
      unpricedMintCount: 0,
      asOfMs: args.holdings.asOfMs,
      sources,
      scope,
    };
  }

  if (pricedMintCount === 0) {
    return {
      status: 'unavailable',
      currency,
      totalFiat: null,
      lines,
      methodology: 'unavailable',
      pricedMintCount: 0,
      unpricedMintCount,
      asOfMs: null,
      sources: [],
      scope,
    };
  }

  if (unpricedMintCount > 0) {
    const meaningfullyPriced = priced.filter((e) => e.result.reason !== 'zero');
    if (meaningfullyPriced.length === 0) {
      return {
        status: 'unavailable',
        currency,
        totalFiat: null,
        lines,
        methodology: 'unavailable',
        pricedMintCount,
        unpricedMintCount,
        asOfMs: null,
        sources: [],
        scope,
      };
    }

    const totalFiat = allowPartialTotal
      ? formatFiatMinor(sumFiatMinor(meaningfullyPriced))
      : null;
    return {
      status: 'partially_priced',
      currency,
      totalFiat,
      lines,
      methodology: deriveMethodology(meaningfullyPriced),
      pricedMintCount,
      unpricedMintCount,
      asOfMs: deriveAsOfMs(meaningfullyPriced, args.holdings.asOfMs),
      sources: uniqueSources(meaningfullyPriced),
      scope,
    };
  }

  return {
    status: 'fully_priced',
    currency,
    totalFiat: formatFiatMinor(sumFiatMinor(priced)),
    lines,
    methodology,
    pricedMintCount,
    unpricedMintCount: 0,
    asOfMs,
    sources,
    scope,
  };
}

function evaluateLine(args: {
  line: HoldingLine;
  cluster: HoldingsSnapshot['cluster'];
  quotes: PriceQuoteMap;
  nowMs: number;
  currency: FiatCurrency;
  assumeUsdcPeg: boolean;
}): LineEval {
  const { line } = args;
  const base: Omit<FiatLineResult, 'fiatAmount' | 'priced' | 'reason'> = {
    mint: line.mint,
    symbol: line.symbol,
  };

  if (!line.includeInHomeTotal) {
    return {
      result: { ...base, fiatAmount: null, priced: false, reason: 'excluded' },
      fiatMinor: null,
      source: null,
      quoteAsOfMs: null,
      usedPeg: false,
      usedSpot: false,
      included: false,
      fatalShape: false,
    };
  }

  const expectedDecimals =
    line.symbol === 'SOL' ? SOL_DECIMALS : line.symbol === 'USDC' ? USDC_DECIMALS : line.decimals;
  if (!Number.isInteger(line.decimals) || line.decimals < 0 || line.decimals > 18 || line.decimals !== expectedDecimals) {
    return fatal(base, 'wrong_decimals');
  }

  if (line.symbol === 'SOL') {
    if (line.mint !== SOL_MINT) {
      return fatal(base, 'mint_mismatch');
    }
  } else if (line.symbol === 'USDC') {
    if (args.cluster === null) {
      return fatal(base, 'mint_mismatch');
    }
    const expectedMint = usdcMintForCluster(args.cluster);
    if (line.mint !== expectedMint || !isBoundedUsdcMint(line.mint)) {
      return fatal(base, 'mint_mismatch');
    }
  }

  const atomic = parseAtomicAmount(line.atomic);
  if (atomic === null) {
    return fatal(base, 'malformed_amount');
  }

  if (atomic === 0n) {
    return {
      result: {
        ...base,
        fiatAmount: formatFiatMinor(0n),
        priced: true,
        reason: 'zero',
      },
      fiatMinor: 0n,
      source: null,
      quoteAsOfMs: null,
      usedPeg: false,
      usedSpot: false,
      included: true,
      fatalShape: false,
    };
  }

  // Explicit USDC peg policy (caller-controlled).
  if (
    line.symbol === 'USDC' &&
    args.assumeUsdcPeg &&
    isBoundedUsdcMint(line.mint)
  ) {
    const fiatMinor = atomicToFiatMinor(atomic, line.decimals, {
      numerator: 1n,
      scale: 0,
    });
    if (fiatMinor === null) {
      return {
        result: {
          ...base,
          fiatAmount: null,
          priced: false,
          reason: 'bad_quote',
        },
        fiatMinor: null,
        source: null,
        quoteAsOfMs: null,
        usedPeg: false,
        usedSpot: false,
        included: true,
        fatalShape: false,
      };
    }
    return {
      result: {
        ...base,
        fiatAmount: formatFiatMinor(fiatMinor),
        priced: true,
      },
      fiatMinor,
      source: 'usdc_peg',
      quoteAsOfMs: args.nowMs,
      usedPeg: true,
      usedSpot: false,
      included: true,
      fatalShape: false,
    };
  }

  if (line.symbol !== 'SOL' && line.symbol !== 'USDC' && line.valuationEligible !== true) {
    return { result: { ...base, fiatAmount: null, priced: false, reason: 'valuation_unverified' }, fiatMinor: null, source: null, quoteAsOfMs: null, usedPeg: false, usedSpot: false, included: true, fatalShape: false };
  }

  const rawQuote = args.quotes[line.mint];
  if (rawQuote === null || rawQuote === undefined) {
    return {
      result: { ...base, fiatAmount: null, priced: false, reason: 'no_quote' },
      fiatMinor: null,
      source: null,
      quoteAsOfMs: null,
      usedPeg: false,
      usedSpot: false,
      included: true,
      fatalShape: false,
    };
  }

  const quoteCheck = validateQuote(rawQuote, line.mint, args.currency, args.nowMs);
  if (quoteCheck !== 'ok') {
    return {
      result: {
        ...base,
        fiatAmount: null,
        priced: false,
        reason: quoteCheck,
      },
      fiatMinor: null,
      source: null,
      quoteAsOfMs: null,
      usedPeg: false,
      usedSpot: false,
      included: true,
      fatalShape: false,
    };
  }

  const parsed = parseDecimalPrice(rawQuote.price);
  if (!parsed) {
    return {
      result: {
        ...base,
        fiatAmount: null,
        priced: false,
        reason: 'bad_quote',
      },
      fiatMinor: null,
      source: null,
      quoteAsOfMs: null,
      usedPeg: false,
      usedSpot: false,
      included: true,
      fatalShape: false,
    };
  }

  const fiatMinor = atomicToFiatMinor(atomic, line.decimals, parsed);
  if (fiatMinor === null) {
    return {
      result: {
        ...base,
        fiatAmount: null,
        priced: false,
        reason: 'bad_quote',
      },
      fiatMinor: null,
      source: null,
      quoteAsOfMs: null,
      usedPeg: false,
      usedSpot: false,
      included: true,
      fatalShape: false,
    };
  }

  return {
    result: {
      ...base,
      fiatAmount: formatFiatMinor(fiatMinor),
      priced: true,
    },
    fiatMinor,
    source: rawQuote.source,
    quoteAsOfMs: rawQuote.asOfMs,
    usedPeg: false,
    usedSpot: true,
    included: true,
    fatalShape: false,
  };
}

function fatal(
  base: Omit<FiatLineResult, 'fiatAmount' | 'priced' | 'reason'>,
  reason: FiatLineReason,
): LineEval {
  return {
    result: { ...base, fiatAmount: null, priced: false, reason },
    fiatMinor: null,
    source: null,
    quoteAsOfMs: null,
    usedPeg: false,
    usedSpot: false,
    included: true,
    fatalShape: true,
  };
}

function validateQuote(
  quote: PriceQuote,
  mint: string,
  currency: FiatCurrency,
  nowMs: number,
): 'ok' | 'bad_quote' | 'stale_quote' {
  if (!quote || typeof quote !== 'object') return 'bad_quote';
  if (quote.mint !== mint) return 'bad_quote';
  if (quote.currency !== currency) return 'bad_quote';
  if (typeof quote.source !== 'string' || quote.source.length === 0) {
    return 'bad_quote';
  }
  if (
    typeof quote.asOfMs !== 'number' ||
    !Number.isFinite(quote.asOfMs) ||
    quote.asOfMs < 0
  ) {
    return 'bad_quote';
  }
  if (
    typeof quote.maxAgeMs !== 'number' ||
    !Number.isFinite(quote.maxAgeMs) ||
    quote.maxAgeMs < 0
  ) {
    return 'bad_quote';
  }
  if (typeof quote.price !== 'string') return 'bad_quote';
  if (!parseDecimalPrice(quote.price)) return 'bad_quote';

  const age = nowMs - quote.asOfMs;
  // Reject only when older than maxAgeMs (boundary inclusive). Slightly-future
  // asOfMs is tolerated as clock skew — not treated as inventable price.
  if (age > quote.maxAgeMs) return 'stale_quote';

  return 'ok';
}

/** Non-negative integer atomic string → bigint; null when malformed. */
export function parseAtomicAmount(raw: string): bigint | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

/**
 * Parse a non-negative decimal price string into fixed-point parts.
 * Rejects negatives, empty, scientific notation, NaN markers, whitespace.
 */
export function parseDecimalPrice(raw: string): ParsedPrice | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const [wholePart, fracPart = ''] = raw.split('.');
  if (wholePart.length === 0) return null;
  try {
    const whole = BigInt(wholePart);
    const frac = fracPart.length === 0 ? 0n : BigInt(fracPart);
    const scale = fracPart.length;
    const numerator = whole * 10n ** BigInt(scale) + frac;
    return { numerator, scale };
  } catch {
    return null;
  }
}

/**
 * fiatMinor = round_half_up(atomic * price / 10^tokenDecimals * 10^FIAT_DECIMALS)
 * All arithmetic via bigint — never JS number for money product.
 */
export function atomicToFiatMinor(
  atomic: bigint,
  tokenDecimals: number,
  price: ParsedPrice,
): bigint | null {
  if (atomic < 0n) return null;
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 18) {
    return null;
  }
  if (price.scale < 0 || price.scale > 18) return null;
  if (price.numerator < 0n) return null;

  const tokenBase = 10n ** BigInt(tokenDecimals);
  const fiatBase = 10n ** BigInt(FIAT_DECIMALS);
  // (atomic * priceNum * 10^FIAT) / (10^tokenDecimals * 10^priceScale)
  const numerator = atomic * price.numerator * fiatBase;
  const denominator = tokenBase * 10n ** BigInt(price.scale);
  if (denominator === 0n) return null;

  // Half-up: (n + d/2) / d for non-negative n.
  return (numerator + denominator / 2n) / denominator;
}

export function formatFiatMinor(minor: bigint): string {
  if (minor < 0n) {
    // Defensive — callers should not pass negatives.
    return `-${formatFiatMinor(-minor)}`;
  }
  const base = 10n ** BigInt(FIAT_DECIMALS);
  const whole = minor / base;
  const frac = minor % base;
  return `${whole.toString()}.${frac.toString().padStart(FIAT_DECIMALS, '0')}`;
}

function sumFiatMinor(priced: LineEval[]): bigint {
  let total = 0n;
  for (const e of priced) {
    if (e.fiatMinor !== null) total += e.fiatMinor;
  }
  return total;
}

function uniqueSources(priced: LineEval[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of priced) {
    if (e.source && !seen.has(e.source)) {
      seen.add(e.source);
      out.push(e.source);
    }
  }
  return out;
}

function deriveMethodology(priced: LineEval[]): FiatMethodology {
  const usedPeg = priced.some((e) => e.usedPeg);
  const usedSpot = priced.some((e) => e.usedSpot);
  if (usedPeg && usedSpot) return 'mixed';
  if (usedPeg) return 'usdc_peg_assumed';
  if (usedSpot) return 'spot';
  return 'unavailable';
}

function deriveAsOfMs(
  priced: LineEval[],
  holdingsAsOfMs: number,
): number | null {
  let max: number | null = null;
  for (const e of priced) {
    if (e.quoteAsOfMs !== null) {
      max = max === null ? e.quoteAsOfMs : Math.max(max, e.quoteAsOfMs);
    }
  }
  return max ?? holdingsAsOfMs;
}
