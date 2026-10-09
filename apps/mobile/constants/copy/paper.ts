export const paperCopy = {
  title: 'Paper bots',
  intro:
    'Run a bot rule over past prices with pretend money. Nothing is signed and no money moves.',
  heading: {
    token: 'Token',
    rule: 'Rule',
    size: 'Pretend money',
    limits: 'Limits',
    window: 'Look back',
  },
  tokenLabel: 'Token address',
  tokenHint: 'Paste a Solana token address. SOL is filled in.',
  tokenInvalid: 'That is not a Solana token address.',
  rules: {
    dip: 'Buy the dip',
    take_profit: 'Take profit',
    stop_loss: 'Stop loss',
    dca: 'DCA',
  } as const,
  param: {
    dropPct: 'Drop %',
    risePct: 'Rise %',
    everyHours: 'Every (hours)',
  },
  paramHint: {
    dropPct: 'vs the price when the run starts. 1 to 90.',
    risePct: 'vs the price when the run starts. 1 to 500.',
    everyHours: 'Hours between buys. 1 to 168.',
  },
  sizeUsd: 'Per swap (USD)',
  startingUsd: 'Starting balance (USD)',
  startingHint: {
    buy: 'Pretend dollars the bot can spend.',
    sell: 'Pretend holding, in dollars at the starting price.',
  },
  perDayMaxFires: 'Swaps per day',
  perDayMaxUsd: 'Daily cap (USD)',
  minOutBps: 'Slippage limit (bps)',
  minOutBpsHint:
    '100 bps = 1%. The simulation charges all of it on every swap.',
  windows: { 7: '7 days', 30: '30 days' } as const,
  run: 'Run on past prices',
  running: 'Running…',
  fieldInvalid: 'Check this number.',
  outcome: {
    disabled: 'Paper bots are not available right now.',
    unavailable: 'Price history is unavailable. Try again shortly.',
    no_data: 'Not enough price history for this token.',
    no_depth:
      'No fresh liquidity reading for this token, so there is nothing honest to simulate against.',
    unsupported_network: 'Paper bots run on Solana mainnet prices only.',
    failed: 'The simulation could not run. Try again.',
  },
  result: {
    banner: 'Simulation. Not a forecast.',
    bannerBody:
      'Real fills differ. This run is built to come out worse than a real bot, using the worst prices printed and today’s liquidity. It is a model, not a promise.',
    assumptionsHeading: 'What it assumed',
    model: {
      constant_product:
        'Model: a constant-product pool. Every swap moves the pool’s price against you, and the bigger the swap, the worse the price.',
    },
    assumptionFill:
      'Every swap fills at the worst price printed from the start of the bar where the rule fired, not the price that triggered it.',
    assumptionLatency: (minutes: number) =>
      `A bot lands after a delay, so each swap waits at least ${minutes} min of prices.`,
    assumptionSlippage: (bps: number) =>
      `Your full ${bps} bps slippage limit is charged on every swap.`,
    assumptionFee: (bps: number) =>
      `The Corso fee (${bps} bps) comes off every swap.`,
    assumptionDepth: (usd: string) =>
      `Each swap fills against a pool half the size of today’s reported liquidity (${usd}), so bigger swaps fill worse.`,
    assumptionMark: 'Anything still held is valued at the last low price.',
    notModelledHeading: 'What it cannot see',
    notModelled:
      'How thin the market was in the past, a route thinner than this model, dips that recovered inside one price bar, and swaps that would have failed.',
    summaryHeading: 'Result',
    start: 'Started with',
    end: 'Ended with',
    pnl: 'Change',
    held: (amount: string) => `${amount} tokens held`,
    firesHeading: 'Swaps',
    noFires: 'The rule never fired in this window.',
    buy: 'Buy',
    sell: 'Sell',
    filled: (usd: string, tokens: string, side: 'buy' | 'sell') =>
      side === 'buy'
        ? `Spent ${usd} for ${tokens} tokens`
        : `Sold ${tokens} tokens for ${usd}`,
    unfilled: {
      no_price_after_trigger: 'Missed: no price came in after it fired',
      insufficient_balance: 'Missed: not enough pretend balance',
    },
    stopped: 'Stopped: a daily limit was hit, as a real bot would stop.',
    thinData: 'Thin price history. Treat this run as rough.',
  },
} as const;
