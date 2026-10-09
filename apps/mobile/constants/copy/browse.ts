export const browseCopy = {
  tabsA11y: 'Discover or Watchlist',
  sort: {
    title: 'Sort by',
    short: {
      change24h: '24h',
      marketCap: 'Cap',
      liquidity: 'LP',
      risk: 'Risk',
    } as const,
    option: {
      change24h: '24h change',
      marketCap: 'Market cap',
      liquidity: 'Liquidity',
      risk: 'Risk',
    } as const,
    buttonA11y: (current: string) => `Sort by ${current}. Change the sort`,
    optionA11y: (label: string) => `Sort by ${label}`,
    close: 'Close sort',
  },
  watchlistSection: 'Watching',
  /** The stage chips that replaced the three-way segment inside Discover. */
  stageChipsA11y: 'Which pairs to show',
} as const;
