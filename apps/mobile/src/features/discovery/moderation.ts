export type ModerationMatch = 'word' | 'anywhere';

/**
 * The tier is the editorial judgement; the match mode is what it implies.
 * `hard` → `anywhere`, `soft` → `word`. They are kept as two fields because
 * the list is read by people: the tier says why a term is where it is, and
 * the match mode says what the matcher will do about it.
 */
export type ModerationTier = 'hard' | 'soft';

export type ModerationCategory =
  | 'hate'
  | 'violence'
  | 'sexual'
  | 'profanity'
  | 'impersonation';

export type ModerationTerm = {
  term: string;
  tier: ModerationTier;
  match: ModerationMatch;
  category: ModerationCategory;
  /**
   * Ordinary words that contain this term and are not it. Cut out of the
   * label before the term is looked for. Stems are fine and preferred:
   * `grape` covers "grapes" and "grapefruit".
   */
  carriers?: readonly string[];
};

export type ModerationVerdict =
  | { allowed: true }
  | { allowed: false; category: ModerationCategory; term: string };

/**
 * Characters that fold to a letter before matching. NFKD already handles
 * fullwidth forms, ligatures and most accents; this map covers what it does
 * not: leetspeak, currency stand-ins, and the Cyrillic / Greek homoglyphs a
 * launchpad name is free to use.
 */
const FOLD_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['0', 'o'],
  ['1', 'i'],
  ['3', 'e'],
  ['4', 'a'],
  ['5', 's'],
  ['6', 'g'],
  ['7', 't'],
  ['8', 'b'],
  ['9', 'g'],
  ['@', 'a'],
  ['$', 's'],
  ['!', 'i'],
  ['|', 'i'],
  ['£', 'l'],
  ['€', 'e'],
  ['ß', 'ss'],
  ['æ', 'ae'],
  ['ø', 'o'],
  ['đ', 'd'],
  ['ħ', 'h'],
  ['ı', 'i'],
  ['ł', 'l'],
  ['ſ', 's'],
  ['ŋ', 'n'],
  ['а', 'a'],
  ['в', 'b'],
  ['с', 'c'],
  ['д', 'd'],
  ['е', 'e'],
  ['г', 'r'],
  ['н', 'h'],
  ['і', 'i'],
  ['ј', 'j'],
  ['к', 'k'],
  ['м', 'm'],
  ['о', 'o'],
  ['п', 'n'],
  ['р', 'p'],
  ['ѕ', 's'],
  ['т', 't'],
  ['у', 'y'],
  ['х', 'x'],
  ['α', 'a'],
  ['β', 'b'],
  ['ε', 'e'],
  ['ι', 'i'],
  ['κ', 'k'],
  ['ο', 'o'],
  ['ρ', 'p'],
  ['τ', 't'],
  ['υ', 'y'],
  ['χ', 'x'],
];

const FOLD = new Map<string, string>(FOLD_PAIRS);

/**
 * A run-collapsed term is only matched loosely when it is still long enough
 * to be unmistakable. Collapsing "ass" to "as" would drop every pair with the
 * word "as" in its name; collapsing "nigger" to "niger" costs one country.
 */
const LOOSE_MIN_LENGTH = 5;

export type FoldedLabel = {
  /** Letter-only words, leetspeak and homoglyphs folded. */
  words: string[];
  /** Those words with the separators gone. */
  squashed: string;
  /** `words` with every repeated character run collapsed to one. */
  dedupedWords: string[];
  /** `squashed` with every repeated character run collapsed to one. */
  dedupedSquashed: string;
  /**
   * The label as the hard tier reads it: the letter stream between two
   * spaces, every other separator scrubbed out, and a run glued back together
   * wherever a lone letter stands beside a fragment. "l-o-l-i", "P-edo",
   * "Ped o" and "n i g g e r" are each one token; "Ape Dog" is still two, so
   * no term fuses across the gap between two ordinary words.
   */
  tokens: string[];
  /** `tokens` with every repeated character run collapsed to one. */
  dedupedTokens: string[];
  /**
   * Those same letter streams BEFORE the lone-letter glue — one entry per
   * space-separated fragment. `HARD_SPACE_SPLITS` is read off adjacent pairs
   * of these: "Ra pe" is `['ra', 'pe']` here and two tokens above.
   */
  segments: string[];
  /** `segments` with every repeated character run collapsed to one. */
  dedupedSegments: string[];
  /** Lower-case alphanumerics, separators gone, DIGITS INTACT. */
  alnum: string;
};

