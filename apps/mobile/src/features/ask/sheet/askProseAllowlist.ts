const TICKER = String.raw`\$?([A-Za-z][A-Za-z0-9]{1,15})`;

/**
 * Words that are not a token name. "what is moving" and "what is price" must
 * not become token prose. SOL and USDC are not in here: "what is SOL" and
 * "how much SOL do I have" are real questions.
 */
const NOISE =
  /^(?:the|this|that|it|me|my|a|an|of|for|on|in|is|are|was|how|what|who|show|check|chart|vitals|safe|token|coin|doing|looking|up|down|now|today|moving|trending|hot|pumping|happening|everything|anything|something|going|new|good|best|next|book|swap|trade|price)$/i;

function punctuated(text: string): string {
  return text.trim().replace(/[?!.]+$/u, '').trim();
}

function named(symbol: string | undefined): symbol is string {
  return typeof symbol === 'string' && symbol.length > 0 && !NOISE.test(symbol);
}

/**
 * A fact noun on a token. Closed. `fee`, `tax`, `value`, `worth`, `quote`,
 * `bid`, and `rate` are not in it, so an attribute question cannot host them
 * by being "some word".
 */
export function attributeNounIsFact(word: string): boolean {
  return /^(?:age|liquidity|holders?|supply|mint|decimals|name|symbol)$/i.test(
    word,
  );
}

/** What one allowed shape matched. `symbol` is null when the shape has no token subject. */
export type AllowedProseShape = { readonly symbol: string | null };

function closed(ok: boolean): AllowedProseShape | null {
  return ok ? { symbol: null } : null;
}

function withSymbol(symbol: string | null): AllowedProseShape | null {
  return symbol === null ? null : { symbol };
}

/** The book chip Corso offers. Composition of the book, not a cost. */
export function recognisesBookSplit(text: string): boolean {
  return /^how is my money split$/i.test(punctuated(text));
}

function shapeBookSplit(text: string): AllowedProseShape | null {
  return closed(recognisesBookSplit(text));
}

