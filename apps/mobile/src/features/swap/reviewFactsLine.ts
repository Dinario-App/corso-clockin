import { copy } from '@/constants/copy';
import { buildPickerFactsSubtitle } from '@/src/features/tokenFacts/formatTokenFactsDisplay';
import type {
  TokenFactsHookStatus,
  TokenFactsResponse,
} from '@/src/features/tokenFacts/types';

/**
 * Display-only token-facts sentence for Review Explain.
 * Loading / disabled / missing facts return null so the card omits the line
 * instead of inventing a number. Uses the existing picker subtitle so the
 * words stay the same facts the rest of the app already prints.
 */
export function presentReviewFactsLine(args: {
  status: TokenFactsHookStatus;
  facts: TokenFactsResponse | null;
  error: string | null;
  nowMs: number;
}): string | null {
  if (
    args.status === 'idle' ||
    args.status === 'loading' ||
    args.status === 'error' ||
    args.status === 'unavailable' ||
    args.status === 'disabled'
  ) {
    return null;
  }
  if (!args.facts || args.facts.status === 'disabled') return null;
  const line = buildPickerFactsSubtitle({
    status: args.status,
    facts: args.facts,
    error: args.error,
    nowMs: args.nowMs,
    includeIdentity: true,
  });
  if (
    line === copy.tokenFacts.loading ||
    line === copy.tokenFacts.unavailable ||
    line === copy.tokenFacts.disabled
  ) {
    return null;
  }
  return line;
}
