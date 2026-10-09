const aiBeatBody = {
  signInChatgptAndGrok:
    "Corso answers on its own. Sign in with ChatGPT or Grok, or add a Claude key, to get your AI's take too.",
  signInChatgpt:
    "Corso answers on its own. Sign in with ChatGPT, or add a Claude key, to get your AI's take too.",
  signInGrok:
    "Corso answers on its own. Sign in with Grok, or add a Claude key, to get your AI's take too.",
  keysOnly:
    "Corso answers on its own. Add your own OpenAI, Anthropic or xAI key to get your AI's take too.",
} as const;

const beats = {
  ask: {
    headline: 'Check a token first.',
    body: 'See its risk signals before you buy.',
  },
  verdict: {
    headline: 'Get a straight answer.',
    body: 'A verdict with its reasons: who holds it, whether the liquidity is locked, what the chart is doing.',
  },
  sign: {
    headline: 'Nothing moves without you.',
    body: 'Corso sets up the swap. You review it and slide to sign.',
  },
  bots: {
    headline: 'Bots follow your rules.',
    body: 'Set a rule like buy on a 10% dip. Pause or stop it any time.',
  },
  ai: {
    headline: 'Bring your own AI.',
    body: aiBeatBody,
  },
} as const;

export const howItWorksCopy = {
  title: 'How Corso works',

  skip: 'Skip',
  next: 'Next',
  /** Every beat's fixture caption, so no demo value reads as a live quote. */
  example: 'Example',
  startAsking: 'Go to Home',
  /** Beat 5 only, beside `Go to Home`. → `/profile/ai`, then Home. */
  connectAi: 'Connect your AI',
  exampleAsk: 'is WIF safe?',
  beats,

  replay: 'Replay the intro',
  basicsHeading: 'The basics',
  /**
   * Section heads. Each body is the matching intro beat's body, so the page
   * and the intro say one thing in one voice. `botsAndRules` only when
   * `botsEnabled`; `yourAi` only when `byoAiEnabled`.
   */
  basics: {
    ask: { head: 'Ask', body: beats.ask.body },
    verdicts: { head: 'Verdicts', body: beats.verdict.body },
    reviewAndSign: { head: 'Review and sign', body: beats.sign.body },
    botsAndRules: { head: 'Bots and rules', body: beats.bots.body },
    yourAi: { head: 'Your AI', body: aiBeatBody },
  },
  questionsHeading: 'Questions',
  /** Each question is a row that opens a solid sheet with its answer. */
  questions: {
    verdictSources: {
      question: 'Where do verdicts come from?',
      answer:
        'On-chain reads for mint and freeze authority, RugCheck for the liquidity lock, and Birdeye for holders. Each reason shows where it came from.',
    },
    riskScale: {
      question: 'What does Risk 2/10 mean?',
    },
    withoutYou: {
      question: 'Can Corso swap without me?',
      answer: 'No. You review and sign every swap you make.',
      /** Appended only when `botsEnabled`. */
      answerBots: 'Bots only run rules you set and signed.',
    },
    aiSees: {
      question: 'What does my AI see?',
      answer:
        'Your question, plus the names and amounts of what you hold. Never your wallet keys or your address. Your AI sign-in or key is stored only on this phone.',
    },
    aiSwaps: {
      question: 'Can my AI make a swap?',
      answer: 'No. It can only suggest. Corso shows its words and nothing else.',
    },
    cost: {
      question: 'Does using my AI cost anything?',
      answerSignIn:
        "Signing in uses your own account's limits. An API key is billed to you by OpenAI, Anthropic or xAI. Corso adds no charge for using your AI.",
      /** When both sign-in switches are off (a kill-switch state). */
      answerKeysOnly:
        'An API key is billed to you by OpenAI, Anthropic or xAI. Corso adds no charge for using your AI.',
    },
  },
} as const;