function decompose(value: string): string {
  try {
    return value.normalize('NFKD');
  } catch {
    return value;
  }
}

function collapseRuns(value: string): string {
  return value.replace(/(.)\1+/g, '$1');
}

/**
 * The only separator that keeps two words apart. Written out rather than
 * spelled `\s` on purpose: `\s` does not hold U+200B and does hold U+FEFF,
 * and both of those are invisible, so both belong on the scrubbed side of
 * this line, not the breaking side.
 */
const WORD_BREAK =
  /[ \t\n\r\f\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

/**
 * Spelling a slur out leaves a lone letter standing beside a fragment —
 * "p e d o", "ped o", "p edo", "p e d o b e a r". Two neighbouring segments
 * are glued whenever EITHER of them is a lone letter, and the glued run is
 * emitted as one token beside its own multi-letter members.
 *
 * The members are not redundant. "G Rape" glues to `grape`, and `grape` is a
 * carrier on `rape` — without the member token, a carrier the author never
 * wrote would swallow the term they did. Keeping `rape` beside `grape` closes
 * that door.
 *
 * Two ordinary words never glue: "Ape Dog" stays `ape` and `dog`.
 */
function glueSpelledRuns(segments: readonly string[]): string[] {
  const tokens: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      tokens.push(run[0]!);
    } else {
      tokens.push(run.join(''));
      for (const member of run) if (member.length > 1) tokens.push(member);
    }
    run = [];
  };
  for (const segment of segments) {
    const glues =
      run.length > 0 &&
      (segment.length === 1 || run[run.length - 1]!.length === 1);
    if (!glues) flush();
    run.push(segment);
  }
  flush();
  return tokens;
}

export function foldLabel(raw: string): FoldedLabel {
  const base = decompose(raw)
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  let folded = '';
  for (const character of base) folded += FOLD.get(character) ?? character;
  const letters = folded.replace(/[^a-z]+/g, ' ').trim();
  const words = letters.length > 0 ? letters.split(' ') : [];
  const squashed = words.join('');
  // The hard tier's stream: spaces break, every other separator is scrubbed.
  const tightened = folded
    .replace(WORD_BREAK, ' ')
    .replace(/[^a-z ]+/g, '')
    .replace(/ +/g, ' ')
    .trim();
  const segments = tightened.length > 0 ? tightened.split(' ') : [];
  const tokens = glueSpelledRuns(segments);
  return {
    words,
    squashed,
    dedupedWords: words.map(collapseRuns),
    dedupedSquashed: collapseRuns(squashed),
    tokens,
    dedupedTokens: tokens.map(collapseRuns),
    segments,
    dedupedSegments: segments.map(collapseRuns),
    alnum: base.replace(/[^a-z0-9]+/g, ''),
  };
}

function listed(
  category: ModerationCategory,
  term: string,
  tier: ModerationTier,
  carriers?: readonly string[],
): ModerationTerm {
  return {
    term,
    tier,
    match: tier === 'hard' ? 'anywhere' : 'word',
    category,
    ...(carriers ? { carriers } : {}),
  };
}

function hate(
  term: string,
  tier: ModerationTier = 'hard',
  carriers?: readonly string[],
): ModerationTerm {
  return listed('hate', term, tier, carriers);
}

function violence(
  term: string,
  tier: ModerationTier = 'hard',
  carriers?: readonly string[],
): ModerationTerm {
  return listed('violence', term, tier, carriers);
}

function sexual(
  term: string,
  tier: ModerationTier = 'hard',
  carriers?: readonly string[],
): ModerationTerm {
  return listed('sexual', term, tier, carriers);
}