function readWhatIsToken(text: string): string | null {
  const match =
    /^(?:what(?:'s|’s| is)|who(?:'s|’s| is))\s+(?:the\s+)?\$?([A-Za-z][A-Za-z0-9]{1,15})$/i.exec(
      punctuated(text),
    );
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "what is BONK" / "who is BONK" / "what's $BONK". One ticker, nothing else. */
export function recognisesWhatIsToken(text: string): boolean {
  return readWhatIsToken(text) !== null;
}

function shapeWhatIsToken(text: string): AllowedProseShape | null {
  return withSymbol(readWhatIsToken(text));
}

function readTokenAttribute(text: string): string | null {
  const match =
    /^what(?:'s|’s| is)\s+the\s+(\S+)\s+(?:on|of|for)\s+\$?([A-Za-z][A-Za-z0-9]{1,15})$/i.exec(
      punctuated(text),
    );
  if (!match || !attributeNounIsFact(match[1]) || !named(match[2])) return null;
  return match[2];
}

/** "what is the <fact> on|of|for <token>". The fact is the closed noun set. */
export function recognisesTokenAttribute(text: string): boolean {
  return readTokenAttribute(text) !== null;
}

function shapeTokenAttribute(text: string): AllowedProseShape | null {
  return withSymbol(readTokenAttribute(text));
}

function readBareTicker(text: string): string | null {
  const match = /^\$?([A-Za-z][A-Za-z0-9]{1,9})$/i.exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** A typed ticker and nothing else (`BONK`, `$BONK`). Identity, not a trade. */
export function recognisesBareTicker(text: string): boolean {
  return readBareTicker(text) !== null;
}

function shapeBareTicker(text: string): AllowedProseShape | null {
  return withSymbol(readBareTicker(text));
}

function readHoldingQuantity(text: string): string | null {
  const match = new RegExp(
    `^how much\\s+${TICKER}\\s+do i have$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "How much SOL do I have?" Quantity held, not a price or a fee. */
export function recognisesHoldingQuantity(text: string): boolean {
  return readHoldingQuantity(text) !== null;
}

function shapeHoldingQuantity(text: string): AllowedProseShape | null {
  return withSymbol(readHoldingQuantity(text));
}

/** How to open a screen Corso already has. Not how a trade is priced. */
export function recognisesHowToNavigate(text: string): boolean {
  const where = punctuated(text);
  if (
    /^(?:how do i|where do i|where can i)\s+(?:open|find|see|get to|reach)\s+(?:the\s+|my\s+)?(?:book|activity|profile|settings|review|add cash)$/i.test(
      where,
    )
  ) {
    return true;
  }
  return /^where is\s+(?:the\s+|my\s+)?(?:book|activity|profile|settings|review|add cash)$/i.test(
    where,
  );
}

function shapeHowToNavigate(text: string): AllowedProseShape | null {
  return closed(recognisesHowToNavigate(text));
}

function readShowToken(text: string): string | null {
  const match = new RegExp(
    `^(?:show|check|pull up|open)\\s+(?:me\\s+)?(?:the\\s+)?${TICKER}(?:\\s+(?:vitals|chart|stats|card))?$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "show me BONK", "open BONK vitals", "check the BONK chart". */
export function recognisesShowToken(text: string): boolean {
  return readShowToken(text) !== null;
}

function shapeShowToken(text: string): AllowedProseShape | null {
  return withSymbol(readShowToken(text));
}

function readTokenInfo(text: string): string | null {
  const match = new RegExp(
    `^${TICKER}\\s+(?:vitals|chart|stats|card|info)$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "BONK vitals" / "BONK chart". */
export function recognisesTokenInfo(text: string): boolean {
  return readTokenInfo(text) !== null;
}

function shapeTokenInfo(text: string): AllowedProseShape | null {
  return withSymbol(readTokenInfo(text));
}

function readVitalsFor(text: string): string | null {
  const match = new RegExp(
    `^(?:vitals|chart|stats)\\s+(?:for|on)\\s+${TICKER}$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "vitals for BONK" / "chart on BONK". */
export function recognisesVitalsFor(text: string): boolean {
  return readVitalsFor(text) !== null;
}

function shapeVitalsFor(text: string): AllowedProseShape | null {
  return withSymbol(readVitalsFor(text));
}

function readIsTokenSafe(text: string): string | null {
  const match = new RegExp(
    `^is\\s+${TICKER}\\s+(?:safe|legit|a rug|rugged|sketchy|real)(?:\\s+to\\s+(?:buy|ape|get|enter|touch))?$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "is BONK safe" and "is BONK safe to buy". A safety read, not a decision. */
export function recognisesIsTokenSafe(text: string): boolean {
  return readIsTokenSafe(text) !== null;
}

function shapeIsTokenSafe(text: string): AllowedProseShape | null {
  return withSymbol(readIsTokenSafe(text));
}

function readHowIsToken(text: string): string | null {
  const match = new RegExp(
    `^how(?:\\s+is|'s|’s)\\s+${TICKER}\\s+(?:doing|looking)$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "how is BONK doing". */
export function recognisesHowIsToken(text: string): boolean {
  return readHowIsToken(text) !== null;
}

function shapeHowIsToken(text: string): AllowedProseShape | null {
  return withSymbol(readHowIsToken(text));
}

function readTokenLiquidity(text: string): string | null {
  const match = new RegExp(
    `^(?:what(?:'s|’s| is)\\s+)?${TICKER}\\s+liquidity$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "BONK liquidity" / "what is BONK liquidity". */
export function recognisesTokenLiquidity(text: string): boolean {
  return readTokenLiquidity(text) !== null;
}

function shapeTokenLiquidity(text: string): AllowedProseShape | null {
  return withSymbol(readTokenLiquidity(text));
}

function readWhoHolds(text: string): string | null {
  const where = punctuated(text);
  const who = new RegExp(`^who\\s+holds\\s+${TICKER}$`, 'i').exec(where);
  const whoSymbol = who?.[1];
  if (named(whoSymbol)) return whoSymbol;
  const holders = new RegExp(`^${TICKER}\\s+holders$`, 'i').exec(where);
  const holderSymbol = holders?.[1];
  return named(holderSymbol) ? holderSymbol : null;
}

/** "who holds BONK" / "BONK holders". */
export function recognisesWhoHolds(text: string): boolean {
  return readWhoHolds(text) !== null;
}

function shapeWhoHolds(text: string): AllowedProseShape | null {
  return withSymbol(readWhoHolds(text));
}

function readHowOld(text: string): string | null {
  const match = new RegExp(`^how\\s+old\\s+is\\s+${TICKER}$`, 'i').exec(
    punctuated(text),
  );
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "how old is BONK". */
export function recognisesHowOld(text: string): boolean {
  return readHowOld(text) !== null;
}

function shapeHowOld(text: string): AllowedProseShape | null {
  return withSymbol(readHowOld(text));
}

function readExplainToken(text: string): string | null {
  const match = new RegExp(
    `^(?:tell me about|what about|how about|thoughts on|look at|look into|explain)\\s+(?:the\\s+)?${TICKER}$`,
    'i',
  ).exec(punctuated(text));
  const symbol = match?.[1];
  return named(symbol) ? symbol : null;
}

/** "tell me about BONK" / "explain BONK". */
export function recognisesExplainToken(text: string): boolean {
  return readExplainToken(text) !== null;
}

function shapeExplainToken(text: string): AllowedProseShape | null {
  return withSymbol(readExplainToken(text));
}

const SHAPES: readonly ((text: string) => AllowedProseShape | null)[] = [
  shapeBookSplit,
  shapeWhatIsToken,
  shapeTokenAttribute,
  shapeBareTicker,
  shapeHoldingQuantity,
  shapeHowToNavigate,
  shapeShowToken,
  shapeTokenInfo,
  shapeVitalsFor,
  shapeIsTokenSafe,
  shapeHowIsToken,
  shapeTokenLiquidity,
  shapeWhoHolds,
  shapeHowOld,
  shapeExplainToken,
];

/** The first allowed shape, or null. Token shapes carry the subject symbol. */
export function classifyProseShape(text: string): AllowedProseShape | null {
  for (const recognise of SHAPES) {
    const found = recognise(text);
    if (found) return found;
  }
  return null;
}

/**
 * True when the question matches a shape above. A token shape matches and
 * still does not draw model prose; the presenter reads `symbol` for the
 * device card.
 */
export function matchesAllowedProseShape(text: string): boolean {
  return classifyProseShape(text) !== null;
}

/**
 * NFKD, then drop Default_Ignorable code points (soft hyphen, zero-width
 * space), then drop marks. `chárged` becomes `charged`. A Cyrillic letter
 * is not a mark and is not removed here.
 */
export function foldQuestion(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{Default_Ignorable_Code_Point}/gu, '')
    .replace(/\p{M}/gu, '');
}

/**
 * The text both gates read. Null when a letter is still not ASCII Latin
 * after the fold: the stem matcher cannot read it, so the question is not
 * proven free of a money word.
 */
export function readFoldedQuestion(question: string): string | null {
  const folded = foldQuestion(question);
  if (/[^\P{L}A-Za-z]/u.test(folded)) return null;
  return folded;
}
