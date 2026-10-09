import { hasReviewedManualSellFacts } from './manualSellTokenFacts';
import type { TokenFactsResponse } from '../tokenFacts/types';
import { copy } from '@/constants/copy';
import {
  formatAtomicAmount,
  SOL_MINT,
  usdcMintForCluster,
  type SwapToken,
} from '@/src/features/swap/tokens';
import type { UsdcBalanceStatus } from '@/src/features/balances/useUsdcBalance';
import {
  readHeldBalance,
  type HoldingsBook,
} from '@/src/features/balances/holdingsBook';
import type { PayDecimalsProof } from '@/src/features/swap/payDecimalsProof';
import type { SessionType } from '@/src/features/session/types';
import type { TokenProgramKind } from '@/src/features/tokenFacts/types';
import {
  maxPayAtomic,
  unknownPayBalanceMessage,
  type PayBalance,
  type PayBalanceUnknownReason,
} from '@/src/features/swap/validateSwap';

export type { PayBalance, PayBalanceUnknownReason };

export type SwapPayBalanceInputs = {
  payMint: string;
  cluster: 'devnet' | 'mainnet-beta';
  solLamports: number | null;
  usdcStatus: UsdcBalanceStatus;
  usdcAtomic: bigint | null;
  /**
   * The mint's TokenFacts program. Token-2022 requires the shared reviewed
   * extension policy before its held balance can fund a manual V2 sell.
   */
  payTokenProgram?: TokenProgramKind | null;
  payTokenFacts?: TokenFactsResponse | null;
  walletType?: SessionType | null;
  holdings?: HoldingsBook;
  payDecimalsProof?: PayDecimalsProof;
};

export function resolveSwapPayBalance(
  inputs: SwapPayBalanceInputs,
): PayBalance {
  if (inputs.payTokenProgram === 'token-2022' && !hasReviewedManualSellFacts({
    mint: inputs.payMint, cluster: inputs.cluster, facts: inputs.payTokenFacts,
  })) {
    return { known: false, reason: 'token_2022_not_sellable' };
  }
  if (inputs.payMint === SOL_MINT) {
    if (inputs.solLamports === null) {
      return { known: false, reason: 'sol_unavailable' };
    }
    return { known: true, atomic: BigInt(inputs.solLamports) };
  }
  if (inputs.payMint === usdcMintForCluster(inputs.cluster)) {
    if (inputs.usdcStatus !== 'ready' || inputs.usdcAtomic === null) {
      return { known: false, reason: 'usdc_unavailable' };
    }
    return { known: true, atomic: inputs.usdcAtomic };
  }
  if (inputs.walletType != null && inputs.walletType !== 'privy_embedded') {
    return { known: false, reason: 'wallet_type_unsupported' };
  }
  const proof = inputs.payDecimalsProof ?? { status: 'quote_mint' as const };
  if (proof.status === 'unproven') {
    return {
      known: false,
      reason:
        proof.reason === 'decimals_disagree'
          ? 'pay_decimals_mismatch'
          : 'pay_decimals_unread',
    };
  }
  if (inputs.holdings == null) {
    return { known: false, reason: 'holdings_unavailable' };
  }
  const read = readHeldBalance(inputs.holdings, inputs.payMint);
  if (!read.known) {
    return { known: false, reason: read.reason };
  }
  if (read.held != null && (read.held.tokenProgram === 'unrecognised' ||
      read.held.notSellableReason === 'unrecognised')) {
    return { known: false, reason: 'holding_not_recognised' };
  }
  /**
   * Both the API book and matching mobile TokenFacts must allow a Token-2022
   * manual sell. Neither source can clear a refusal from the other.
   */
  if (read.held != null && (!read.held.sellable ||
      (read.held.tokenProgram === 'token-2022' && !hasReviewedManualSellFacts({
        mint: inputs.payMint, cluster: inputs.cluster, facts: inputs.payTokenFacts,
      })))) {
    return { known: false, reason: 'token_2022_not_sellable' };
  }
  return { known: true, atomic: read.atomic };
}

export function resolveSwapMaxUnavailableMessage(
  reason: PayBalanceUnknownReason,
  usdc: { status: UsdcBalanceStatus; error: string | null },
): string {
  // The USDC channel carries its own server-worded failure; prefer it.
  if (reason === 'usdc_unavailable' && usdc.status === 'error') {
    return usdc.error ?? copy.home.balanceError;
  }
  return unknownPayBalanceMessage(reason);
}

export type SwapPercentChipResult =
  | { kind: 'amount'; amount: string }
  | { kind: 'error'; message: string };

/**
 * Percent chips must not silent-noop when pay balance is unknown.
 * Same unavailable/loading/error copy as Max; ready path keeps SOL fee reserve.
 */
export function applySwapPercentChip(args: {
  pct: number;
  payToken: SwapToken;
  payBalance: PayBalance;
  usdc: { status: UsdcBalanceStatus; error: string | null };
}): SwapPercentChipResult {
  if (!args.payBalance.known) {
    return {
      kind: 'error',
      message: resolveSwapMaxUnavailableMessage(
        args.payBalance.reason,
        args.usdc,
      ),
    };
  }
  const max = maxPayAtomic({
    payToken: args.payToken,
    balanceAtomic: args.payBalance.atomic,
  });
  if (max <= 0n) {
    return {
      kind: 'error',
      message: copy.swap.notEnoughForSwap(args.payToken.symbol),
    };
  }
  const portion = (max * BigInt(args.pct)) / 100n;
  return {
    kind: 'amount',
    amount: formatAtomicAmount(portion.toString(), args.payToken.decimals),
  };
}

export function resolveSwapPayBalanceLabel(args: {
  paySymbol: string;
  payDecimals: number;
  payBalance: PayBalance;
  usdcStatus: UsdcBalanceStatus;
  usdcError: string | null;
}): string {
  if (args.payBalance.known) {
    return copy.swap.balance(
      formatAtomicAmount(args.payBalance.atomic.toString(), args.payDecimals),
      args.paySymbol,
    );
  }
  switch (args.payBalance.reason) {
    case 'sol_unavailable':
      return copy.home.balanceLoading;
    case 'usdc_unavailable':
      if (args.usdcStatus === 'loading' || args.usdcStatus === 'idle') {
        return copy.home.balanceLoading;
      }
      if (args.usdcStatus === 'error') {
        return args.usdcError ?? copy.home.balanceError;
      }
      return 'USDC balance unavailable';
    case 'holdings_loading':
      return copy.home.balanceLoading;
    default:
      return unknownPayBalanceMessage(args.payBalance.reason);
  }
}
