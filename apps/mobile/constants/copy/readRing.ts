export const readRingCopy = {
  /** The eight check labels, in ring order (clockwise from 12). */
  checks: {
    mintAuthority: 'Mint authority',
    freezeAuthority: 'Freeze authority',
    tokenExtensions: 'Token extensions',
    rugPulled: 'Rug pulled',
    top10Holders: 'Top-10 holders',
    devHolds: 'Dev holds',
    snipersInsiders: 'Snipers & insiders',
    liquidityPool: 'Liquidity pool',
  },
  values: {
    renounced: 'Renounced',
    active: 'Active',
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
    snipers: (pct: string) => `Snipers ${pct}`,
    lowLiquidity: (usd: string) => `Low ${usd}`,
    /** The cells of a read that did not answer at all. */
    notRead: 'Not read',
    unknown: 'Unknown',
  },
  /** Coverage counts the SOURCES that answered, never the values they carried. */
  coverage: (n: number) => `${n} of 8 checks read`,
  coverageShort: (n: number) => `${n}/8 read`,
  notReadCount: (n: number) => `${n} not read`,
  /** Pinned equal to the api `SAFETY_FLAG_COPY.onchainReadUnavailable`. */
  onchainDidntRun: "On-chain read didn't run",
  rugCheckDidntRun: "Rug check didn't run",
  /** Pinned equal to the api `SAFETY_FLAG_COPY.checksUnavailable`. */
  checksDidntRun: "Checks didn't run",
  nothingCountedAsFine:
    "Nothing we couldn't read counts toward No flags found.",
  reasons: {
    green: (unknownCells: number) =>
      unknownCells === 0
        ? "8 checks read, nothing flagged. That's not a guarantee."
        : unknownCells === 1
          ? "Nothing flagged, but 1 check came back without a value. That's not a guarantee."
          : `Nothing flagged, but ${unknownCells} checks came back without a value. That's not a guarantee.`,
    caution: (n: number) =>
      n === 1
        ? '1 check found something worth reading before you trade.'
        : `${n} checks found something worth reading before you trade.`,
    danger: {
      freeze: 'Freeze authority is active. Whoever holds it can freeze your tokens.',
      delegate:
        'Someone other than you can move or burn the tokens in your wallet.',
      mint: 'Mint authority is active. Whoever holds it can create more of this token.',
      defaultFrozen: 'New accounts for this token start frozen.',
      rugged: 'Solana Tracker flags this token as rugged.',
      nonTransferable:
        'This token cannot be transferred. Whoever holds it cannot sell it or move it.',
      pausable:
        'A pause authority is active. Whoever holds it can stop anyone from selling or moving this token.',
      paused:
        'This token is paused right now. Nobody can sell it or move it until the authority lifts the pause.',
    },
    unread: "Our checks didn't run just now. This isn't a verdict.",
    partialCore:
      "The on-chain read ran. The rug check didn't, so no verdict yet.",
    partialEnrichment:
      "The rug check ran. The on-chain read didn't, so no verdict yet.",
    suffixRug: "The rug check didn't run.",
    suffixOnchain: "The on-chain read didn't run.",
  },
  footnote:
    "Corso reads on-chain data, Solana Tracker and market data. It doesn't check the team, their socials or what the creator does next. Information, not advice.",
  jupiterVerified: 'Jupiter verified',
  ringA11y: (read: number, flagged: number) =>
    read === 0
      ? '0 of 8 checks read.'
      : `${read} of 8 checks read. ${flagged} flagged.`,
  discoverShort: {
    top10: 'top-10',
    topHolder: 'top holder',
    dev: 'dev',
    snipers: 'snipers',
    insiders: 'insiders',
    bundles: 'bundles',
    freeze: 'freeze authority',
    mint: 'mint authority',
    delegate: 'permanent delegate',
    startsFrozen: 'starts frozen',
    hook: 'transfer hook',
    fee: 'fee',
    nonTransferable: 'cannot be transferred',
    pausable: 'can be paused',
    paused: 'paused now',
    rugged: 'flagged as rugged',
    lp: 'LP',
    lowLiquidity: 'low liquidity',
  },
} as const;