function profanity(
  term: string,
  tier: ModerationTier = 'hard',
  carriers?: readonly string[],
): ModerationTerm {
  return listed('profanity', term, tier, carriers);
}

export const MODERATION_TERMS: readonly ModerationTerm[] = [
  // ── Hate: nazism, supremacism, genocide iconography ───────────────────────
  hate('hitler'),
  hate('heilhitler'),
  hate('siegheil'),
  hate('nazi'),
  hate('thirdreich'),
  hate('gaschamber'),
  hate('gasthejews'),
  hate('holocaust'),
  hate('holohoax'),
  hate('whitepower'),
  hate('whitepride'),
  hate('whitegenocide'),
  hate('racewar'),
  hate('kukluxklan'),
  hate('kkk'),
  hate('untermensch'),
  hate('subhuman'),
  hate('lynching'),
  // ── Hate: slurs ───────────────────────────────────────────────────────────
  hate('nigger'),
  hate('nigga'),
  hate('niglet'),
  hate('negroid'),
  hate('wetback'),
  hate('beaner'),
  hate('jigaboo'),
  hate('towelhead'),
  hate('raghead'),
  hate('zipperhead'),
  hate('faggot'),
  hate('tranny'),
  hate('shemale'),
  hate('mongoloid'),
  hate('retard'),
  hate('chink'),
  hate('gook', 'hard', ['gobbledygook']),
  hate('kike'),
  hate('coon', 'hard', ['raccoon', 'racoon', 'cocoon', 'tycoon']),
  hate('paki', 'hard', ['pakistan']),
  // `spic` stays soft: "spicy", "suspicious" and "auspicious" all carry it,
  // and a carrier list long enough to hold them is a list that will miss one.
  hate('spic', 'soft'),
  hate('jap', 'soft'),
  hate('wog', 'soft'),
  hate('fag', 'soft'),
  hate('fags', 'soft'),
  hate('dyke', 'soft'),
  hate('tard', 'soft'),
  // ── Violence and terror ───────────────────────────────────────────────────
  violence('terrorist'),
  violence('terrorism'),
  violence('alqaeda'),
  violence('alqaida'),
  violence('islamicstate'),
  violence('taliban'),
  violence('binladen'),
  violence('schoolshoot'),
  violence('massshooting'),
  violence('columbine'),
  violence('behead'),
  violence('genocide'),
  violence('ethniccleansing'),
  violence('suicidebomb'),
  violence('killyourself'),
  violence('selfharm'),
  violence('jihad', 'soft'),
  violence('suicide', 'soft'),
  // `wrapped` and `wrapper` are load-bearing: run-collapsing "wrapped" gives
  // `wraped`, and half the chain is called "Wrapped <something>".
  violence('rape', 'hard', [
    'grape',
    'crape',
    'drape',
    'scrape',
    'trapez',
    'therapeut',
    'wrapped',
    'wrapper',
  ]),
  violence('rapist', 'hard', ['therapist', 'trappist']),
  violence('kys', 'soft'),
  // ── Sexual content ────────────────────────────────────────────────────────
  sexual('childporn'),
  sexual('pedophile'),
  sexual('pedophilia'),
  sexual('jailbait'),
  sexual('porn'),
  sexual('hentai'),
  sexual('cumshot'),
  sexual('blowjob'),
  sexual('creampie'),
  sexual('gangbang'),
  sexual('bukkake'),
  sexual('deepthroat'),
  sexual('bestiality'),
  sexual('incest'),
  sexual('sexslave'),
  sexual('upskirt'),
  sexual('titties'),
  sexual('pedo', 'hard', ['torpedo', 'speedo']),
  sexual('loli', 'hard', ['lollipop']),
  sexual('lolita'),
  sexual('dildo', 'soft'),
  sexual('anal', 'soft'),
  sexual('cum', 'soft'),
  sexual('tits', 'soft'),
  sexual('milf', 'soft'),
  sexual('orgy', 'soft'),
  sexual('hooker', 'soft'),
  // ── Profanity ─────────────────────────────────────────────────────────────
  profanity('fuck'),
  profanity('shit'),
  profanity('bitch'),
  profanity('asshole'),
  profanity('cunt', 'hard', ['scunthorpe']),
  profanity('wanker'),
  profanity('twat'),
  profanity('bollocks'),
  profanity('pussy'),
  profanity('penis'),
  profanity('vagina'),
  profanity('whore'),
  profanity('slut'),
  profanity('jizz'),
  profanity('jerkoff'),
  profanity('dickhead'),
  profanity('nutsack'),
  profanity('ballsack'),
  profanity('fuk', 'soft'),
  profanity('ass', 'soft'),
  profanity('arse', 'soft'),
  profanity('dick', 'soft'),
  profanity('cock', 'soft'),
  profanity('prick', 'soft'),
  profanity('bastard', 'soft'),
];

