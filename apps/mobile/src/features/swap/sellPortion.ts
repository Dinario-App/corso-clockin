import { copy } from '@/constants/copy';
import type { UsdcBalanceStatus } from '@/src/features/balances/useUsdcBalance';
import { applySwapPercentChip } from './swapPayBalance';
import {
  SOL_MINT,
  amountToAtomic,
  usdcMintForCluster,
  type SwapToken,
} from './tokens';
import type { PayBalance } from './validateSwap';

/** The portion chips already used by `applySwapPercentChip`. */
export const SELL_PORTIONS = [25, 50, 100] as const;
export type SellPortion = (typeof SELL_PORTIONS)[number];

const STILL_LOADING = new Set(['idle', 'loading']);

export function parseSellPortion(value: unknown): SellPortion | null {
  if (value === 25 || value === '25') return 25;
  if (value === 50 || value === '50') return 50;
  if (value === 100 || value === '100') return 100;
  return null;
}

/**
 * Display amount and the atomic the existing quote request already sends.
 * `validateSwapForm` turns the display into `atomicIn`. Nothing here builds
 * a new request field.
 */
export function sellPortionAmount(args: {
  pct: SellPortion;
  payToken: SwapToken;
  payBalance: PayBalance;
  usdc: { status: UsdcBalanceStatus; error: string | null };
}):
  | { kind: 'amount'; display: string; atomic: string }
  | { kind: 'error'; message: string } {
  const chip = applySwapPercentChip(args);
  if (chip.kind === 'error') return chip;
  const atomic = amountToAtomic(chip.amount, args.payToken.decimals);
  if (!atomic) {
    return {
      kind: 'error',
      message: copy.swap.notEnoughForSwap(args.payToken.symbol),
    };
  }
  return { kind: 'amount', display: chip.amount, atomic };
}

/** True while the pay channel can still arrive. A settled refusal is not pending. */
export function sellPortionPending(args: {
  payMint: string | null;
  cluster: 'devnet' | 'mainnet-beta' | null;
  solStatus: string;
  usdcStatus: string;
  holdingsStatus: string;
  factsStatus: string;
}): boolean {
  if (!args.payMint || !args.cluster) return true;
  if (args.payMint === SOL_MINT) return STILL_LOADING.has(args.solStatus);
  if (args.payMint === usdcMintForCluster(args.cluster)) {
    return STILL_LOADING.has(args.usdcStatus);
  }
  return (
    STILL_LOADING.has(args.holdingsStatus) ||
    STILL_LOADING.has(args.factsStatus)
  );
}

export function applySellPortionPreset(args: {
  portion: unknown;
  direction: unknown;
  payToken: SwapToken | null;
  payBalance: PayBalance;
  usdc: { status: UsdcBalanceStatus; error: string | null };
  pending: boolean;
  /** When set, wait until the pay mint is this sold mint. */
  expectedMint?: string | null;
}):
  | { kind: 'skip' }
  | { kind: 'wait' }
  | { kind: 'amount'; display: string; atomic: string }
  | { kind: 'error'; message: string } {
  const pct = parseSellPortion(args.portion);
  if (pct == null || args.direction !== 'sell') return { kind: 'skip' };
  if (
    !args.payToken ||
    args.pending ||
    (args.expectedMint != null && args.payToken.mint !== args.expectedMint)
  ) {
    return { kind: 'wait' };
  }
  return sellPortionAmount({
    pct,
    payToken: args.payToken,
    payBalance: args.payBalance,
    usdc: args.usdc,
  });
}

/** The href a major-detail portion tap pushes. The portion is the tapped pct. */
export function majorDetailSellPortionHref(
  sellHref: {
    pathname: '/swap';
    params: {
      assetDirection: string;
      assetMint: string;
      assetSymbol: string;
      assetDecimals: string;
    };
  },
  pct: SellPortion,
): {
  pathname: '/swap';
  params: {
    assetDirection: string;
    assetMint: string;
    assetSymbol: string;
    assetDecimals: string;
    assetSellPortion: string;
  };
} {
  return {
    pathname: sellHref.pathname,
    params: {
      ...sellHref.params,
      assetSellPortion: String(pct),
    },
  };
}

/**
 * The swap effect's preset arguments. The portion is the route's portion.
 * Callers pass the route object; they do not choose a fixed pct.
 */
export function sellPortionPresetArgs(route: {
  assetSellPortion: unknown;
  assetDirection: unknown;
  assetMint?: string | null;
}): {
  portion: unknown;
  direction: unknown;
  expectedMint: string | null;
} {
  return {
    portion: route.assetSellPortion,
    direction: route.assetDirection,
    expectedMint: route.assetMint ?? null,
  };
}

/**
 * The whole argument `applySellPortionPreset` receives. Portion, direction,
 * and the expected mint come from the route. Channel fields do not replace them.
 */
export function sellPortionPresetInput(
  route: {
    assetSellPortion: unknown;
    assetDirection: unknown;
    assetMint?: string | null;
  },
  channel: {
    payToken: SwapToken | null;
    payBalance: PayBalance;
    usdc: { status: UsdcBalanceStatus; error: string | null };
    pending: boolean;
  },
): {
  portion: unknown;
  direction: unknown;
  expectedMint: string | null;
  payToken: SwapToken | null;
  payBalance: PayBalance;
  usdc: { status: UsdcBalanceStatus; error: string | null };
  pending: boolean;
} {
  const fromRoute = sellPortionPresetArgs(route);
  return {
    portion: fromRoute.portion,
    direction: fromRoute.direction,
    expectedMint: fromRoute.expectedMint,
    payToken: channel.payToken,
    payBalance: channel.payBalance,
    usdc: channel.usdc,
    pending: channel.pending,
  };
}

/**
 * What the swap effect does with a preset. An error keeps its message.
 * Skip and wait leave the amount alone.
 */
export function sellPortionSettlement(
  preset:
    | { kind: 'skip' }
    | { kind: 'wait' }
    | { kind: 'amount'; display: string; atomic: string }
    | { kind: 'error'; message: string },
):
  | { applied: false }
  | { applied: true; display: string | null; message: string | null } {
  if (preset.kind === 'skip' || preset.kind === 'wait') {
    return { applied: false };
  }
  if (preset.kind === 'error') {
    return { applied: true, display: null, message: preset.message };
  }
  return { applied: true, display: preset.display, message: null };
}

export function majorSellPortionControls(symbol: string): readonly {
  pct: SellPortion;
  label: string;
  a11y: string;
  testID: string;
}[] {
  return SELL_PORTIONS.map((pct) => ({
    pct,
    label: copy.sellReview.portionLabel(pct),
    a11y: copy.sellReview.portionA11y(pct, symbol),
    testID: `major-detail-sell-${pct}`,
  }));
}
