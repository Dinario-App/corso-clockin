import { copy } from '@/constants/copy';
import { resolveActivityListRow } from '@/src/features/activity/activityLabels';
import { formatActivityAmount } from '@/src/features/activity/formatActivityAmount';
import {
  formatActivityTime,
  groupActivityByDay,
} from '@/src/features/activity/groupByDay';
import { resolveActivityListChrome } from '@/src/features/activity/activityRoutePresentation';
import type { ActivityItem } from '@/src/features/activity/types';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { colors } from '@/src/ui/tokens';

export type MoneyTokenSymbol = 'SOL' | 'USDC';

/** Money in or out of Activity stays ink. Sage/dust are price movement only. */
export const MONEY_ACTIVITY_AMOUNT_COLOR = colors.ink;

export function resolveMoneyActivityChrome(args: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  itemCount: number;
}) {
  return resolveActivityListChrome({
    status: args.status === 'idle' ? 'loading' : args.status,
    itemCount: args.itemCount,
    filteredCount: args.itemCount,
    filter: 'all',
  });
}

/**
 * Provenance for the Activity row's secondary line.
 *
 * SOL system transfers carry a counterparty address and render it truncated
 * (`3D9f…eofc`). Pure USDC rows never get a counterparty from classify, so this
 * used to fall back to the word `Transaction` — a different kind of line on
 * the same list. When there is no counterparty, show the truncated signature
 * instead. Same shape, full id still on the detail screen.
 */
export function moneyActivityCounterparty(item: ActivityItem): string {
  if (item.counterparty) return truncateAddress(item.counterparty);
  return truncateAddress(item.signature);
}

export function moneyActivityTime(item: ActivityItem): string {
  return formatActivityTime(item.blockTimeMs) || 'Earlier';
}

export function resolveMoneyActivityRows(items: ActivityItem[]) {
  return groupActivityByDay(items).map((group) => ({
    key: group.key,
    label: group.label,
    rows: group.items.map((item) => ({
      signature: item.signature,
      presentation: resolveActivityListRow(item, {
        amount: formatActivityAmount(item),
        counterparty: moneyActivityCounterparty(item),
        time: moneyActivityTime(item),
      }),
    })),
  }));
}

export function resolveMoneyTokenSheet(args: {
  symbol: MoneyTokenSymbol;
  amountLabel: string;
}) {
  return {
    title: args.symbol,
    amountLabel: args.amountLabel,
    holdHint: copy.v1.youHoldThis,
    amountColor: colors.ink,
  };
}
