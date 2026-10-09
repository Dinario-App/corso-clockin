import { copy } from '@/constants/copy';
import type {
  FiatTotalResult,
  HoldingsSnapshot,
} from '@/src/features/balances/computeFiatTotal';
import { formatAtomicAmount } from '@/src/features/swap/tokens';
import {
  formatFiatAmount,
  groupDecimalDigits,
} from '@/src/ui/format/numberCraft';

export type HomeHoldingChip = {
  mint: string;
  symbol: string;
  quantityText: string;
  fiatText: string;
  accessibilityLabel: string;
};

/**
 * Exact, mint-keyed presentation for Home's existing SOL / USDC chips.
 * Quantities never compact or round, and an absent fiat valuation stays absent.
 */
export function buildHomeHoldingChips(args: {
  holdings: HoldingsSnapshot | null;
  result: FiatTotalResult | null;
}): HomeHoldingChip[] {
  if (args.holdings?.quantityStatus !== 'ready') return [];

  return args.holdings.lines.flatMap((line) => {
    if (
      !line.includeInHomeTotal ||
      !/^\d+$/.test(line.atomic) ||
      BigInt(line.atomic) === 0n
    ) {
      return [];
    }

    const quantity = groupDecimalDigits(
      formatAtomicAmount(line.atomic, line.decimals),
    );
    if (quantity == null) return [];

    const fiatLine = args.result?.lines.find(
      (candidate) =>
        candidate.mint === line.mint && candidate.symbol === line.symbol,
    );
    const fiatText =
      fiatLine?.priced !== true || fiatLine.fiatAmount == null
        ? 'Price unknown'
        : (formatFiatAmount(fiatLine.fiatAmount) ??
          copy.home.balancePlaceholder);
    const quantityText = `${quantity} ${line.symbol}`;

    return [
      {
        mint: line.mint,
        symbol: line.symbol,
        quantityText,
        fiatText,
        accessibilityLabel: `${line.symbol}, ${quantityText}, ${fiatText}`,
      },
    ];
  });
}
