export const composerCopy = {
  quickActions: {
    /** The row itself, for the screen reader. */
    groupA11y: 'Quick actions',
    skills: 'Skills',
    skillsA11y: 'Open the Skills marketplace',
    /** The four verbs. Each one puts its example into the ask field. */
    checkToken: 'Check a token',
    checkTokenFill: 'is BONK safe?',
    swap: 'Swap',
    swapFill: 'swap 2 SOL to USDC',
    moving: "What's moving",
    movingFill: "what's moving right now?",
    setRule: 'Set a rule',
    setRuleFill: 'set a rule: buy SOL dips under $130',
    /**
     * What a prefill chip actually does, so the label is not the only thing a
     * screen reader gets. The chips write into the field; they never send.
     */
    fillHint: 'Puts an example question in the ask field',
  },
} as const;
