import type { HoldingsSnapshot } from '@/src/features/balances/computeFiatTotal';
import { formatAtomicAmount } from '@/src/features/swap/tokens';
import { copy } from '@/constants/copy';
import type { HomeAskPhase } from './homeEmptyPresentation';

export type SuggestedAsk = {
  id: string;
  label: string;
  action: 'ask' | 'fund';
};

type AskActions = {
  setAsk(text: string): void;
  runAsk(text: string): Promise<void>;
  openFund(): void;
};

const EMPTY_SUGGESTIONS: SuggestedAsk[] = [
  { id: 'moving', label: copy.v1.whatsMoving, action: 'ask' },
  { id: 'fund', label: copy.v1.addMoneyThenAsk, action: 'fund' },
];

/** Suggestions are composed only from confirmed Home holdings and fixed copy. */
export function buildSuggestedAsks(args: {
  holdings: HoldingsSnapshot | null;
  askPhase: HomeAskPhase;
}): SuggestedAsk[] {
  if (args.askPhase !== 'idle' || args.holdings?.quantityStatus !== 'ready') {
    return [];
  }

  const positive = args.holdings.lines.filter(
    (line) =>
      line.includeInHomeTotal &&
      /^\d+$/.test(line.atomic) &&
      BigInt(line.atomic) > 0n,
  );
  if (positive.length === 0) return EMPTY_SUGGESTIONS;

  const sol = positive.find((line) => line.symbol === 'SOL');
  const nonSol = positive
    .filter((line) => line.symbol !== 'SOL')
    .sort((a, b) => compareTokenAmounts(b, a));
  const swaps: SuggestedAsk[] = sol
    ? nonSol.slice(0, 2).flatMap((line) => {
        const atomic = BigInt(line.atomic);
        const spendAtomic = atomic / 2n || atomic;
        const amount = formatAtomicAmount(spendAtomic.toString(), line.decimals);
        if (!amount || amount === '0') return [];
        return [{
          id: `swap:${line.mint}`,
          label: `Swap ${amount} ${line.symbol} to SOL`,
          action: 'ask' as const,
        }];
      })
    : [];

  return [
    ...swaps,
    { id: 'moving', label: copy.v1.whatsMoving, action: 'ask' as const },
  ].slice(0, 2);
}

export function suggestedChipFits(args: {
  x: number;
  width: number;
  rowWidth: number;
}): boolean {
  return args.x + args.width <= args.rowWidth + 1;
}

export function activateSuggestedAsk(
  chip: SuggestedAsk,
  actions: AskActions,
): void {
  if (chip.action === 'fund') {
    actions.openFund();
    return;
  }
  actions.setAsk(chip.label);
  void actions.runAsk(chip.label);
}

function compareTokenAmounts(
  left: HoldingsSnapshot['lines'][number],
  right: HoldingsSnapshot['lines'][number],
): number {
  const scale = Math.max(left.decimals, right.decimals);
  const leftScaled = BigInt(left.atomic) * 10n ** BigInt(scale - left.decimals);
  const rightScaled = BigInt(right.atomic) * 10n ** BigInt(scale - right.decimals);
  if (leftScaled === rightScaled) return left.symbol.localeCompare(right.symbol);
  return leftScaled > rightScaled ? 1 : -1;
}
