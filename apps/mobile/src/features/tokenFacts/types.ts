import type { PriceCluster } from '@/src/features/balances/priceSnapshot';

export const TOKEN_FACTS_SCHEMA_VERSION = 1 as const;

export type TokenFactsApiStatus =
  | 'ready'
  | 'partial'
  | 'unavailable'
  | 'disabled';

export type TokenFactsSourceStatus = 'ok' | 'missing' | 'unavailable';

export type AuthorityStatus = 'renounced' | 'present' | 'unknown';

export type TokenProgramKind = 'spl-token' | 'token-2022';

export type TokenFactsChainFields = {
  decimals: number | null;
  supply: string | null;
  /** Server-computed top-20 account share, truncated to basis-point precision. */
  top20ConcentrationPct: number | null;
  mintAuthority: AuthorityStatus | null;
  freezeAuthority: AuthorityStatus | null;
  tokenProgram: TokenProgramKind | null;
  /** Complete TLV extension IDs, including unknown IDs; null means unprovable. */
  token2022ExtensionTypeIds?: readonly number[] | null;
  transferFee: boolean | null;
  transferHook: boolean | null;
  transferHookAuthority: string | null;
  transferHookProgramId: string | null;
  permanentDelegate: boolean | null;
  permanentDelegateAddress: string | null;
  defaultAccountFrozen: boolean | null;
  transferFeeBasisPoints: number | null;
  transferFeeMaximum: string | null;
  transferFeeEpoch: number | null;
  transferFeeOlderBasisPoints: number | null;
  transferFeeOlderMaximum: string | null;
  transferFeeOlderEpoch: number | null;
  transferFeeNewerBasisPoints: number | null;
  transferFeeNewerMaximum: string | null;
  transferFeeNewerEpoch: number | null;
};

export type TokenFactsJupiterFields = {
  name: string | null;
  symbol: string | null;
  icon: string | null;
  holderCount: number | null;
  topHoldersPct: number | null;
  liquidityUsd: number | null;
  isVerified: boolean | null;
  organicScore: number | null;
  isSus: boolean | null;
};

export type TokenFactsRugcheckFields = {
  riskLevel: 'Good' | 'Warning' | 'Danger' | null;
  riskDescriptions: string[];
  lpLockedPct: number | null;
  lpLockedUsd: number | null;
  totalMarketLiquidity: number | null;
};

export type TokenFactsSourceSlice<TFields> = {
  status: TokenFactsSourceStatus;
  /** Honest upstream observation time; null when the source did not resolve. */
  asOfMs: number | null;
  fields: TFields;
};

export type RiskSeverity = 'info' | 'warn' | 'block';

export type RiskFlagCode =
  | 'unknown_mint'
  | 'freeze_authority_present'
  | 'mint_authority_present'
  | 'high_price_impact'
  | 'low_sol_for_fees'
  | 'low_sol_for_rent'
  | 'stale_quote'
  | 'fee_unverified'
  | 'insufficient_balance'
  | 'swap_program_unexpected'
  | 'step_up_required'
  | 'session_locked'
  | 'door_capability_limited'
  | 'empty_portfolio'
  | 'ramp_geo_or_disabled'
  | 'analytics_or_ai_disclosure';

export type RiskFlagSource =
  | 'balance'
  | 'quote'
  | 'send'
  | 'swap_semantics'
  | 'session'
  | 'ramp'
  | 'token_meta';

export type RiskFlagEvidence = Record<
  string,
  string | number | boolean | null
>;

/** Disclosure payload only — never branch control flow on `blocking` or `code`. */
export type RiskFlag = {
  code: RiskFlagCode;
  severity: RiskSeverity;
  reason: string;
  userLine: string;
  source: RiskFlagSource;
  blocking: boolean;
  evidence: RiskFlagEvidence;
};

export type TokenFactsResponse = {
  schemaVersion: typeof TOKEN_FACTS_SCHEMA_VERSION;
  mint: string;
  cluster: PriceCluster;
  status: TokenFactsApiStatus;
  asOfMs: number;
  cacheTtlSec: number;
  sources: {
    chain: TokenFactsSourceSlice<TokenFactsChainFields>;
    jupiter: TokenFactsSourceSlice<TokenFactsJupiterFields>;
    rugcheck: TokenFactsSourceSlice<TokenFactsRugcheckFields>;
  };
  flags: RiskFlag[];
};

export type TokenFactsHookStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unavailable'
  | 'disabled'
  | 'error';
