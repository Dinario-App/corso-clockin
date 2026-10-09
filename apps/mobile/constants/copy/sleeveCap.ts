export const sleeveCapCopy = {
  editCap: 'Edit cap',
  underCap: 'Under cap',
  atCap: 'At cap',
  ofTotal: (n: string) => `${n}% of total`,
  leftUnderCap: (amount: string) => `${amount} left under your cap`,
  pausedTitle: 'New buys are paused',
  pausedBody: 'The cap never sells or rebalances. It only pauses new buys.',
  overByPrice:
    "Your Everything else is over its cap. The cap doesn't sell anything.",
  capSheetLower: 'Lowering the cap never sells anything.',
  emptyLine:
    'Tokens outside Cash and Majors live here, under a cap you can change.',
  raiseCap: 'Raise cap',
  confirm: 'Confirm',
  seeHoldings: 'See your holdings',
  walletUnavailable: "Buying this token isn't available for this wallet.",
} as const;
