import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import { isQuoteMint } from '@/src/features/swap/swapRiskLeg';
import type { SwapToken } from '@/src/features/swap/tokens';
import type { TokenFactsResponse } from '@/src/features/tokenFacts/types';

export type PayDecimalsProof =
  /**
   * SOL, or the cluster's USDC. Their decimals are pinned constants that
   * `tokenForSymbol` produced from the cluster — there is no caller-supplied
   * number to prove, and nothing to refuse.
   */
  | Readonly<{ status: 'quote_mint' }>
  /** The chain read agrees with the leg on screen. */
  | Readonly<{ status: 'proven'; decimals: number }>
  /**
   * `chain_unread` — no chain slice for this exact mint yet (still arriving, or
   * TokenFacts is off/failed). `decimals_disagree` — a slice landed and says a
   * different number than the leg carries.
   */
  | Readonly<{
      status: 'unproven';
      reason: 'chain_unread' | 'decimals_disagree';
    }>;

export function resolvePayDecimalsProof(args: {
  payToken: SwapToken | null | undefined;
  cluster: PriceCluster | null | undefined;
  facts: TokenFactsResponse | null;
}): PayDecimalsProof {
  const { payToken, cluster, facts } = args;
  if (!payToken) {
    return Object.freeze({
      status: 'unproven',
      reason: 'chain_unread',
    } as const);
  }
  if (isQuoteMint({ mint: payToken.mint, cluster })) {
    return Object.freeze({ status: 'quote_mint' } as const);
  }
  if (
    facts == null ||
    facts.mint !== payToken.mint ||
    facts.sources.chain.status !== 'ok'
  ) {
    return Object.freeze({
      status: 'unproven',
      reason: 'chain_unread',
    } as const);
  }
  const chainDecimals = facts.sources.chain.fields.decimals;
  if (chainDecimals == null || !Number.isInteger(chainDecimals)) {
    return Object.freeze({
      status: 'unproven',
      reason: 'chain_unread',
    } as const);
  }
  if (chainDecimals !== payToken.decimals) {
    return Object.freeze({
      status: 'unproven',
      reason: 'decimals_disagree',
    } as const);
  }
  return Object.freeze({
    status: 'proven',
    decimals: chainDecimals,
  } as const);
}
