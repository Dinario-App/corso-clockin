import { copy } from '@/constants/copy';
import type {
  ReviewContextChip,
  ReviewSignModel,
} from '@/src/ui/ethena/reviewSignModel';
import type { FrozenSwapReviewIntent } from './swapReviewIntent';
import { feeBpsToPercentLabel, formatAtomicAmount } from './tokens';
import type { SwapToken } from './tokens';
import {
  formatCommittedFeeDisplayValue,
  selectCommittedFeeDisplay,
} from './swapCommittedFee';
import { formatSwapReviewPriceImpact } from './formatPriceImpact';
import type { SwapFailPresentation } from './swapOutcomePresentation';
import type { SwapRiskLeg } from './swapRiskLeg';
import {
  hasUsableSwapCosts,
  resolveSwapAccountRentRow,
  resolveSwapNetworkFeeRow,
} from './reviewSheetPresentation';

type Intent = Pick<
  FrozenSwapReviewIntent,
  | 'inAmount'
  | 'outAmount'
  | 'otherAmountThreshold'
  | 'paySymbol'
  | 'receiveSymbol'
  | 'corsoFeeBps'
  | 'platformFeeAmount'
  | 'feeMint'
  | 'feeDropped'
  | 'priceImpactPct'
  | 'networkFeeLamports'
  | 'accountRentLamports'
  | 'expireAt'
  | 'slippageBps'
>;
export type ReviewSignRead = {
  intent: Intent | null;
  pay: SwapToken;
  receive: SwapToken;
  nowMs: number;
  appliedAtMs: number | null;
  phase: 'review' | 'sending' | 'failed';
  enabled: boolean;
  busy: boolean;
  confirmValid: boolean;
  canConfirm: boolean;
  riskLeg: SwapRiskLeg;
  cashShortfall?: string | null;
  failure?: string | null;
  bookEffect?: string | null;
  factsLine?: string | null;
  chartMint?: string | null;
  chartPriceUsd?: string | null;
  chips?: readonly ReviewContextChip[];
  /** Already worded by `reviewAfterSale`. The presenter does not price it. */
  afterSale?: string | null;
  /**
   * The route's classified failure. A specific kind (`price-moved`,
   * `not-enough`) lends its existing title to the failed caution heading; the
   * unclassified `blocked` kind keeps the generic heading.
   */
  failReason?: Pick<SwapFailPresentation, 'kind' | 'title'> | null;
  /** Replaces the failed-state caution when a holdings-cap refusal is already worded. */
  cautionOverride?: { heading: string; body: string } | null;
};

/** Display-only timestamp interpretation mirrors assertSafeToSign. The safety
 * assertion still owns expiry at signing, including lastValidBlockHeight. */
function expiry(
  expireAt: string | null,
  nowMs: number,
): 'fresh' | 'expired' | 'invalid' {
  if (!expireAt) return 'fresh';
  const numeric = Number(expireAt);
  const deadline =
    Number.isFinite(numeric) && numeric > 0
      ? numeric < 1e12
        ? numeric * 1000
        : numeric
      : Date.parse(expireAt);
  return !Number.isFinite(deadline)
    ? 'invalid'
    : nowMs > deadline
      ? 'expired'
      : 'fresh';
}

