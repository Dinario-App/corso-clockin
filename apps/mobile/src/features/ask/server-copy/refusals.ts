import { isSymbolInScope, type AskScope } from './scope.js';

export type RefusalCode =
  | 'execute'
  | 'sign_without_user'
  | 'predict_price'
  | 'investment_advice'
  | 'yield'
  | 'trending_redirect'
  | 'discretionary'
  | 'recurring'
  | 'other_wallet'
  | 'out_of_scope'
  | 'tax_legal';

export type Refusal = {
  code: RefusalCode;
  row: number;
  copy: string;
};

const EXIT_SHAPED_TRIGGERS: readonly RegExp[] = [
  /\b(if|when|once) it (drops|falls|dips|rises|pumps|hits|goes)\b/i,
  /\bstop[- ]loss\b/i,
  /\btake profit at\b/i,
  /\bset (a |an )?(limit|stop|alert|order)\b/i,
];

/**
 * Ordered most-specific first. First match wins, and the order is load-bearing:
 * "should I stake" must land on `yield`, not `investment_advice`, and
 * "is this a good entry" must land on `predict_price` for the same reason.
 */
const RULES: Array<Refusal & { triggers: RegExp[] }> = [
  {
    code: 'sign_without_user',
    row: 2,
    copy: "Nothing moves without your approval. That's the whole point.",
    triggers: [
      /\bskip (the )?(face ?id|biometric|confirm)/i,
      /\bauto[- ]?(confirm|sign|approve)/i,
      /\bapprove (it|this|the swap)\b/i,
      /\bsign (it|this) for me\b/i,
      /\bwithout (my |the )?(signature|approval|face ?id|confirm)/i,
      /\bno (face ?id|confirmation) needed\b/i,
    ],
  },
  {
    code: 'execute',
    row: 1,
    copy: "You sign everything. Tell me what to swap and I'll show you the trade.",
    triggers: [
      /\bjust do it\b/i,
      /\bdo it for me\b/i,
      /\bhandle (it|this|my \w+)\b/i,
      /\btake care of (it|this)\b/i,
      /\b(buy|sell|swap|trade|dump) (the dip|it|this|that|everything|for me)\b.*\bfor me\b/i,
      /\bbuy the dip for me\b/i,
      /\bexecute (it|this|the trade)\b/i,
    ],
  },
  {
    code: 'recurring',
    row: 7,
    copy: 'One swap at a time for now.',
    triggers: [
      /\bevery (day|week|month|hour|morning|friday|monday)\b/i,
      /\b(daily|weekly|monthly|recurring|dca)\b/i,
      /\bschedule\b/i,
    ],
  },
  {
    code: 'other_wallet',
    row: 8,
    copy: 'I only see your money.',
    triggers: [
      /\b(their|his|her|someone else’?s?|someone else's|another person’?s?|another person's|this guy’?s?|this guy's) (wallet|bag|portfolio|holdings|address)\b/i,
      /\b(send|transfer|move) .*\b(to|into) [1-9A-HJ-NP-Za-km-z]{32,44}\b/i,
      /\bwhat (does|is) [1-9A-HJ-NP-Za-km-z]{32,44}\b/i,
      /\btrack (this|that) (wallet|address)\b/i,
    ],
  },
  {
    code: 'tax_legal',
    row: 10,
    copy: 'Ask someone who does taxes.',
    triggers: [
      /\btax(es|able|ed)?\b/i,
      /\bcapital gains\b/i,
      /\b(irs|1099)\b/i,
      /\bdo i have to report\b/i,
      /\b(legal|lawyer|regulator|regulation|compliance)\b/i,
    ],
  },
  {
    code: 'yield',
    row: 5,
    copy: "I don't do yield. I show you swaps.",
    triggers: [
      /\b(apy|apr)\b/i,
      /\byield\b/i,
      /\bstaking\b/i,
      /\b(should i|can i|where do i|how do i) stake\b/i,
      /\bstake (my|it|some|this)\b/i,
      /\b(yield |liquidity )?farming\b/i,
      /\bliquidity pool\b/i,
      /\blend(ing)? (my|it)\b/i,
    ],
  },
  {
    code: 'predict_price',
    row: 3,
    copy: "I don't know where prices go. Nobody does.",
    triggers: [
      /\bwill .{0,24}\b(go up|go down|moon|pump|dump|recover|bounce|hit)\b/i,
      /\bgoing to \d+ ?x\b/i,
      /\b\d+ ?x\b/i,
      /\bprice (target|prediction|forecast)\b/i,
      /\bgood entry\b/i,
      /\bwhere (is|are) .{0,24}\bheaded\b/i,
      /\b(is|are) .{0,24}\bgoing (up|down|to moon)\b/i,
      /\bpredict\b/i,
    ],
  },
  {
    code: 'trending_redirect',
    row: 6,
    copy: "I don't pick for you. The Moving list is right there — tap a row to look, or name a token and I'll show you the trade.",
    triggers: [
      /\bwhat’?s trending\b/i,
      /\bwhat's trending\b/i,
      /\bwhat is trending\b/i,
      /\bwhats trending\b/i,
      /\bshow me (what( is|’?s|'s)? )?trending\b/i,
      /\btrending\b/i,
    ],
  },
  {
    code: 'discretionary',
    row: 6,
    copy: "I don't pick for you. Name it and I'll show you the trade.",
    triggers: [
      /\bwhatever’?s? best\b/i,
      /\bwhatever's best\b/i,
      /\bdo whatever\b/i,
      /\bpick (one|something|anything|for me|the best)\b/i,
      /\bsurprise me\b/i,
      /\bwhat’?s hot\b/i,
      /\bwhat's hot\b/i,
      /\bwhat’?s pumping\b/i,
      /\bwhat's pumping\b/i,
      /\bwhat should i buy\b/i,
      /\bbest (coin|token|play|one) (to buy|right now|today)\b/i,
      /\bany (good )?(plays|picks|alpha)\b/i,
      /\b(top|biggest|best) (movers?|gainers?|losers?|performers?)\b/i,
    ],
  },
  {
    code: 'investment_advice',
    row: 4,
    copy: "That's your call. I can show you the trade when you decide.",
    triggers: [
      /\bshould i (buy|sell|get|ape|hold|swap|dump|exit)\b/i,
      /\bwhat should i do\b/i,
      /\bis (this|it|that|\w{2,16}) a good (investment|buy|idea|hold)\b/i,
      /\bworth (buying|holding|it)\b/i,
      /\bwould you (buy|sell|hold)\b/i,
      /\bdo you (think|recommend)\b/i,
    ],
  },
];

export const OUT_OF_SCOPE: Refusal = {
  code: 'out_of_scope',
  row: 9,
  copy: 'I only know what you hold.',
};

export const ALL_REFUSALS: Refusal[] = [
  ...RULES.filter(({ code }) => code !== 'trending_redirect').map(
    ({ code, row, copy }) => ({ code, row, copy }),
  ),
  OUT_OF_SCOPE,
].sort((a, b) => a.row - b.row);

export const VERBATIM_REFUSAL_COPIES: readonly string[] = [
  ...new Set([...RULES, OUT_OF_SCOPE].map((refusal) => refusal.copy)),
];

export const REFUSAL_COPY_BY_CODE = Object.fromEntries(
  [...RULES, OUT_OF_SCOPE].map(({ code, copy }) => [code, copy]),
) as Record<RefusalCode, string>;

export function refusalCopy(code: RefusalCode): string {
  const found = [...RULES, OUT_OF_SCOPE].find(
    (refusal) => refusal.code === code,
  );
  if (!found) throw new Error(`unknown refusal code: ${code}`);
  return found.copy;
}

/**
 * Runs before the model on every platform, and again over the model's answer.
 * Returns null when nothing fires — the common case.
 */
export function detectRefusal(
  text: string,
  routinesEnabled = false,
): Refusal | null {
  for (const rule of RULES) {
    if (rule.code === 'recurring') {
      if (rule.triggers.some((trigger) => trigger.test(text))) {
        return { code: rule.code, row: rule.row, copy: rule.copy };
      }
      if (isExitShapedRoutine(text)) {
        if (!routinesEnabled) {
          return { code: rule.code, row: rule.row, copy: rule.copy };
        }
        return null;
      }
      continue;
    }
    if (rule.triggers.some((trigger) => trigger.test(text))) {
      return { code: rule.code, row: rule.row, copy: rule.copy };
    }
  }
  return null;
}

/** Exit-shaped row-7 input becomes a staging candidate only when routines are enabled. */
export function isExitShapedRoutine(text: string): boolean {
  return EXIT_SHAPED_TRIGGERS.some((trigger) => trigger.test(text));
}

const QUESTION_SHAPE =
  /^(what|what’s|what's|whats|how|why|when|where|is|are|does|do|did|can|tell me)\b|\?\s*$/i;

const SWAP_VERB = /\b(swap|buy|sell|dump|trade|convert|ape|get me|move)\b/i;

export function detectOutOfScope(
  text: string,
  scope: AskScope,
  mentionedSymbol: string | null,
): Refusal | null {
  if (SWAP_VERB.test(text)) return null;
  if (!QUESTION_SHAPE.test(text.trim())) return null;
  // A pasted address has already named the token exactly; there is nothing
  // left for Corso to fail to identify.
  if (scope.pastedMint) return null;
  if (!mentionedSymbol) return null;
  return isSymbolInScope(mentionedSymbol, scope) ? null : OUT_OF_SCOPE;
}
