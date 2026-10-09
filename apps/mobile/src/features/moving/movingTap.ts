/**
 * What a tap on a visible Moving row does.
 *
 * The row opens the existing mint-keyed Asset screen. This is navigation only:
 * it does not prefill Ask, create a quote, open Review, or cross a signing
 * boundary. Using the mint instead of the display symbol keeps punctuation,
 * Unicode, and duplicate names out of route identity.
 */

import { MOVING_MINT_PATTERN } from '@/src/features/moving/types';

export type MovingTapEffect = {
  href: {
    pathname: '/asset/[mint]';
    params: { mint: string };
  };
};

/** Fail closed if a caller bypasses the Moving parser with an invalid mint. */
export function resolveMovingTapEffect(row: {
  mint: string;
}): MovingTapEffect | null {
  if (!MOVING_MINT_PATTERN.test(row.mint)) return null;
  return {
    href: {
      pathname: '/asset/[mint]',
      params: { mint: row.mint },
    },
  };
}
