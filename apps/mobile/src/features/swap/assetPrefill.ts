import { copy } from '@/constants/copy';
import {
  SOL_MINT,
  tokenForSymbol,
  usdcMintForCluster,
  type SwapToken,
  type SwapTokenSymbol,
} from '@/src/features/swap/tokens';
import type { HeldSellDoor } from '@/src/features/swap/heldSellDoor';
import type { AcquireAccess } from '@/src/features/security/acquireAccessPresentation';

export type AssetSwapDirection = 'buy' | 'sell';

export type AssetPrefillParams = {
  direction?: unknown;
  mint?: unknown;
  symbol?: unknown;
  decimals?: unknown;
};

export type AssetPrefillPay =
  | Readonly<{ kind: 'symbol'; symbol: SwapTokenSymbol }>
  | Readonly<{ kind: 'held'; token: SwapToken }>;

export type AssetPrefill = {
  pay: AssetPrefillPay;
  receive: SwapToken;
};

/**
 * The money a held-token sell opens against.
 *
 * SOL rather than USDC: on Solana the long-tail mints this door exists for are
 * quoted against SOL, and a USDC-first default would meet "no route" on tokens
 * that route perfectly well. The receive picker changes it in one tap, and
 * nothing downstream reads this constant — it is an opening state.
 */
export const HELD_SELL_RECEIVE_SYMBOL: SwapTokenSymbol = 'SOL';

export type AssetSwapHref = {
  pathname: '/swap';
  params: {
    assetDirection: AssetSwapDirection;
    assetMint: string;
    assetSymbol: string;
    assetDecimals: string;
  };
};

export type AssetSwapAction = {
  direction: AssetSwapDirection;
  label: string;
  href: AssetSwapHref;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseDecimals(value: unknown): number | null {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d{1,2}$/.test(value)
        ? Number(value)
        : NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 18
    ? parsed
    : null;
}

function exactAsset(args: {
  params: AssetPrefillParams;
  cluster: 'devnet' | 'mainnet-beta';
}): SwapToken | null {
  const mint = text(args.params.mint);
  const symbol = text(args.params.symbol);
  const decimals = parseDecimals(args.params.decimals);
  if (
    mint == null ||
    symbol == null ||
    symbol.length > 16 ||
    decimals == null ||
    !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)
  ) {
    return null;
  }

  const usdcMint = usdcMintForCluster(args.cluster);
  if (mint === SOL_MINT && (symbol !== 'SOL' || decimals !== 9)) return null;
  if (mint === usdcMint && (symbol !== 'USDC' || decimals !== 6)) return null;

  return { mint, symbol, decimals };
}

/** The `/swap` route params an Asset door sends (`AssetSwapHref['params']`). */
export type AssetSwapRouteParams = {
  assetDirection?: string;
  assetMint?: string;
  assetSymbol?: string;
  assetDecimals?: string;
};

export function assetPrefillParamsFromSwapRoute(
  routeParams: AssetSwapRouteParams,
): AssetPrefillParams {
  return {
    direction: routeParams.assetDirection,
    mint: routeParams.assetMint,
    symbol: routeParams.assetSymbol,
    decimals: routeParams.assetDecimals,
  };
}

/**
 * Resolve an Asset-screen continuation into the existing supported composer.
 *
 * This is a preset, never execution authority. The exact mint, symbol and
 * decimals must all survive the route. Buy can target any validated mint;
 * Sell remains limited to SOL/USDC because those are the only balances the
 * composer reads and is allowed to spend.
 */
export function resolveAssetPrefill(args: {
  params: AssetPrefillParams;
  cluster: 'devnet' | 'mainnet-beta';
}): AssetPrefill | null {
  const direction = args.params.direction;
  if (direction !== 'buy' && direction !== 'sell') return null;

  const asset = exactAsset(args);
  if (asset == null) return null;

  const usdcMint = usdcMintForCluster(args.cluster);
  const assetPaySymbol: SwapTokenSymbol | null =
    asset.mint === SOL_MINT
      ? 'SOL'
      : asset.mint === usdcMint
        ? 'USDC'
        : null;

  if (direction === 'sell') {
    if (assetPaySymbol != null) {
      // SOL↔USDC, unchanged: the money selling the other money.
      const receiveSymbol: SwapTokenSymbol =
        assetPaySymbol === 'SOL' ? 'USDC' : 'SOL';
      return {
        pay: { kind: 'symbol', symbol: assetPaySymbol },
        receive: tokenForSymbol(receiveSymbol, args.cluster),
      };
    }
    return {
      pay: { kind: 'held', token: asset },
      receive: tokenForSymbol(HELD_SELL_RECEIVE_SYMBOL, args.cluster),
    };
  }

  const paySymbol: SwapTokenSymbol = assetPaySymbol === 'USDC' ? 'SOL' : 'USDC';
  return { pay: { kind: 'symbol', symbol: paySymbol }, receive: asset };
}

export function buildAssetSwapActions(args: {
  mint: string;
  symbol: string;
  decimals: number;
  cluster: 'devnet' | 'mainnet-beta';
  heldSell?: HeldSellDoor;
  acquireAccess: AcquireAccess;
}): AssetSwapAction[] {
  const params = {
    mint: args.mint,
    symbol: args.symbol,
    decimals: args.decimals,
  };
  const actions: AssetSwapAction[] = [];

  for (const direction of ['buy', 'sell'] as const) {
    const prefill = resolveAssetPrefill({
      params: { ...params, direction },
      cluster: args.cluster,
    });
    if (!prefill) continue;
    if (direction === 'buy' && args.acquireAccess.kind === 'refused') continue;
    // The held-sell gate: a held-token sell needs the book to have said yes.
    if (prefill.pay.kind === 'held' && args.heldSell?.kind !== 'eligible') {
      continue;
    }
    actions.push({
      direction,
      label: direction === 'buy' ? copy.assetDetail.buy : copy.assetDetail.sell,
      href: {
        pathname: '/swap',
        params: {
          assetDirection: direction,
          assetMint: args.mint,
          assetSymbol: args.symbol,
          assetDecimals: String(args.decimals),
        },
      },
    });
  }

  return actions;
}
