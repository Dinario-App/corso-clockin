import type { Produced } from './textProvenance.js';

export type AskIntent =
  | 'SWAP'
  | 'HOLDING_FACT'
  | 'PORTFOLIO'
  | 'CLARIFY'
  | 'REFUSE'
  | 'OUT_OF_SCOPE'
  | 'TOKEN_VITALS';

export type AmountKind = 'absolute' | 'fraction' | 'usd' | 'all';

export type HoldingRef = `h${number}`;

export type AskHolding = {
  ref: HoldingRef;
  symbol: string;
  name: string;
  amount: number;
  usd: number;
  pctOfTotal: number;
  /** `null` when unknown. Never `0` as a stand-in — see routes/ask.ts. */
  change24hPct: number | null;
  verified: boolean;
  suspicious?: boolean;
};

/**
 * Server-side holding record. Carries the two fields the model must never see:
 * the mint, and the token's decimals. The resolver and the amount math read
 * these; the model payload is built by stripping them.
 */
export type ServerHolding = AskHolding & {
  mint: string;
  decimals: number;
  /**
   * The true balance in base units, as a decimal string. `amount` above is a
   * 4-significant-figure display number and must never be used for arithmetic —
   * "never trust a model-extracted number" applies equally to a rounded one.
   */
  balanceBaseUnits: string;
  unitPriceUsd: number | null;
};

export type AskContext = {
  holdings: AskHolding[];
  totalUsd: number;
  unpricedHoldingsCount?: number;
  undisclosedHoldingsCount?: number;
  solForFees: number;
  recent: AskRecentEntry[];
  now: string;
  moreHoldingsCount: number;
};

export type AskRecentEntry = {
  kind: 'swap' | 'in' | 'out';
  fromSymbol?: string;
  toSymbol?: string;
  amount: number;
  daysAgo: number;
};

export type AskResult = {
  intent: AskIntent;
  swap?: {
    fromRef: string;
    toSymbol: string;
    amountKind: AmountKind;
    amountValue?: number;
  };
  answer?: string;
  subjectRef?: string;
  chips?: string[];
  confidence: 'high' | 'low';
};

export type TokenCandidate = {
  mint: string;
  symbol: string;
  name: string | null;
  isVerified: boolean | null;
  liquidityUsd: number | null;
  isSus: boolean | null;
  topHoldersPct: number | null;
  /** Mint-account decimals when the search provider returned them. */
  decimals?: number | null;
  /** RugCheck tier, when the client has it. Absent is not the same as safe. */
  rugcheckTier?: 'ok' | 'caution' | 'danger' | null;
};

export type ResolutionReason =
  | 'pasted'
  | 'canonical_quote'
  | 'single_verified'
  | 'held_unverified'
  | 'unverified_ranked';

export type MintResolution =
  | {
      status: 'resolved';
      mint: string;
      symbol: string;
      reason: ResolutionReason;
      candidateCount: number;
      unverified: boolean;
      /** Exact mint-account decimals, or null when the resolver cannot prove them. */
      decimals: number | null;
      line: string | null;
    }
  | { status: 'ambiguous'; symbol: string; candidates: TokenCandidate[] }
  | { status: 'not_found'; symbol: string };

/** Production values carry channel provenance; raw validator fixtures remain AskResult. */
export type ProducedAskResult = AskResult & Produced;
