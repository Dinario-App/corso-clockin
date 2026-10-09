import { isReviewedToken2022Allowed } from '@corso/swap-config';
import type { TokenFactsResponse } from '../tokenFacts/types';

/** Bind the shared signing policy to the manual sell mint and network. */
export function hasReviewedManualSellFacts(args: {
  mint: string;
  cluster: 'devnet' | 'mainnet-beta';
  facts?: TokenFactsResponse | null;
}): boolean {
  const facts = args.facts;
  return (
    facts != null &&
    facts.mint === args.mint &&
    facts.cluster === args.cluster &&
    facts.sources.chain.status === 'ok' &&
    isReviewedToken2022Allowed(facts.sources.chain.fields)
  );
}
