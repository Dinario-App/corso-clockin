export const readRingCopy = {
  /** The eight check labels, in ring order (clockwise from 12). */
  checks: {
    mintAuthority: 'Can more be made',
    freezeAuthority: 'Can it be frozen',
    tokenExtensions: 'Token extensions',
    rugPulled: 'Pool emptied',
    top10Holders: 'Top-10 holders',
    devHolds: 'Dev holds',
    snipersInsiders: 'Launch bots and insiders',
    liquidityPool: 'Money in the pool',
  },
  values: {
    authorityNo: 'No',
    authorityYes: 'Yes',
    noneFlagged: 'None flagged',
    notFlagged: 'Not flagged',
    flagged: 'Flagged',
    /** Check 8, info. Only when `lifecycle === 'curve'`; never on null. */
    onCurve: 'On curve',
    delegate: 'Delegate',
    startsFrozen: 'Starts frozen',
    hook: 'Hook',
    nonTransferable: 'Cannot be sold',
    pausable: 'Can be paused',
    paused: 'Pause active',
    fee: (pct: string | null) => (pct == null ? 'Fee' : `Fee ${pct}`),
    /** Check 5's second line — Birdeye's largest-holder share, not the top 10. */
    topHolder: (pct: string) => `Top holder ${pct}`,
    insiders: (pct: string) => `Insiders ${pct}`,
    bundles: (pct: string) => `Bundles ${pct}`,
    snipers: (pct: string) => `Launch bots ${pct}`,
    lowLiquidity: (usd: string) => `Low ${usd}`,
    /** The cells of a read that did not answer at all. */
    notRead: 'Not read',
    unknown: 'Unknown',
  },
  /** Coverage counts the SOURCES that answered, never the values they carried. */
  coverage: (n: number) => `${n} of 8 checks done`,
  coverageShort: (n: number) => `${n} of 8 done`,
  notReadCount: (n: number) => `${n} not read`,
  /** Pinned equal to the api `SAFETY_FLAG_COPY.onchainReadUnavailable`. */
  onchainDidntRun: "The token record check didn't run",
  rugCheckDidntRun: "The Solana Tracker check didn't run",
  /** Pinned equal to the api `SAFETY_FLAG_COPY.checksUnavailable`. */
  checksDidntRun: "Checks didn't run",
  nothingCountedAsFine:
    "Nothing we couldn't read counts toward No flags found.",
  reasons: {
    green: (unknownCells: number) =>
      unknownCells === 0
        ? "8 checks done, nothing flagged. That's not a guarantee."
        : unknownCells === 1
          ? "Nothing flagged, but 1 check came back without a value. That's not a guarantee."
          : `Nothing flagged, but ${unknownCells} checks came back without a value. That's not a guarantee.`,
    caution: (n: number) =>
      n === 1
        ? '1 check found something worth reading before you trade.'
        : `${n} checks found something worth reading before you trade.`,
    danger: {
      freeze: 'Someone can freeze this token, including what you hold.',
      delegate:
        'Someone other than you can move or burn the tokens in your wallet.',
      mint: 'Someone can make more of this token.',
      defaultFrozen: 'New accounts for this token start frozen.',
      rugged: "Solana Tracker reports no money is left in this token's pool.",
      nonTransferable:
        'This token cannot be transferred. Whoever holds it cannot sell it or move it.',
      pausable:
        'Someone can pause this token and stop anyone from selling or moving it.',
      paused:
        "This token is paused right now. Nobody can sell or move it until it's unpaused.",
    },
    unread: "Our checks didn't run just now. This isn't a verdict.",
    partialCore:
      "The token record check ran. The Solana Tracker check didn't, so no verdict yet.",
    partialEnrichment:
      "The Solana Tracker check ran. The token record check didn't, so no verdict yet.",
    suffixRug: "The Solana Tracker check didn't run.",
    suffixOnchain: "The token record check didn't run.",
  },
  footnote:
    "Corso reads Solana's public records, Solana Tracker and market data. It doesn't check the team, their socials or what the creator does next. Information, not advice.",
  jupiterVerified: 'Jupiter verified',
  ringA11y: (read: number, flagged: number) =>
    read === 0
      ? '0 of 8 checks done.'
      : `${read} of 8 checks done. ${flagged} flagged.`,
  discoverShort: {
    top10: 'top-10',
    topHolder: 'top holder',
    dev: 'dev',
    snipers: 'launch bots',
    insiders: 'insiders',
    bundles: 'bundles',
    freeze: 'can be frozen',
    mint: 'more can be made',
    delegate: 'permanent delegate',
    startsFrozen: 'starts frozen',
    hook: 'extra transfer rules',
    fee: 'fee',
    nonTransferable: 'cannot be transferred',
    pausable: 'can be paused',
    paused: 'paused now',
    rugged: 'pool emptied',
    lp: 'pool',
    lowLiquidity: 'thin market',
  },
} as const;
