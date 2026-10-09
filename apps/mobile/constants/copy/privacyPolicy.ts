export const D2_CONFIRMED = false as const;

export const GOOGLE_TRAINING_SENTENCE =
  "Corso uses Google's paid service, so Google does not use this to improve its products or to train its AI models, except the models it uses to catch abuse." as const;

export const GOOGLE_CONSENT_GATE_SHIPPED = true as const;

export const GOOGLE_CONSENT_SENTENCE =
  'Corso asks before your first question goes to Google.' as const;

export const CONNECTED_AI_CONSENT_GATE_SHIPPED = true as const;

export const CONNECTED_AI_CONSENT_SENTENCE =
  'Corso asks your permission before your first question goes to it.' as const;

const CONNECTED_AI_PARAGRAPH_BEFORE =
  'You can connect ChatGPT or Grok with your own account, or paste your own API key from OpenAI, Anthropic or xAI.';

const CONNECTED_AI_PARAGRAPH_TAIL =
  "each question goes from your phone straight to that company, with the names and amounts of up to 12 tokens you hold. It never receives your wallet address, your keys, your dollar balances or your transaction history. That company handles it under your account and its own privacy policy, not Corso's. Corso cannot see or delete what it keeps. Your sign-in or key is stored only on this phone.";

export function connectedAiParagraph(shipped: boolean): string {
  if (shipped) {
    return `${CONNECTED_AI_PARAGRAPH_BEFORE} ${CONNECTED_AI_CONSENT_SENTENCE} After that, while it is picked, ${CONNECTED_AI_PARAGRAPH_TAIL}`;
  }
  return `${CONNECTED_AI_PARAGRAPH_BEFORE} While it is picked, ${CONNECTED_AI_PARAGRAPH_TAIL}`;
}

export type PrivacyPolicyHrefKey = 'privacy' | 'delete' | 'supportEmail';

export type PrivacyPolicyInline =
  | { kind: 'text'; value: string }
  | { kind: 'link'; value: string; hrefKey: PrivacyPolicyHrefKey };

const INLINE_LINKS: { value: string; hrefKey: PrivacyPolicyHrefKey }[] = [
  { value: 'corso.trade/privacy', hrefKey: 'privacy' },
  { value: 'corso.trade/delete', hrefKey: 'delete' },
  { value: 'support@corso.trade', hrefKey: 'supportEmail' },
];

export function splitPrivacyPolicyInlines(text: string): PrivacyPolicyInline[] {
  const parts: PrivacyPolicyInline[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let best: {
      index: number;
      value: string;
      hrefKey: PrivacyPolicyHrefKey;
    } | null = null;
    for (const needle of INLINE_LINKS) {
      const index = remaining.indexOf(needle.value);
      if (index === -1) continue;
      if (best === null || index < best.index) {
        best = { index, value: needle.value, hrefKey: needle.hrefKey };
      }
    }
    if (best === null) {
      parts.push({ kind: 'text', value: remaining });
      break;
    }
    if (best.index > 0) {
      parts.push({ kind: 'text', value: remaining.slice(0, best.index) });
    }
    parts.push({ kind: 'link', value: best.value, hrefKey: best.hrefKey });
    remaining = remaining.slice(best.index + best.value.length);
  }
  return parts;
}

export const privacyPolicyCopy = {
  heading: 'Corso Privacy Policy, short version',

  intro:
    'Corso is published by Dinario Technologies Inc. The full policy is at corso.trade/privacy.',

  sections: [
    {
      id: 'never-receives',
      lead: 'What Corso never receives.',
      paragraphs: [
        'Your recovery phrase or private keys. If you sign in with email, Apple or Google, your wallet is provided by Privy, which holds its keys under its own policy. Corso cannot freeze or recover your funds, and cannot move them except within an allowance you have granted to a rule, on the token account that rule names, up to the cap you set.',
      ],
    },
    {
      id: 'wallet',
      lead: 'Your wallet.',
      paragraphs: [
        "To show balances, get swap quotes and send the transactions you approve, your public wallet address goes to Corso's servers and to the companies that provide Solana access and swap routing. Solana transactions are public and permanent. Nobody can delete them.",
      ],
    },
    {
      id: 'assistant',
      lead: "Corso's assistant uses Google.",
      paragraphs: [
        [
          "Some questions are answered by Corso's own rules. The rest are sent from Corso's servers to Google's Gemini API. Google receives your question and a summary of your wallet: the names, amounts and dollar values of up to 20 tokens you hold, and your total balance. Google never receives your wallet address, your keys or your token addresses. Google may keep this for a limited time to prevent abuse and to meet legal requirements.",
          ...(D2_CONFIRMED ? [GOOGLE_TRAINING_SENTENCE] : []),
        ].join(' '),
        ...(GOOGLE_CONSENT_GATE_SHIPPED ? [GOOGLE_CONSENT_SENTENCE] : []),
        "Please don't type personal details into a question.",
      ],
    },
    {
      id: 'own-ai',
      lead: 'Your own AI, if you connect one.',
      paragraphs: [connectedAiParagraph(CONNECTED_AI_CONSENT_GATE_SHIPPED)],
    },
    {
      id: 'keeps',
      lead: 'What Corso keeps.',
      paragraphs: [
        "Corso's servers do not save your questions or the answers. Your conversations are stored on this phone. The one exception is reporting: if you report an answer, Corso sends that question and answer to its own servers so a person can review them, and keeps them for as long as its service logs. Nothing is sent unless you choose to report it. Service logs are kept for 30 days. Usage analytics are on by default, and you can turn them off in Settings.",
      ],
    },
    {
      id: 'delete',
      lead: 'Delete your data.',
      bullets: [
        {
          lead: 'Delete everything',
          text: ' (in Account) deletes your sign-in account and removes the wallet from Corso. Move your money first.',
        },
        {
          lead: 'Remove from this phone',
          text: " (in Account, when you aren't signed in with email, Apple or Google) erases an imported recovery phrase, your conversations and your AI sign-ins from this phone, and disconnects a connected wallet. It deletes nothing on Corso's servers. Only your own backup brings an erased phrase back.",
        },
        {
          text: 'Remove a connected AI in Your AI. Press and hold a conversation to delete it.',
        },
        {
          text: 'Or ask at corso.trade/delete or support@corso.trade.',
        },
      ],
    },
  ],

  closing:
    'Corso is for people 18 and over in the United States. Questions: support@corso.trade.',
} as const;

function walkLeaves(node: unknown, into: string[]): void {
  if (typeof node === 'string') {
    into.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkLeaves(item, into);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'id') continue;
      walkLeaves(value, into);
    }
  }
}

export function privacyPolicyCopyLeaves(): string[] {
  const leaves: string[] = [];
  walkLeaves(privacyPolicyCopy, leaves);
  return leaves;
}

export function privacyPolicyPlainText(): string {
  return privacyPolicyCopyLeaves().join('\n');
}