export function presentReviewSign(read: ReviewSignRead): ReviewSignModel {
  const q = read.intent;
  const state = !read.enabled
    ? 'off'
    : read.busy
      ? 'signing'
      : read.phase === 'sending'
        ? 'unconfirmed'
        : read.phase === 'failed'
          ? 'failed'
          : read.cashShortfall
            ? 'insufficient'
            : !q
              ? 'quoting'
              : !read.confirmValid || expiry(q.expireAt, read.nowMs) !== 'fresh'
                ? 'expired'
                : read.appliedAtMs != null &&
                    read.nowMs - read.appliedAtMs >= 10000
                  ? 'aging'
                  : 'quoted';
  const action =
    state === 'off' || state === 'unconfirmed'
      ? 'none'
      : state === 'expired'
        ? 'requote'
        : state === 'insufficient'
          ? 'addCash'
          : state === 'failed'
            ? 'retry'
            : 'sign';
  const fee = selectCommittedFeeDisplay(q, [read.pay, read.receive]);
  const network = q
    ? resolveSwapNetworkFeeRow(q.networkFeeLamports, q.accountRentLamports)
    : null;
  const rent = q ? resolveSwapAccountRentRow(q.accountRentLamports) : null;
  const costs = [
    {
      label: copy.swap.youPay,
      value: read.cashShortfall
        ? `Short ${read.cashShortfall}`
        : q
          ? `${formatAtomicAmount(q.inAmount, read.pay.decimals)} ${q.paySymbol}`
          : '…',
    },
    ...(q?.corsoFeeBps === 0 && !q.feeDropped
      ? []
      : [
          {
            label:
              fee.kind === 'fee'
                ? `${copy.swap.corsoFee} · ${feeBpsToPercentLabel(fee.bps)}`
                : copy.swap.corsoFee,
            value: q?.feeDropped
              ? copy.swap.feeDropped
              : formatCommittedFeeDisplayValue(fee, false),
          },
        ]),
    {
      label: copy.swap.priceImpact,
      value: q
        ? formatSwapReviewPriceImpact(q.priceImpactPct, read.riskLeg)
        : '…',
    },
    {
      label: copy.swap.networkFee,
      value: q ? (network?.value ?? copy.swap.costEstimating) : '…',
    },
  ];
  const trailingCosts = [
    {
      label: copy.swap.minimumReceived,
      value: q
        ? `${formatAtomicAmount(q.otherAmountThreshold, read.receive.decimals)} ${q.receiveSymbol}`
        : '…',
      muted: true,
    },
    {
      label: copy.swap.slippage,
      value: q ? feeBpsToPercentLabel(q.slippageBps) : '…',
    },
    ...(rent ? [rent] : []),
  ];
  return {
    state,
    title: read.riskLeg === 'pay' ? 'Review this sell' : 'Review this buy',
    caution:
      state === 'aging'
        ? {
            heading: `This quote is ${Math.floor(Math.max(0, read.nowMs - (read.appliedAtMs ?? read.nowMs)) / 1000)}s old.`,
            body: 'If it expires, you get a new quote first.',
          }
        : state === 'expired'
          ? {
              heading:
                q && expiry(q.expireAt, read.nowMs) === 'expired'
                  ? 'This quote expired.'
                  : 'Get a new quote',
              body: 'Get a new quote first.',
            }
          : state === 'unconfirmed'
            ? {
                heading: 'Confirmation pending',
                body: read.failure ?? '',
              }
            : state === 'failed'
              ? (read.cautionOverride ?? {
                  heading:
                    read.failReason && read.failReason.kind !== 'blocked'
                      ? read.failReason.title
                      : 'That didn’t go through.',
                  body: read.failure ?? copy.swap.errorGeneric,
                })
              : state === 'off'
                ? { heading: copy.swap.disabled, body: '' }
                : null,
    costs: state === 'off' ? [] : costs,
    trailingCosts: state === 'off' ? [] : trailingCosts,
    total:
      state === 'off'
        ? null
        : {
            label: copy.swap.youReceive,
            value: q
              ? `${formatAtomicAmount(q.outAmount, read.receive.decimals)} ${q.receiveSymbol}`
              : '…',
          },
    bag: state === 'off' ? null : (read.bookEffect ?? null),
    afterSale: state === 'off' ? null : (read.afterSale ?? null),
    chart:
      state === 'off' || !read.chartMint
        ? null
        : { mint: read.chartMint, priceUsd: read.chartPriceUsd ?? null },
    chips: (read.chips ?? []).filter((chip) => chip.label.trim().length > 0),
    explain:
      state === 'off'
        ? null
        : {
            heading: "What I'm seeing",
            action: 'Explain',
            body: read.factsLine ?? null,
          },
    wait: state === 'off' || state === 'unconfirmed' ? 'Back' : 'Wait',
    sign:
      action === 'requote'
        ? 'Get a new quote'
        : action === 'addCash'
          ? 'Add cash'
          : action === 'retry'
            ? 'Try again'
            : state === 'signing'
              ? read.riskLeg === 'pay'
                ? 'Selling…'
                : 'Buying…'
              : read.riskLeg === 'pay'
                ? 'Sell'
                : 'Buy',
    action,
    disabled:
      action === 'sign' &&
      (state === 'quoting' ||
        state === 'signing' ||
        !read.canConfirm ||
        !!q?.feeDropped ||
        !hasUsableSwapCosts(q?.networkFeeLamports, q?.accountRentLamports) ||
        !read.confirmValid),
    waitDisabled: state === 'signing',
  };
}
