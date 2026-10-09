export const aiConsentCopy = {
  defaultTitle: "Corso's assistant uses Google",
  defaultBody:
    "To answer, Corso sends your question and a summary of your wallet to Google's Gemini: the names, amounts and dollar values of the tokens you hold. Never your wallet address or your keys. Google may keep it for a limited time to prevent abuse.",
  defaultAllow: 'Allow',
  defaultNotNow: 'Not now',
  defaultDeclinedAnswer:
    "That needs Corso's assistant, which uses Google. Ask again and tap Allow to turn it on.",

  connectedTitle: (brand: string) => `Send your questions to ${brand}?`,
  connectedBody1: (brand: string, company: string) =>
    `While ${brand} is picked, each question you ask goes from this phone to ${company}, with the names and amounts of the tokens you hold. Your wallet address, your keys and your dollar balances are never sent.`,
  connectedBody2: (company: string) =>
    `${company} handles this under your account and its own privacy policy, not Corso's. You can stop anytime in Your AI.`,
  connectedAllow: 'Allow',
  connectedDecline: "Don't allow",
  connectedOffLine: (brand: string) =>
    `${brand} is off until you allow it in Your AI.`,

  receivesLabel: 'What your AI receives:',
  receivesBody:
    'your question, plus the names and amounts of what you hold. Never your wallet keys, your address or your dollar balances.',
  receivesSheet: (brand: string, company: string) =>
    `${brand} will receive your question and the names and amounts of what you hold, sent from this phone to ${company}. Never your wallet keys, your address or your dollar balances.`,
} as const;
