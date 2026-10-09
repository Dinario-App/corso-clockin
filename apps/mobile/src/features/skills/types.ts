import type {
  ActivityAssetSymbol,
  ActivityKind,
  ActivityStatus,
} from '@/src/features/activity/types';
import type { SkillsTemplateId } from './templateIds';

export type ActivityKindV2 =
  | ActivityKind
  | 'buy'
  | 'sell'
  | 'failed_money';

export type ActivityTaxonomyItem = {
  schemaVersion: 1;
  signature: string;
  kind: ActivityKindV2;
  status: ActivityStatus;
  blockTimeMs: number | null;
  amountLamports: number | null;
  signedLamports: number | null;
  tokenAmountAtomic: string | null;
  amountSymbol: ActivityAssetSymbol | string | null;
  counterparty: string | null;
  feeLamports: number | null;
  title: string;
  swap: {
    inputMint: string | null;
    outputMint: string | null;
    inAtomic: string | null;
    outAtomic: string | null;
  } | null;
  ramp: {
    sessionId: string | null;
    asset: 'SOL' | 'USDC' | null;
    provider: 'moonpay' | null;
  } | null;
  explorerUrl: string | null;
  plainLanguage: string | null;
};

export type WhatChangedEmptyReason = 'no_activity' | 'still_loading' | null;

export type WhatChangedBundle = {
  schemaVersion: 1;
  address: string;
  windowMs: number;
  asOfMs: number;
  events: ActivityTaxonomyItem[];
  /** Sum of signedLamports in window when complete + every row has a signed delta. */
  nativeSolDeltaLamports: number | null;
  /** True when activity page may have truncated history (fetch limit hit). */
  incomplete: boolean;
  emptyReason: WhatChangedEmptyReason;
};

export type FeeExplainContext =
  | 'swap_review'
  | 'send_confirm'
  | 'activity_detail';

/**
 * Quote / fee row inputs for fee-explainer templates.
 * Missing fields fail soft — never invent bps, impact, or network fees.
 */
export type FeeExplainInput = {
  context: FeeExplainContext;
  corsoFeeBps?: number | null;
  quoteFeeBps?: number | null;
  platformFeeBps?: number | null;
  platformFeeAmountAtomic?: string | null;
  feeMint?: string | null;
  feeDropped?: boolean | null;
  feeDisplayName?: string | null;
  priceImpactPct?: string | null;
  /** Network fee in lamports when known (send / activity). */
  networkFeeLamports?: number | null;
  /** ATA / WSOL rent reserve hint (swap SOL pay path). */
  solReserveLamports?: number | null;
};

export type FeeExplainLine = {
  templateId: SkillsTemplateId;
  text: string;
};

/** Deterministic fee-explainer view (templateId + lines; max 3 for Review). */
export type FeeExplainView = {
  schemaVersion: 1;
  context: FeeExplainContext;
  templateId: SkillsTemplateId | null;
  lines: FeeExplainLine[];
  /** True when Corso fee posture could not be verified. */
  feeDropped: boolean;
  /** Resolved Corso fee bps when known and safe to display; null if omitted. */
  corsoFeeBps: number | null;
};

export type WhatChangedLine = {
  templateId: SkillsTemplateId;
  text: string;
};
