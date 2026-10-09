import {
  trustedAskCopy,
  untrustedAskText,
  type AskText,
} from './textProvenance.js';
import type { AskHolding, ServerHolding } from './types.js';

export function formatAskNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 }).format(
    value,
  );
}

export function formatAtomicBaseUnits(
  baseUnits: bigint,
  decimals: number,
): string {
  const digits = baseUnits.toString().padStart(decimals + 1, '0');
  if (decimals === 0) return digits;
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

/** Fixed answers/chips extracted verbatim from the route and producer branches. */
export const askFixedCopy = {
  whichOne: 'Which one?',
  stalePrice:
    "I don't have a fresh price. Try an amount instead of a dollar figure.",
  buyOrSell: 'Buying or selling?',
  sideChips: ['Buy', 'Sell'],
  amountChips: ['Half', 'All of it'],
  exitPosition: 'Which position do you want to exit?',
  legChips: ['Up %', 'Down %'],
  movingUnavailable: "I can't see today's moves right now.",
  movingQuiet: 'Quiet day. Nothing you hold moved much.',
  sellWhich: 'Which one do you want to sell?',
};

/** User-facing Ask sentences live here rather than inside the route. */
export const askCopy = {
  vitalsIntro: (symbol: string) =>
    `Here's what the sources say about ${symbol}.`,
  vitalsWhich: (query: string) => `Which ${query}?`,
  unfundedTokenDetail: (symbol: string) =>
    `Open ${symbol}'s token page for identity and facts. You do not need to fund your wallet first.`,
  tokenDetail: (symbol: string) =>
    `Open ${symbol}'s token page for identity and facts.`,
  tokenFactsUnavailable: (symbol: string) =>
    `Token facts for ${symbol} are unavailable right now.`,
  holdingsUnavailable: "I can't see your holdings right now.",
  sellWhich: (symbols: readonly string[]): string =>
    symbols.length === 1 ? `Sell your ${symbols[0]}?` : askFixedCopy.sellWhich,
  amountInvalid: "I couldn't use that amount.",
  insufficientAmount(
    requested: string,
    balance: string,
    symbol: string,
  ): string {
    return `You asked to swap ${requested} ${symbol}. You have ${balance} ${symbol}.`;
  },
  noSpendable(args: {
    holding: ServerHolding;
    balance: bigint;
    reserve: bigint;
  }): string {
    const balance = formatAtomicBaseUnits(args.balance, args.holding.decimals);
    if (args.reserve > 0n) {
      const reserve = formatAtomicBaseUnits(
        args.reserve,
        args.holding.decimals,
      );
      return `You have ${balance} ${args.holding.symbol}. I leave ${reserve} ${args.holding.symbol} for network fees and token account rent, so there isn't a spendable amount.`;
    }
    return `You have ${balance} ${args.holding.symbol}, so there is no spendable ${args.holding.symbol} amount.`;
  },
  moving(holdings: readonly AskHolding[], moreHoldingsCount: number): string {
    const answer = movingCopy(holdings, moreHoldingsCount);
    return typeof answer === 'string' ? answer : answer.text;
  },
  portfolio(
    holdings: readonly ServerHolding[],
    totalUsd: number,
    unpricedHoldingsCount = 0,
    undisclosedHoldingsCount = 0,
  ): string {
    const lines = holdings.map(
      (holding) =>
        `${formatAskNumber(holding.amount)} ${holding.symbol} (${formatAskNumber(totalUsd > 0 ? (holding.usd / totalUsd) * 100 : 0)}%, $${formatAskNumber(holding.usd)})`,
    );
    const extra =
      undisclosedHoldingsCount > 0
        ? `and ${undisclosedHoldingsCount} more priced ${undisclosedHoldingsCount === 1 ? 'holding' : 'holdings'}`
        : '';
    const total =
      unpricedHoldingsCount > 0
        ? `Priced total $${formatAskNumber(totalUsd)} · ${unpricedHoldingsCount} ${unpricedHoldingsCount === 1 ? 'token' : 'tokens'} not priced.`
        : `Total $${formatAskNumber(totalUsd)}.`;
    const outside =
      totalUsd - holdings.reduce((sum, holding) => sum + holding.usd, 0);
    const valueCoverage =
      undisclosedHoldingsCount === 0 && outside > totalUsd * Number.EPSILON * 64
        ? ` Includes $${formatAskNumber(outside)} outside the listed balances.`
        : '';
    const named = [...lines, ...(extra ? [extra] : [])].join('; ');
    return named
      ? `${named}. ${total}${valueCoverage}`
      : `${total}${valueCoverage}`;
  },
};

/** Fixed branches retain catalog authority; interpolated market data stays untrusted. */
export function movingCopy(
  holdings: readonly AskHolding[],
  moreHoldingsCount: number,
): AskText {
  const withData = holdings.filter((h) => h.change24hPct != null);
  if (withData.length === 0)
    return trustedAskCopy({ catalog: 'askFixed', key: 'movingUnavailable' });

  const fullCoverage =
    withData.length === holdings.length && moreHoldingsCount === 0;
  // Under 0.05% renders as 0% — a token that flat is not a mover, and naming
  // it as one ("moved most — up 0%") would be a false figure, not a small one.
  const movers = withData.filter((h) => Math.abs(h.change24hPct!) >= 0.05);
  if (movers.length === 0) {
    // The quiet claim covers everything they hold, so it needs the full
    // picture; with holes in coverage the honest line is the unavailable one.
    if (fullCoverage)
      return trustedAskCopy({ catalog: 'askFixed', key: 'movingQuiet' });
    return trustedAskCopy({ catalog: 'askFixed', key: 'movingUnavailable' });
  }

  const seg = (h: AskHolding): string => {
    const change = h.change24hPct!;
    const pct = Math.abs(change).toFixed(1).replace(/\.0$/, '');
    return `${change < 0 ? 'down' : 'up'} ${pct}%`;
  };

  const sorted = [...movers].sort(
    (a, b) =>
      Math.abs(b.change24hPct!) - Math.abs(a.change24hPct!) ||
      b.usd - a.usd ||
      a.symbol.localeCompare(b.symbol),
  );
  const first = sorted[0]!;
  const second = sorted[1];

  if (holdings.length === 1 && moreHoldingsCount === 0) {
    return untrustedAskText(
      `${first.symbol} is ${seg(first)} today. It's all you hold.`,
    );
  }

  let answer = `${first.symbol} moved most of what you hold — ${seg(first)} today.`;
  if (second) answer += ` Then ${second.symbol}, ${seg(second)}.`;
  // "The rest moved less." is a claim about every unnamed holding, so it only
  // renders when every holding was measurable and at least one goes unnamed.
  const named = second ? 2 : 1;
  if (fullCoverage && holdings.length > named)
    answer += ' The rest moved less.';
  return untrustedAskText(answer);
}

export function sellWhichCopy(symbols: readonly string[]): AskText {
  return symbols.length === 1
    ? untrustedAskText(askCopy.sellWhich(symbols))
    : trustedAskCopy({ catalog: 'askFixed', key: 'sellWhich' });
}
