import {
  SOL_MINT,
  formatAtomicAmount,
  usdcMintForCluster,
  type SwapToken,
  type SwapTokenSymbol,
} from './tokens.js';
import { copy } from '@/constants/copy';
import { SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS } from '@corso/wallet';

export type AskPrefillParams = {
  fromSymbol?: unknown;
  toSymbol?: unknown;
  toMint?: unknown;
  toDecimals?: unknown;
  inAmountAtomic?: unknown;
  amountGuard?: unknown;
  amountless?: unknown;
};

export type AskPrefill = {
  /** Always a symbol Corso holds a balance for. */
  paySymbol: SwapTokenSymbol;
  /** Exact server-resolved destination token. */
  receive: SwapToken;
  /**
   * Display units of the pay token, converted with exact integer maths.
   *
   * Empty string when the handoff carried no amount — the pair is preset and
   * the amount field is left as the composer's own resting state, where
   * `validateSwapForm` reads it as `Enter amount` and nothing quotes. See the
   * amount-less arm in `resolveAskPrefill`.
   */
  amount: string;
  /** Copy-system notice for the server-proven SOL reserve, when applicable. */
  notice?: string;
  sourceText?: string;
};

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function decimals(value: unknown): number | null {
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

function paySymbolFrom(value: unknown): SwapTokenSymbol | null {
  return value === 'SOL' || value === 'USDC' ? value : null;
}

export function resolveAskPrefill(args: {
  params: AskPrefillParams;
  cluster: 'devnet' | 'mainnet-beta';
  sourceText?: string | null;
}): AskPrefill | null {
  const { params, cluster } = args;

  const paySymbol = paySymbolFrom(params.fromSymbol);
  if (paySymbol === null) return null;

  const toMint = text(params.toMint);
  const toSymbol = text(params.toSymbol);
  const requestedDecimals = decimals(params.toDecimals);
  const inAmountAtomic = text(params.inAmountAtomic);
  if (toMint === null || toSymbol === null) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(toMint)) return null;
  if (toSymbol.length > 16) return null;

  const amountless = params.amountless === '1';
  // Both at once is incoherent: an amount, from a handoff that says it has none.
  if (amountless && params.inAmountAtomic !== undefined) return null;
  if (!amountless) {
    if (inAmountAtomic === null) return null;
    // Whole base units only. A decimal point here would mean somebody already
    // converted, and the conversion is exactly what must not happen twice.
    if (!/^[0-9]+$/.test(inAmountAtomic) || /^0+$/.test(inAmountAtomic)) {
      return null;
    }
  }

  const payToken = paySymbol === 'SOL'
    ? { symbol: 'SOL' as const, mint: SOL_MINT, decimals: 9 }
    : { symbol: 'USDC' as const, mint: usdcMintForCluster(cluster), decimals: 6 };

  const amountGuard = params.amountGuard;
  if (amountGuard !== undefined && amountless) return null;
  if (
    !amountless &&
    paySymbol === 'SOL' &&
    amountGuard !== 'sol-reserve'
  ) return null;
  if (paySymbol !== 'SOL' && amountGuard !== undefined) return null;

  if (toMint === payToken.mint) return null;

  const usdcMint = usdcMintForCluster(cluster);
  const receive: SwapToken | null =
      toMint === SOL_MINT
      ? requestedDecimals === null || requestedDecimals === 9
        ? { symbol: 'SOL', mint: SOL_MINT, decimals: 9 }
        : null
      : toMint === usdcMint
        ? requestedDecimals === null || requestedDecimals === 6
          ? { symbol: 'USDC', mint: usdcMint, decimals: 6 }
          : null
        : requestedDecimals === null
          ? null
          : { symbol: toSymbol, mint: toMint, decimals: requestedDecimals };
  if (receive === null) return null;

  let amount = '';
  if (!amountless) {
    try {
      amount = formatAtomicAmount(inAmountAtomic as string, payToken.decimals);
    } catch {
      return null;
    }
    if (amount.length === 0 || Number(amount) <= 0) return null;
  }

  const reserve = formatAtomicAmount(
    SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS.toString(),
    9,
  );
  // No amount, no reserve claim: the notice states what was subtracted from a
  // figure, and there is no figure yet.
  const notice = amountGuard === 'sol-reserve'
    ? copy.ask.solReserve(reserve)
    : undefined;
  const sourceText = text(args.sourceText);

  return {
    paySymbol,
    receive,
    amount,
    ...(notice ? { notice } : {}),
    ...(sourceText ? { sourceText } : {}),
  };
}
