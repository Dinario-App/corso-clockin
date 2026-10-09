export const aiConnectCopy = {
  accountRow: {
    corso: 'Corso',
    connected: (brand: string) => `${brand} · connected`,
    needsSignIn: 'Needs a new sign in',
  },

  signInRows: {
    /** Shown only while `byoAiChatgptEnabled` is on. */
    chatgptCaption: 'Uses your ChatGPT account',
    /** Shown only while `byoAiGrokEnabled` is on. */
    grokCaption: 'Needs SuperGrok or X Premium+',
    claudeLabel: 'Add your Claude key',
    claudeCaption: 'Anthropic API key',
    claudeKeyHelp: 'Where do I find my key?',
  },

  deviceSheet: {
    thisPhone: (brand: string) =>
      `You are connecting Corso on this phone to your ${brand} account.`,
    chatgptPreStep:
      'First time? Turn on device code sign-in in ChatGPT: Settings, Security.',
    /** Primary white pill: copies the code AND opens the page, one tap. */
    copyAndOpen: (brand: string) => `Copy code and open ${brand}`,
    /** Beside `deviceExpired`, which stays verbatim. */
    newCode: 'Get a new code',
    grokPlanNeeded:
      'Grok sign-in needs SuperGrok or X Premium+. You can add an xAI key instead.',
    addXaiKey: 'Add an xAI key',
    success: (brand: string) =>
      `${brand} is connected. Your next question goes to ${brand} too.`,
    askAgain: (brand: string) => `Ask again with ${brand}`,
  },

  thread: {
    /** The label on the connected AI's block under Corso's answer. */
    take: (brand: string) => `${brand}'s take`,
    /** The action row: `Auto · 2.4s` / `ChatGPT · 2.4s`. `elapsed` arrives formatted. */
    attribution: (name: string, elapsed: string) =>
      `${name} · ${elapsed}`,
  },

  nudge: {
    body: "Want your own AI's take too? Connect ChatGPT, Grok or Claude.",
    cta: 'Connect',
    dismissA11y: 'Dismiss',
    /** Under Corso's own rate-limit line (`Too many at once. Give it a second.`). */
    rateLimitTail: 'Or connect your own AI.',
  },
} as const;

export const AI_CONNECT_VERIFY_ON_DEVICE = {
  'ai.deviceSheet.chatgptPreStep':
    "Verify the exact ChatGPT path (Settings, Security) on a real ChatGPT account before this ships. OpenAI's docs say only 'security settings'.",
} as const;
