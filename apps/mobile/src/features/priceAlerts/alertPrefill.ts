import { isValidPriceMint } from '../balances/priceSnapshot';
import {
  formatAtomicAmount,
  tokenForSymbol,
  SOL_MINT,
  USDC_MINT_MAINNET,
  type SwapToken,
} from '../swap/tokens';
import type { AssetPrefillPay } from '../swap/assetPrefill';
import type { OwnedAlert } from './alertClient';
import type { Direction } from './alertModel';
import { safeAlertSymbol } from './alertCopy';
export type AlertPrefill = {
  pay: AssetPrefillPay;
  receive: SwapToken;
  amount: string;
  rule: {
    mint: string;
    symbol: string;
    direction: Direction;
    thresholdPrice: string;
  };
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function token(
  mint: unknown,
  symbol: unknown,
  decimals: unknown,
): SwapToken | null {
  if (
    typeof mint !== 'string' ||
    !isValidPriceMint(mint, 'mainnet-beta') ||
    !safeAlertSymbol(symbol) ||
    !Number.isInteger(decimals) ||
    (decimals as number) < 0 ||
    (decimals as number) > 18
  )
    return null;
  if (mint === SOL_MINT && (symbol !== 'SOL' || decimals !== 9)) return null;
  if (mint === USDC_MINT_MAINNET && (symbol !== 'USDC' || decimals !== 6))
    return null;
  return { mint, symbol: symbol as string, decimals: decimals as number };
}
/** All-or-nothing local opening state. No notification payload or quote argument. */
export function resolveAlertPrefill(args: {
  alert: OwnedAlert;
  walletAddress: string;
  preset: unknown;
  fallbackToken?: SwapToken;
  nowMs: number;
}): AlertPrefill | null {
  const { alert, walletAddress, preset, nowMs } = args;
  if (
    alert.walletAddress !== walletAddress ||
    alert.state !== 'done' ||
    alert.firedAtMs === null ||
    alert.expiresAtMs <= nowMs
  )
    return null;
  if (preset === undefined) {
    const receive =
      args.fallbackToken &&
      token(
        args.fallbackToken.mint,
        args.fallbackToken.symbol,
        args.fallbackToken.decimals,
      );
    if (!receive || receive.mint !== alert.mint) return null;
    return {
      pay: {
        kind: 'symbol',
        symbol: receive.mint === USDC_MINT_MAINNET ? 'SOL' : 'USDC',
      },
      receive,
      amount: '',
      rule: {
        mint: alert.mint,
        symbol: receive.symbol,
        direction: alert.direction,
        thresholdPrice: alert.thresholdPrice,
      },
    };
  }
  if (
    !record(preset) ||
    preset.walletAddress !== walletAddress ||
    preset.mint !== alert.mint ||
    preset.cluster !== 'mainnet-beta' ||
    !record(preset.preset)
  )
    return null;
  const p = preset.preset;
  const pay = token(p.payMint, p.paySymbol, p.payDecimals);
  const receive = token(p.receiveMint, p.receiveSymbol, p.receiveDecimals);
  if (
    !pay ||
    !receive ||
    pay.mint === receive.mint ||
    (p.side !== 'buy' && p.side !== 'sell') ||
    (p.side === 'buy' ? receive.mint : pay.mint) !== alert.mint
  )
    return null;
  const symbol =
    pay.mint === SOL_MINT
      ? 'SOL'
      : pay.mint === USDC_MINT_MAINNET
        ? 'USDC'
        : null;
  if (p.side === 'buy' && !symbol) return null;
  let amount = '';
  if (p.inAmountAtomic !== null) {
    if (
      typeof p.inAmountAtomic !== 'string' ||
      !/^[1-9]\d{0,19}$/.test(p.inAmountAtomic) ||
      BigInt(p.inAmountAtomic) > 18446744073709551615n
    )
      return null;
    amount = formatAtomicAmount(p.inAmountAtomic, pay.decimals);
  }
  return {
    pay: symbol ? { kind: 'symbol', symbol } : { kind: 'held', token: pay },
    receive,
    amount,
    rule: {
      mint: alert.mint,
      symbol: p.side === 'buy' ? receive.symbol : pay.symbol,
      direction: alert.direction,
      thresholdPrice: alert.thresholdPrice,
    },
  };
}
export function alertIdFromNotification(data: unknown): string | null {
  return record(data) &&
    Object.keys(data).length === 1 &&
    typeof data.alertId === 'string' &&
    /^[A-Za-z0-9_-]{1,80}$/.test(data.alertId)
    ? data.alertId
    : null;
}
