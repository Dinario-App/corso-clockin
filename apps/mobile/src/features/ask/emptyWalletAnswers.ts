import { trustedCopy, type TrustedCopy } from './askText';

const TRENDING = /\btrending\b/i;
const MOVING_HERO = /^(what'?s|whats|what is) moving\??$/i;

const TOKEN = '\\$?([A-Za-z][A-Za-z0-9._-]{1,15})';
const IDENTITY_SHAPES = [
  new RegExp(
    `^(?:what(?:'s|’s| is| are)|who(?:'s|’s| is))\\s+(?:the\\s+)?${TOKEN}(?:\\s+token)?[?!.]*$`,
    'i',
  ),
  new RegExp(
    `^(?:tell me about|what about|look at|look into|explain)\\s+(?:the\\s+)?${TOKEN}[?!.]*$`,
    'i',
  ),
];
const TOKEN_SAFETY_SHAPES = [
  new RegExp(
    `^is\\s+${TOKEN}\\s+(?:safe|legit|real|a rug|rugged|sketchy)(?:\\s+to\\s+(?:buy|ape|ape into|get|get into|enter|touch))?[?!.]*$`,
    'i',
  ),
  new RegExp(
    `^(?:how safe is|check\\s+(?:the\\s+)?safety\\s+(?:of|for|on))\\s+${TOKEN}[?!.]*$`,
    'i',
  ),
];

const NON_TOKEN_SUBJECTS = new Set([
  'anything',
  'ape',
  'balance',
  'best',
  'buy',
  'convert',
  'everything',
  'exchange',
  'exit',
  'fees',
  'good',
  'money',
  'moving',
  'portfolio',
  'price',
  'quote',
  'sell',
  'something',
  'swap',
  'trade',
  'trending',
  'wallet',
  'worth',
]);

const QUOTE_OR_SWAP =
  /\b(?:swap|sell|buy|trade|convert|ape|purchase|quote|price|worth|cost|route|slippage|spend|exchange|cash out|get out|exit)\b|(?:->|=>|→)|\$\s*\d|\b\d+(?:\.\d+)?\s*(?:sol|usdc|usd|%)\b/i;
const PRICE_SHAPE =
  /^(?:what(?:'s|’s| is)|how much is|how much does)\s+\$?[A-Za-z][A-Za-z0-9._-]{1,15}\s+(?:at|trade at|trading at)[?!.]*$/i;

export type UnfundedAskCapability =
  | 'wallet_independent'
  | 'local_discovery'
  | 'quote_or_swap'
  | 'wallet_context';

function normalizedQuestion(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function readsTokenSubject(pattern: RegExp, question: string): boolean {
  const match = pattern.exec(question);
  if (!match) return false;
  const subject = match[1]?.replace(/^\$/, '').toLowerCase();
  return Boolean(subject && !NON_TOKEN_SUBJECTS.has(subject));
}

export function classifyUnfundedAsk(text: string): UnfundedAskCapability {
  const question = normalizedQuestion(text);
  if (TRENDING.test(question) || MOVING_HERO.test(question)) {
    return 'local_discovery';
  }
  if (
    TOKEN_SAFETY_SHAPES.some((shape) => readsTokenSubject(shape, question)) ||
    IDENTITY_SHAPES.some((shape) => readsTokenSubject(shape, question))
  ) {
    return 'wallet_independent';
  }
  return QUOTE_OR_SWAP.test(question) || PRICE_SHAPE.test(question)
    ? 'quote_or_swap'
    : 'wallet_context';
}

/** The local answer for a question the unfunded capability gate withheld. */
export function emptyWalletText(text: string): TrustedCopy {
  switch (classifyUnfundedAsk(text)) {
    case 'local_discovery':
      return trustedCopy('ask', 'emptyDiscovery');
    case 'quote_or_swap':
      return trustedCopy('ask', 'questionNeedsFunds');
    case 'wallet_independent':
    case 'wallet_context':
      return trustedCopy('ask', 'questionNeedsWalletContext');
  }
}

export function emptyWalletAnswer(text: string): string {
  return emptyWalletText(text).text;
}
