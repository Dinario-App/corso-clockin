export const deskUtilitiesCopy = {
  title: 'Desk utilities',
  lead: 'Tools from your broker account. Corso shows them. You act with your broker.',
  notLive: 'Preview. Not live yet.',
  optional: 'Optional',
  sections: {
    collateral: {
      title: 'Collateral and cash',
      body: 'What your broker holdings can back. Your broker lends, not Corso. Borrowing can be liquidated.',
    },
    hedge: {
      title: 'Hedges',
      body: 'Positions that offset others. Leveraged. Parked in this build.',
    },
    margin: {
      title: 'Margin health',
      body: "Your broker's numbers, with the time they were read.",
    },
    rfq: {
      title: 'Stock quotes',
      body: 'A real quote comes from your broker. Corso does not place the order.',
    },
  },
  footnote:
    'Corso shows this for you to review. It is not advice or a recommendation.',
} as const;
