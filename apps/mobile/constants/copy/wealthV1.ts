export const wealthV1Copy = {
  welcome: {
    /** WM1 (`welcome.h1`). */
    line: 'Build your own portfolio.',
    /** WM2 (`welcome.sub`). */
    sub: 'Cash and crypto in one place, in a mix you choose.',
    /** `keep.promise` KEEP. */
    promise: 'Understand before you buy. Nothing moves without you.',
  },
  firstRun: {
    pickTitle: 'What do you want to own?',
    pickSub: 'Pick one to start.',
    pickNext: 'Next, you choose how much.',
    pickFoot: 'You can only buy coins on Corso’s list.',
    pickZec: { name: 'Zcash', wrapper: "Omni Bridge's Zcash token" },
    howRows: [
      /** OH3 (`how.1.*`). */
      {
        title: 'You choose the mix',
        body: 'Cash and crypto side by side. You decide what goes in, and how much.',
      },
      {
        title: 'Checks before you buy',
        body: 'See what the checks found, and why. Then you choose: Wait or Buy.',
      },
      {
        title: 'Nothing moves unless you sign',
        body: 'You see the price and every fee first. Then you sign, or you don’t.',
      },
    ] as const,
    howFoot: 'No leverage. No AI trading for you. No streaks.',
    fundTitle: 'Start small',
    fundSub:
      'Your portfolio starts with cash: dollars held as USDC. Add some now, or later.',
  },
  home: {
    crypto: 'Crypto',
    /** SM5 (`home.emptyCrypto`). */
    emptyCrypto: 'No crypto yet',
    gold: 'Gold',
    classNotYet: 'Not yet',
    doingTitle: 'How you’re doing',
    /** `doing.paid` OK. */
    doingPaid: 'You paid',
    /** `doing.worthNow` OK. */
    doingWorthNow: 'Worth now',
    /** `doing.unavailable` OK. */
    doingUnavailable: 'Unavailable',
    /** MX1 (`mix.title`). */
    mixTitle: 'Your mix',
    /** MX2 (`mix.legend`). */
    mixLegend: (label: string, percent: string) => `${label} ${percent}%`,
    mixUnavailable:
      'Mix unavailable. Some of what you hold has no price right now.',
  },
  asset: {
    waitNote: 'Nothing is bought.',
    waitHeadsUp: 'Tell me when the facts change',
  },
} as const;
