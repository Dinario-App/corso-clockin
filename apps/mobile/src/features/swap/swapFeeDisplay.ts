import type { FeeBpsStatus } from '@/src/lib/apiConfig';
import { feeBpsOrNullFromStatus } from '@/src/lib/apiConfig';
import { copy } from '@/constants/copy';
import type { SwapOrderResponse } from '@/src/features/swap/swapApi';
import {
  feeBpsToPercentLabel,
  resolveDisplayCorsoFeeBps,
  tokenForSymbol,
} from '@/src/features/swap/tokens';

type Cluster = 'devnet' | 'mainnet-beta';

export type SwapFeeQuote = Pick<
  SwapOrderResponse,
  | 'corsoFeeBps'
  | 'feeMint'
  | 'platformFeeAmount'
  | 'inputMint'
  | 'inAmount'
  | 'outputMint'
  | 'outAmount'
>;

export type SwapFeeDisplay =
  /** A sourced fee, plus a quote-derived dollar value when one is provable. */
  | { kind: 'fee'; bps: number; usdMicro: bigint | null }
  /** The config fetch has not settled yet. Render the same `'…'` as Route. */
  | { kind: 'resolving' }
  /** Asked and cannot say. Render the placeholder, and it has been reported. */
  | { kind: 'unavailable' };

export function resolveSwapFeeDisplay(
  orderOrFeeBps: SwapFeeQuote | number | null | undefined,
  configFee: FeeBpsStatus | null,
  cluster?: Cluster | null,
): SwapFeeDisplay {
  const order =
    typeof orderOrFeeBps === 'object' && orderOrFeeBps !== null
      ? orderOrFeeBps
      : null;
  const orderFeeBps: number | null = order
    ? order.corsoFeeBps
    : typeof orderOrFeeBps === 'number'
      ? orderOrFeeBps
      : null;
  if (orderFeeBps != null) {
    // Validated, not trusted: a malformed order fee still fails closed rather
    // than inventing a label. Passing `null` as the fallback guarantees the
    // config cannot be consulted on this path even by accident.
    const bps = resolveDisplayCorsoFeeBps(orderFeeBps, null);
    if (bps == null) return { kind: 'unavailable' };
    return {
      kind: 'fee',
      bps,
      usdMicro:
        bps > 0 && order && cluster
          ? deriveFeeUsdMicro(order, tokenForSymbol('USDC', cluster).mint)
          : null,
    };
  }
  if (configFee === null) return { kind: 'resolving' };
  const bps = resolveDisplayCorsoFeeBps(null, feeBpsOrNullFromStatus(configFee));
  return bps == null
    ? { kind: 'unavailable' }
    : { kind: 'fee', bps, usdMicro: null };
}

function atomicAmount(value: string | null): bigint | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

/**
 * Price the quote's exact fee through its own USDC leg. All inputs and output
 * stay atomic integers; the one division is last and rounds half up.
 */
function deriveFeeUsdMicro(
  order: SwapFeeQuote,
  usdcMint: string,
): bigint | null {
  const fee = atomicAmount(order.platformFeeAmount);
  if (fee == null || fee <= 0n || order.feeMint == null) return null;
  if (order.feeMint === usdcMint) return fee;

  let tokenAmount: bigint | null = null;
  let usdcAmount: bigint | null = null;
  if (order.feeMint === order.inputMint && order.outputMint === usdcMint) {
    tokenAmount = atomicAmount(order.inAmount);
    usdcAmount = atomicAmount(order.outAmount);
  } else if (
    order.feeMint === order.outputMint &&
    order.inputMint === usdcMint
  ) {
    tokenAmount = atomicAmount(order.outAmount);
    usdcAmount = atomicAmount(order.inAmount);
  }

  if (tokenAmount == null || tokenAmount <= 0n || usdcAmount == null) {
    return null;
  }
  return (2n * fee * usdcAmount + tokenAmount) / (2n * tokenAmount);
}

/** Render the fee row without retaining anything from a previous quote. */
export function formatSwapFeeDisplayValue(display: SwapFeeDisplay): string {
  switch (display.kind) {
    case 'resolving':
      return '…';
    case 'unavailable':
      return copy.home.balancePlaceholder;
    case 'fee': {
      const percent = feeBpsToPercentLabel(display.bps);
      if (
        display.bps === 0 ||
        display.usdMicro == null ||
        display.usdMicro < 0n
      ) {
        return percent;
      }

      const cents = (display.usdMicro + 5_000n) / 10_000n;
      const usd =
        cents === 0n
          ? copy.swap.corsoFeeUnderCent
          : `$${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
      return copy.swap.corsoFeeValueWithUsd(usd, percent);
    }
  }
}
