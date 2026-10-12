export const plainRiskCopy = {
  level: {
    /** `risk.level.green` */
    green: 'Low risk',
    /** `risk.level.amber` */
    amber: 'Watch out',
    /** `risk.level.red` */
    red: 'High risk',
    /** `risk.level.notEnoughData` † */
    notEnoughData: 'Not enough data',
    /** `risk.level.unavailable` */
    unavailable: 'Risk unavailable',
  },
  /** `risk.green.line`: under the green level. */
  greenLine: "Nothing flagged. That's not a guarantee.",
  sheet: {
    /** `risk.sheet.scope`: top of the risk sheet. */
    scope:
      "This checks how the token is built and traded. It doesn't predict the price.",
    /** `risk.sheet.checkedAt` † */
    checkedAt: (time: string) => `Checked ${time}`,
  },
  /** `risk.issuer.line`: curated assets only. */
  issuerLine: (issuer: string, powers: string) =>
    `Issued by ${issuer}, which can ${powers}.`,
  issuerPowers: {
    freeze: 'freeze it',
    supply: 'make more of it',
    both: 'freeze it and make more of it',
    move: 'take it from anyone who holds it',
    freezeMove: 'freeze it and take it from anyone who holds it',
    supplyMove: 'make more of it and take it from anyone who holds it',
    all: 'freeze it, make more of it and take it from anyone who holds it',
  },
  /** One statement per check, the good reading first. */
  check: {
    canSell: { ok: 'It can be sold.', flagged: 'It may not be sellable.' },
    supply: {
      ok: 'No more can be made.',
      flagged: 'More can still be made.',
    },
    freeze: { ok: "It can't be frozen.", flagged: 'It can be frozen.' },
    holders: {
      ok: 'Spread across many wallets.',
      flagged: 'A few wallets hold most of it.',
    },
    trading: {
      ok: 'Plenty of trading.',
      flagged: 'Not much trading. Prices can jump.',
    },
    /** `risk.check.empty`: a check that came back with no value. */
    empty: "We couldn't check this one.",
    delegate: 'It can be taken from anyone who holds it, without asking.',
  },
  otherFlag: 'Something else about how it is built or traded is flagged.',
  otherEmpty: "We couldn't run every check.",
} as const;