export const HARD_SPACE_SPLITS: ReadonlyMap<string, readonly string[]> =
  new Map([
    // Hate
    ['nazi', ['na zi']],
    ['gook', ['go ok']],
    ['kike', ['ki ke']],
    ['coon', ['co on']],
    ['paki', ['pa ki']],
    // Violence
    ['rape', ['ra pe']],
    // Sexual
    ['porn', ['po rn']],
    ['pedo', ['pe do']],
    ['loli', ['lo li']],
    // Profanity
    ['fuck', ['fu ck']],
    ['shit', ['sh it']],
    ['cunt', ['cu nt']],
    ['twat', ['tw at']],
    ['slut', ['sl ut']],
    ['jizz', ['ji zz']],
  ]);

/**
 * The registry as the run-collapsed pass reads it, derived once rather than
 * per label: the gate runs on every row of a feed that turns over every few
 * minutes, and this map never changes. Fourteen entries are identical to their
 * `HARD_SPACE_SPLITS` twin; `ji zz` is the one that collapses, to `ji z`.
 */
const COLLAPSED_SPACE_SPLITS: ReadonlyMap<string, readonly string[]> = new Map(
  [...HARD_SPACE_SPLITS].map(([term, splits]) => [
    term,
    splits.map(collapseRuns),
  ]),
);

/**
 * Hate codes that live in DIGITS, so they have to be read before the leet
 * fold turns them into letters. Matched against `alnum`.
 */
export const MODERATION_CODES: readonly ModerationTerm[] = [
  hate('1488'),
  hate('8814'),
];

/**
 * Impersonation is a CONJUNCTION, never a single word: a brand alone is fair
 * game on a memecoin feed ("Solana Cat"), and a claim alone is only noise
 * ("Airdrop Season"). Together — "Solana Official Airdrop", "Coinbase
 * Support" — they are the scam Apple 4.1 and Play's impersonation policy both
 * reject, and the pair is what gets dropped.
 */
export const IMPERSONATION_BRANDS: readonly string[] = [
  'apple',
  'google',
  'microsoft',
  'coinbase',
  'binance',
  'kraken',
  'metamask',
  'phantom',
  'solflare',
  'ledger',
  'trezor',
  'trustwallet',
  'tether',
  'circle',
  'usdc',
  'usdt',
  'solana',
  'ethereum',
  'bitcoin',
  'jupiter',
  'raydium',
  'magiceden',
  'opensea',
  'pumpfun',
  'corso',
  'dinario',
  'visa',
  'mastercard',
  'paypal',
  'cashapp',
  'robinhood',
  'revolut',
];

export const IMPERSONATION_CLAIMS: readonly string[] = [
  'official',
  'verif',
  'support',
  'helpdesk',
  'customerservice',
  'airdrop',
  'giveaway',
  'claim',
  'refund',
  'admin',
  'moderator',
];

/**
 * Cut this term's carriers out of a folded string. A space is left behind so
 * removing "grape" from "grapes" cannot fuse what was on either side of it
 * into a new word; terms hold no spaces, so the gap can never help a match.
 */
function withoutCarriers(
  value: string,
  carriers: readonly string[] | undefined,
  collapsed: boolean,
): string {
  if (!carriers || carriers.length === 0) return value;
  let cut = value;
  for (const carrier of carriers) {
    const needle = collapsed ? collapseRuns(carrier) : carrier;
    if (needle.length === 0) continue;
    cut = cut.split(needle).join(' ');
  }
  return cut;
}

