import { hasReviewedManualSellFacts } from './manualSellTokenFacts';
import type { TokenFactsResponse } from '../tokenFacts/types';
import { copy } from '@/constants/copy';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';
import {
  readHeldBalance,
  type HoldingsBook,
} from '@/src/features/balances/holdingsBook';
import type { SessionType } from '@/src/features/session/types';
import { isQuoteMint } from '@/src/features/swap/swapRiskLeg';

/**
 * The door, or the sentence that stands where it would have been.
 *
 * - `eligible` — the user holds a positive, sellable balance on an embedded
 *   wallet. Draw the door.
 * - `withheld` — there is a door-shaped gap and a reason for it. Print `note`.
 * - `absent` — say nothing. Either the answer is not known yet, or the honest
 *   answer is "this is not a thing you hold", which needs no caption.
 */
export type HeldSellDoor =
  | Readonly<{ kind: 'eligible' }>
  | Readonly<{ kind: 'withheld'; note: string }>
  | Readonly<{ kind: 'absent' }>;

const ELIGIBLE: HeldSellDoor = Object.freeze({ kind: 'eligible' } as const);
const ABSENT: HeldSellDoor = Object.freeze({ kind: 'absent' } as const);

function withheld(note: string): HeldSellDoor {
  return Object.freeze({ kind: 'withheld', note } as const);
}

export function resolveHeldSellDoor(args: {
  mint: string | null | undefined;
  cluster: PriceCluster | null | undefined;
  /** The active signer session's type. `null` when there is no session. */
  walletType: SessionType | null | undefined;
  book: HoldingsBook;
  facts?: TokenFactsResponse | null;
}): HeldSellDoor {
  if (!args.mint || !args.cluster) return ABSENT;
  /*
    SOL and USDC are the money, not a holding to be sold from this screen.
    Their Sell door is the pre-existing SOL↔USDC one that `resolveAssetPrefill`
    has always built, and it reads device-side balances that need none of this.
  */
  if (isQuoteMint({ mint: args.mint, cluster: args.cluster })) return ABSENT;

  // No session, nothing to claim about. The screen is browsable signed-out.
  if (args.walletType == null) return ABSENT;

  if (args.walletType !== 'privy_embedded') {
    return withheld(copy.tokenDetail.sellNeedsCorsoWallet);
  }

  if (args.book.status === 'idle' || args.book.status === 'loading') {
    return ABSENT;
  }
  if (args.book.status === 'error') {
    // See the header: a dark route is not a failed read.
    if (args.book.code === 'unavailable') return ABSENT;
    if (args.book.code === 'wallet_type_unsupported') {
      return withheld(copy.tokenDetail.sellNeedsCorsoWallet);
    }
    return withheld(copy.tokenDetail.sellHoldingsUnavailable);
  }

  const read = readHeldBalance(args.book, args.mint);
  // A `ready` book cannot answer `known: false`; this is the type being honest.
  if (!read.known) return ABSENT;
  if (read.atomic <= 0n) return ABSENT;

  if (read.held != null && (read.held.tokenProgram === 'unrecognised' ||
      read.held.notSellableReason === 'unrecognised')) {
    return withheld(copy.tokenDetail.sellHoldingNotRecognised);
  }

  /*
    A held Token-2022 token needs matching mint facts as well as the API's
    eligibility. Both use the signing gate's shared extension policy.
  */
  if (read.held != null && (!read.held.sellable ||
      (read.held.tokenProgram === 'token-2022' && !hasReviewedManualSellFacts({
        mint: args.mint, cluster: args.cluster, facts: args.facts,
      })))) {
    return withheld(copy.tokenDetail.sellTokenNotSupported);
  }

  return ELIGIBLE;
}
