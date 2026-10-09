export const homeCopy = {
  checkMarketData: 'pulling market data',
  checkLiquidity: 'checking liquidity',
  checkHolders: 'scanning holder concentration',
  /** A landed answer with no backing read uses completed-tense visible copy. */
  checkMarketDataUnavailable: 'market data not read',
  checkLiquidityUnavailable: 'liquidity not read',
  checkHoldersUnavailable: 'holder concentration not read',
  /** What assistive tech reads for a check that is still running / done. */
  checkRunningA11y: (label: string) => `${label}, running`,
  checkDoneA11y: (label: string) => `${label}, done`,
  checkUnavailableA11y: (label: string) => `${label}, unavailable`,
  checkFoundMarket: (volume: string) => `${volume} 24h volume`,
  checkFoundLiquidity: (liquidity: string) => `${liquidity} liquidity`,
  checkFoundHolders: (count: string) => `${count} holders`,
  checkFoundTopTen: (pct: string) => `top 10 hold ${pct}`,
  thoughtFor: (seconds: number) => `Thought for ${seconds}s`,
  thoughtForA11y: (seconds: number) =>
    `Thought for ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`,
  thoughtRan: (count: number) =>
    `Ran ${count} ${count === 1 ? 'check' : 'checks'}`,

  answerReport: {
    open: 'Report this answer',
    title: 'Why are you reporting this answer?',
    note: 'The question you typed and the answer you got are sent with your report, so a person can review them. No account or wallet details are sent.',
    sending: 'Sending report…',
    sent: 'Report sent.',
    failed: 'Report could not be sent.',
    retry: 'Try again',
    close: 'Close answer report',
  },

  /** The threads panel's transparent tap-catcher (`AnchoredMenu` needs a name). */
  threadsDismissA11y: 'Close history',
  /** The account pill's menu catcher, for the same reason. */
  feedA11y: (count: number) => `${count} in your history`,
} as const;