function hitsAnywhere(
  haystacks: readonly string[],
  needle: string,
  carriers: readonly string[] | undefined,
  collapsed: boolean,
): boolean {
  for (const haystack of haystacks) {
    if (withoutCarriers(haystack, carriers, collapsed).includes(needle)) {
      return true;
    }
  }
  return false;
}

function hitsSpaceSplit(label: FoldedLabel, term: ModerationTerm): boolean {
  const splits = HARD_SPACE_SPLITS.get(term.term);
  if (!splits) return false;
  const passes: ReadonlyArray<readonly [readonly string[], readonly string[]]> =
    [
      [label.segments, splits],
      [label.dedupedSegments, COLLAPSED_SPACE_SPLITS.get(term.term) ?? splits],
    ];
  for (const [fragments, wanted] of passes) {
    for (let index = 1; index < fragments.length; index += 1) {
      if (wanted.includes(`${fragments[index - 1]} ${fragments[index]}`)) {
        return true;
      }
    }
  }
  return false;
}

function hits(label: FoldedLabel, term: ModerationTerm): boolean {
  if (term.match === 'word') {
    return (
      label.words.includes(term.term) || label.dedupedWords.includes(term.term)
    );
  }
  const { carriers } = term;
  // The even split across a REAL space — the one break the token stream is
  // built to keep, closed by the registered pairs instead of by gluing it.
  if (hitsSpaceSplit(label, term)) return true;
  // Inside a token — this is what catches "PedoCoin", "LoliInu", "RapeCoin"
  // and the spelled-out "l-o-l-i", without letting "Ape Dog" fuse into one.
  if (hitsAnywhere(label.tokens, term.term, carriers, false)) return true;
  if (hitsAnywhere(label.dedupedTokens, term.term, carriers, true)) return true;
  // Across the whole label, but only for a term too long to fuse by accident:
  // "Adolf Hitler Coin", "Gas Chamber", "heil hitler".
  if (term.term.length >= LOOSE_MIN_LENGTH) {
    if (hitsAnywhere([label.squashed], term.term, carriers, false)) return true;
    if (hitsAnywhere([label.dedupedSquashed], term.term, carriers, true)) {
      return true;
    }
  }
  const loose = collapseRuns(term.term);
  if (loose.length < LOOSE_MIN_LENGTH) return false;
  return (
    hitsAnywhere(label.dedupedTokens, loose, carriers, true) ||
    hitsAnywhere([label.dedupedSquashed], loose, carriers, true)
  );
}

/** One label — a name or a symbol — against the whole list. */
export function moderateLabel(
  raw: string | null | undefined,
): ModerationVerdict {
  if (typeof raw !== 'string' || raw.trim().length === 0)
    return { allowed: true };
  const label = foldLabel(raw);
  for (const entry of MODERATION_TERMS) {
    if (hits(label, entry))
      return { allowed: false, category: entry.category, term: entry.term };
  }
  for (const entry of MODERATION_CODES) {
    if (label.alnum.includes(entry.term))
      return { allowed: false, category: entry.category, term: entry.term };
  }
  const brand = IMPERSONATION_BRANDS.find((name) =>
    label.squashed.includes(name),
  );
  if (brand) {
    const claim = IMPERSONATION_CLAIMS.find((word) =>
      label.squashed.includes(word),
    );
    if (claim)
      return {
        allowed: false,
        category: 'impersonation',
        term: `${brand}+${claim}`,
      };
  }
  return { allowed: true };
}

/**
 * The gate every caller uses: a pair is judged on its name AND its symbol,
 * and either one condemns it.
 */
export function moderateTokenLabels(input: {
  name?: string | null;
  symbol?: string | null;
}): ModerationVerdict {
  const name = moderateLabel(input.name);
  if (!name.allowed) return name;
  return moderateLabel(input.symbol);
}

export function isModeratedTokenLabel(input: {
  name?: string | null;
  symbol?: string | null;
}): boolean {
  return !moderateTokenLabels(input).allowed;
}
