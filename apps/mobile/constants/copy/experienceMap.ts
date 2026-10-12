
const asOf = (clock: string) => `as of ${clock}`;

type ReasonCode =
  | 'cannot_sell'
  | 'mint_authority'
  | 'freeze_authority'
  | 'rugged'
  | 'no_liquidity'
  | 'permanent_delegate'
  | 'rugcheck_danger'
  | 'other_hard'
  | 'holders_concentrated'
  | 'thin_liquidity'
  | 'low_liquidity'
  | 'rugcheck_warning'
  | 'pausable'
  | 'transfer_hook'
  | 'transfer_fee'
  | 'lp_lock'
  | 'dev_share'
  | 'insider_cluster'
  | 'sniper_share'
  | 'bundler_share'
  | 'other_soft';

export const experienceMapCopy = {
  glance: {
    today: {
      up: 'Up today',
      down: 'Down today',
      steady: 'Little changed today',
    },
    unavailable: {
      changeToday: 'Change today unavailable',
      price: 'Price unavailable',
      mood: 'Mood unavailable',
      holders: 'Holders unavailable',
    },
    mood: {
      extreme_fear: 'Very nervous',
      fear: 'Nervous',
      neutral: 'Calm',
      greed: 'Upbeat',
      extreme_greed: 'Very upbeat',
    },
    moodSource: 'alternative.me',
    holders: {
      widelyHeld: 'Widely held',
      topTen: (share: string) => `Top 10 hold ${share}`,
    },
    youHold: (money: string) => `You hold ${money}`,
    highRisk: (n: number) => `${n} high risk`,
    cantBeChecked: (n: number) => `${n} can't be checked`,
    alertsWentOff: (n: number) =>
      n === 1 ? '1 alert went off' : `${n} alerts went off`,
    updated: (clock: string) => `Updated ${clock}`,
    asOf: (clock: string) => `As of ${clock}`,
  },

  read: {
    nothingToRead: "We can't read this one right now.",
    risk: {
      high: (reason: string | null) =>
        reason ? `high risk: ${reason}` : 'high risk',
      watch: (reason: string | null) =>
        reason ? `watch out: ${reason}` : 'watch out',
      notEnough: 'not enough data to check it',
      unavailable: 'risk check unavailable',
      low: 'nothing flagged',
    },
    reasons: {
      cannot_sell: 'it may not be sellable',
      mint_authority: 'more of it can still be made',
      freeze_authority: 'it can be frozen',
      rugged: 'no money is left in its pool',
      no_liquidity: 'no money is left in its pool',
      permanent_delegate: 'someone else can move it out of any wallet',
      rugcheck_danger: 'an outside check raised a danger flag',
      other_hard: null,
      holders_concentrated: (share: string) =>
        `the top 10 wallets hold ${share}`,
      thin_liquidity: 'not much money in its pool',
      low_liquidity: 'not much money in its pool',
      rugcheck_warning: 'an outside check raised a warning flag',
      pausable: 'it can be paused, which stops all trading',
      transfer_hook: 'it has extra transfer rules',
      transfer_fee: 'it takes its own fee each time it moves',
      lp_lock: 'money in its pool can be taken out',
      dev_share: 'the wallet that made it holds a large share',
      insider_cluster: 'linked wallets hold a large share',
      sniper_share: 'launch buyers took a large share',
      bundler_share: 'launch buyers took a large share',
      other_soft: null,
    } satisfies Record<ReasonCode, string | null | ((share: string) => string)>,
    position: {
      held: (money: string) => `you hold ${money}`,
      heldWithShare: (money: string, share: string) =>
        `you hold ${money}, ${share} of your money`,
      /** Item 3: only where a cost is known; otherwise the clause drops. */
      up: (money: string) => `you're up ${money} on what you paid`,
      down: (money: string) => `you're down ${money} on what you paid`,
    },
    price: {
      upToday: (pct: string) => `up ${pct} today`,
      downToday: (pct: string) => `down ${pct} today`,
      steadyToday: 'little changed today',
      upWeek: (pct: string) => `up ${pct} this week`,
      downWeek: (pct: string) => `down ${pct} this week`,
      nearMonthHigh: 'near its high for the month',
      nearMonthLow: 'near its low for the month',
    },
    moodWords: {
      extreme_fear: 'very nervous',
      fear: 'nervous',
      neutral: 'calm',
      greed: 'upbeat',
      extreme_greed: 'very upbeat',
    },
    mood: (word: string) => `crypto mood is ${word}`,
    holdersConcentrated: (share: string) => `the top 10 wallets hold ${share}`,
    liquidityThin: 'not much money in its pool',
    flow: {
      moreBuying: 'more buying than selling today',
      moreSelling: 'more selling than buying today',
    },
    /** Appended when any included clause is past its freshness bound. */
    staleSuffix: (clock: string) => ` As of ${clock}.`,
    /** Appended after a sentence with "nothing flagged" where no risk tile renders. */
    notGuaranteeSuffix: " That's not a guarantee.",
  },

  brief: {
    book: {
      up: (money: string) => `Your money is up ${money} today.`,
      down: (money: string) => `Your money is down ${money} today.`,
      steady: 'Your money is little changed today.',
      unavailable: 'Change today unavailable.',
    },
    mood: (word: string) => `Crypto mood is ${word}.`,
    mover: (asset: string, direction: 'up' | 'down', pct: string) =>
      `Of what you hold, ${asset} moved the most: ${direction} ${pct}.`,
    highRisk: (n: number) =>
      n === 1
        ? '1 thing you hold is high risk.'
        : `${n} things you hold are high risk.`,
    cantCheck: (n: number) =>
      n === 1
        ? "We can't check the risk on 1 thing you hold right now."
        : `We can't check the risk on ${n} things you hold right now.`,
    alertAbove: (asset: string, price: string, clock: string) =>
      `${asset} went above ${price} at ${clock}.`,
    alertBelow: (asset: string, price: string, clock: string) =>
      `${asset} went below ${price} at ${clock}.`,
  },

  showDetails: {
    label: 'Show details',
    body: 'See the numbers behind what we show, like price shift and holder count.',
    row: 'Details',
  },

  detail: {
    beforeYouConfirmed: (clock: string) => `Before you confirmed · ${clock}`,
    sinceYesterday: (signedPct: string) =>
      `${signedPct} since this time yesterday`,
    moodScore: (score: number, clock: string) =>
      `${score} of 100 · alternative.me · ${asOf(clock)}`,
    holders: (count: string, share: string) =>
      `${count} holders · top 10 hold ${share}`,
    position: (amount: string, ticker: string, share: string) =>
      `${amount} ${ticker} · ${share} of your money`,
    /** Y8a: the desk Price tile's sub-line. */
    dayRange: (low: string, high: string) => `Today ${low} – ${high}`,
    /** Y8b: its own Detail-sheet row. */
    week: (signedPct: string) => `Week ${signedPct}`,
    /** Y8c: its own Detail-sheet row. */
    monthHigh: (price: string) => `Month high ${price}`,
    checksRan: (ran: number, total: number, time: string) =>
      ran === total && total > 0
        ? `${total} checks ran · Checked ${time}`
        : `${ran} of ${total} checks ran · Checked ${time}`,
    mover: (asset: string, signedPct: string) => `${asset} ${signedPct}`,
    moverUnavailable: (asset: string) => `${asset} unavailable`,
    cashMover: (signedPct: string) => `Cash (USDC) ${signedPct}`,
    cashMoverUnavailable: 'Cash (USDC) unavailable',
    thenNow: {
      buy: (signedPct: string, paidAt: string, nowAt: string) =>
        `${signedPct} · paid at ${paidAt} · now ${asOf(nowAt)}`,
      sell: (signedPct: string, soldAt: string, nowAt: string) =>
        `${signedPct} · sold at ${soldAt} · now ${asOf(nowAt)}`,
    },
    whenYouConfirmed: 'when you confirmed',
    atTheTime: (money: string) => `About ${money} at the time`,
    fromSolana: (clock: string) => `From the Solana network · ${clock}`,
    thenAndNowTitle: 'Then and now',
  },

  riskSheet: {
    outsideDanger: 'RugCheck raised a danger flag.',
    outsideWarning: 'RugCheck raised a warning flag.',
  },
} as const;
