import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import { SOL_MINT, usdcMintForCluster } from '@/src/features/swap/tokens';
import {
  resolveRugcheckReviewPresentation,
  type RugcheckReviewPresentation,
} from '@/src/features/tokenFacts/rugcheckReviewPresentation';
import type {
  TokenFactsResponse,
  TokenProgramKind,
} from '@/src/features/tokenFacts/types';

/** The two legs of a swap, named by what the user does with each. */
export type SwapRiskLeg = 'pay' | 'receive';

export function isQuoteMint(args: {
  mint: string | null | undefined;
  cluster: PriceCluster | null | undefined;
}): boolean {
  if (!args.mint) return false;
  if (args.mint === SOL_MINT) return true;
  if (!args.cluster) return false;
  return args.mint === usdcMintForCluster(args.cluster);
}

/**
 * The leg the risk surface is about.
 *
 * On a buy that is what you receive; on a sell it is what you are giving up,
 * which is the token that can rug.
 *
 * Three cases, and none of them is silent:
 *   - **pay is a quote mint** (a buy, and SOL↔USDC) → `receive`. Today's
 *     behaviour, unchanged.
 *   - **pay is not a quote mint** (a sell, and memecoin→memecoin) → `pay`.
 *   - **no pay mint or no cluster** → `receive`. Unobservable — the screen
 *     renders its resolving branch with no cluster — and refusal-shaped anyway:
 *     it can only ever leave the current binding in place.
 */
export function resolveSwapRiskLeg(args: {
  payMint: string | null | undefined;
  cluster: PriceCluster | null | undefined;
}): SwapRiskLeg {
  if (!args.payMint || !args.cluster) return 'receive';
  return isQuoteMint({ mint: args.payMint, cluster: args.cluster })
    ? 'receive'
    : 'pay';
}

/** Pick one leg's value. Exported so the choice is made in exactly one place. */
export function selectSwapRiskLeg<T>(args: {
  leg: SwapRiskLeg;
  pay: T;
  receive: T;
}): T {
  return args.leg === 'pay' ? args.pay : args.receive;
}

export function resolveSwapRiskPresentation(args: {
  leg: SwapRiskLeg;
  payMint: string | null | undefined;
  receiveMint: string | null | undefined;
  payFacts: TokenFactsResponse | null;
  receiveFacts: TokenFactsResponse | null;
}): RugcheckReviewPresentation {
  const mint = selectSwapRiskLeg({
    leg: args.leg,
    pay: args.payMint,
    receive: args.receiveMint,
  });
  const facts = selectSwapRiskLeg({
    leg: args.leg,
    pay: args.payFacts,
    receive: args.receiveFacts,
  });
  const exactFacts = facts && mint && facts.mint === mint ? facts : null;
  const rugcheck =
    exactFacts?.sources.rugcheck.status === 'ok'
      ? exactFacts.sources.rugcheck.fields
      : null;
  const unchecked = exactFacts?.sources.rugcheck.status !== 'ok';
  const unverified = exactFacts?.sources.jupiter.fields.isVerified !== true;
  return resolveRugcheckReviewPresentation({
    tier: rugcheck?.riskLevel ?? null,
    descriptions: rugcheck?.riskDescriptions ?? [],
    uncheckedUnverified: unchecked && unverified,
    unknownRequiresAcknowledgement: true,
  });
}

export function resolveLegTokenProgram(args: {
  mint: string | null | undefined;
  facts: TokenFactsResponse | null;
}): TokenProgramKind | null {
  const { facts, mint } = args;
  if (!facts || !mint || facts.mint !== mint) return null;
  if (facts.sources.chain.status !== 'ok') return null;
  return facts.sources.chain.fields.tokenProgram;
}

/**
 * Which TokenFacts panels the Review sheet mounts.
 *
 * The subject leg is always shown. The receive leg is also shown whenever it is
 * not a quote mint, so a memecoin→memecoin pair renders **both** panels rather
 * than silently picking one. A buy is unchanged: one panel, the receive leg.
 */
export type SwapReviewFactsPanels = Readonly<{
  leg: SwapRiskLeg;
  showPay: boolean;
  showReceive: boolean;
}>;

export function resolveSwapReviewFactsPanels(args: {
  payMint: string | null | undefined;
  receiveMint: string | null | undefined;
  cluster: PriceCluster | null | undefined;
}): SwapReviewFactsPanels {
  const leg = resolveSwapRiskLeg({
    payMint: args.payMint,
    cluster: args.cluster,
  });
  const receiveIsQuote = isQuoteMint({
    mint: args.receiveMint,
    cluster: args.cluster,
  });
  return Object.freeze({
    leg,
    showPay: leg === 'pay',
    showReceive: leg === 'receive' || !receiveIsQuote,
  });
}
