import { copy } from '@/constants/copy';
import { formatAtomicAmount } from '@/src/features/swap/tokens';

export type ReviewSheetPhase = 'review' | 'sending' | 'signed' | 'failed';

export type ReviewSheetPresentation = {
  title: string;
  dismissible: boolean;
  dimLineItems: boolean;
  showConfirm: boolean;
  showSendingCaption: boolean;
  showReceipt: boolean;
  showFail: boolean;
};

export type SwapNetworkFeeRow = Readonly<{
  label: string;
  value: string;
}>;

/** A completed quote needs a positive atomic network fee and a known rent breakdown. */
function isAtomicLamports(value: unknown): value is string {
  return typeof value === 'string' && /^\d{1,20}$/.test(value) &&
    BigInt(value) <= 18_446_744_073_709_551_615n;
}

export function hasUsableSwapCosts(
  networkFeeLamports: unknown,
  accountRentLamports: unknown,
): boolean {
  return isAtomicLamports(networkFeeLamports) && BigInt(networkFeeLamports) > 0n &&
    isAtomicLamports(accountRentLamports);
}

export function resolveSwapNetworkFeeRow(
  networkFeeLamports: string | null | undefined,
  accountRentLamports?: string | null,
): SwapNetworkFeeRow | null {
  if (!hasUsableSwapCosts(networkFeeLamports, accountRentLamports)) {
    return { label: copy.swap.networkFee, value: copy.send.feeUnavailable };
  }
  return {
    label: copy.swap.networkFee,
    value: `${formatAtomicAmount(networkFeeLamports!, 9)} SOL`,
  };
}

/** The rent is explained beside its charge, and never labelled a network fee. */
export function resolveSwapAccountRentRow(
  accountRentLamports: string | null | undefined,
): SwapNetworkFeeRow | null {
  if (isAtomicLamports(accountRentLamports) && BigInt(accountRentLamports) === 0n) return null;
  return { label: copy.swap.accountRent, value: !isAtomicLamports(accountRentLamports)
    ? copy.send.feeUnavailable : `${formatAtomicAmount(accountRentLamports, 9)} SOL` };
}

export function resolveSwapTotalCostRow(
  networkFeeLamports: string | null | undefined,
  accountRentLamports: string | null | undefined,
  corsoFeeLamports: string | 'unreadable' | null = null,
): SwapNetworkFeeRow {
  return { label: copy.swap.totalCost,
    value: !hasUsableSwapCosts(networkFeeLamports, accountRentLamports)
      ? copy.send.feeUnavailable
      : corsoFeeLamports === 'unreadable'
        ? copy.home.balancePlaceholder
        : `${formatAtomicAmount((BigInt(networkFeeLamports!) + BigInt(accountRentLamports!) + (corsoFeeLamports == null ? 0n : BigInt(corsoFeeLamports))).toString(), 9)} SOL` };
}

export function isReviewConfirmationLocked(
  phase: ReviewSheetPhase | null,
  confirmationPending: boolean,
): boolean {
  return phase === 'review' && confirmationPending;
}

export function resolveReviewSheetPresentation(
  phase: ReviewSheetPhase,
  failTitle?: string,
): ReviewSheetPresentation {
  if (phase === 'sending') {
    return {
      title: copy.v1.sending,
      dismissible: true,
      dimLineItems: true,
      showConfirm: false,
      showSendingCaption: true,
      showReceipt: false,
      showFail: false,
    };
  }
  if (phase === 'signed') {
    return {
      title: copy.v1.donePeriod,
      dismissible: true,
      dimLineItems: false,
      showConfirm: false,
      showSendingCaption: false,
      showReceipt: true,
      showFail: false,
    };
  }
  if (phase === 'failed') {
    return {
      title: failTitle?.trim() ? failTitle : copy.v1.thatDidntGoThrough,
      dismissible: true,
      dimLineItems: false,
      showConfirm: false,
      showSendingCaption: false,
      showReceipt: false,
      showFail: true,
    };
  }
  return {
    title: copy.v1.review,
    dismissible: true,
    dimLineItems: false,
    showConfirm: true,
    showSendingCaption: false,
    showReceipt: false,
    showFail: false,
  };
}

export function reviewSheetPhaseFromStep(
  step: 'compose' | 'review' | 'sending' | 'success' | 'failed',
): ReviewSheetPhase | null {
  if (step === 'review') return 'review';
  if (step === 'sending') return 'sending';
  if (step === 'success') return 'signed';
  if (step === 'failed') return 'failed';
  return null;
}
