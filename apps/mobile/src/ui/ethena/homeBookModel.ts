/** Asset identity marks `EthenaCoin` knows. Content, not a surface. */
export type BookMark = 'usdc' | 'btc' | 'eth' | 'sol' | 'bonk' | 'jup' | 'none';

export type BookSectionKey = 'cash' | 'majors' | 'sleeve' | 'gold' | 'stocks';

export type BookRow = {
  readonly key: string;
  readonly glyph: string;
  readonly mark: BookMark;
  /** Set when this row is one token. A section summary leaves it unset. */
  readonly symbol?: string | null;
  /** Holding mint when the row is one token. */
  readonly mint?: string | null;
  readonly name: string;
  readonly sub: string | null;
  readonly value: string | null;
  readonly deltaDirection?: 'up' | 'down';
  readonly delta?: string;
  /** What a tap opens. A sleeve summary opens 06. `null` opens nothing. */
  readonly opens:
    | { readonly kind: 'major'; readonly mint: string }
    | { readonly kind: 'sleeve' }
    | null;
};

export type BookName = {
  readonly key: string;
  readonly mint: string;
  readonly name: string;
  readonly symbol: string;
  readonly price: string | null;
  readonly change: {
    readonly text: string;
    readonly direction: 'up' | 'down' | null;
  } | null;
};

export type BookSection = {
  readonly key: BookSectionKey;
  readonly label: string;
  /** `$3,120 · 25%`, `$3,120` when shares are withheld, or a placeholder. */
  readonly subtotal: string;
  readonly rows: readonly BookRow[];
  /** Shown in place of rows when the section holds nothing. */
  readonly emptyLine: string | null;
  readonly names?: readonly BookName[];
  readonly status?: string;
};

/** The hero's change line: `$212.40 · 1.7%` + `today`, or a named failure. */
export type BookHeroDelta = {
  readonly direction: 'up' | 'down' | null;
  readonly value: string;
  readonly suffix: string;
};

export type BookHero =
  | {
      readonly kind: 'loading';
      readonly eyebrow: string;
      readonly placeholder: string;
    }
  /** The holdings read refused. Sections are hidden; quick actions stay. */
  | { readonly kind: 'unavailable'; readonly message: string }
  | {
      readonly kind: 'value';
      readonly eyebrow: string;
      readonly amount: string;
      readonly cents: string | null;
      readonly note: string | null;
      readonly noteTone?: 'quiet' | 'stale';
      readonly delta: BookHeroDelta | null;
    };

export type HomeBookState =
  | 'book'
  | 'loading'
  | 'unavailable'
  | 'partial'
  | 'stale'
  | 'new'
  | 'cashOnly';

export type WealthDoing = {
  readonly title: string;
  readonly rows: readonly {
    readonly key: string;
    readonly label: string;
    readonly value: string;
  }[];
};

/**
 * A white luminance step, never a hue (glass material law): the class's
 * place in the fixed order Cash, Crypto, Gold, Stocks. Never ordered by gain.
 */
export type WealthMixStep = 0 | 1 | 2 | 3;

export type WealthMixSegment = {
  readonly key: string;
  readonly step: WealthMixStep;
  /** Whole-percent share, summing to 100 across the bar. */
  readonly percent: number;
};

/** One legend entry: the class's step swatch and `Cash 62%`. */
export type WealthMixLegend = {
  readonly key: string;
  readonly step: WealthMixStep;
  readonly text: string;
};

export type WealthMix =
  | {
      readonly kind: 'ready';
      readonly title: string;
      /** The bar. `[]` = withheld (Hide balances); the legend still names the classes. */
      readonly segments: readonly WealthMixSegment[];
      readonly legend: readonly WealthMixLegend[];
    }
  /** MX3: a coin has no price, so there is no denominator and no bar. */
  | { readonly kind: 'unavailable'; readonly title: string; readonly line: string };

export type WealthHome = {
  readonly doing: WealthDoing | null;
  readonly mix: WealthMix | null;
};

export type HomeBookModel = {
  readonly state: HomeBookState;
  readonly hero: BookHero;
  /** The new-book line under the hero, or `null`. */
  readonly newBookLine: string | null;
  /** `null` = sections hidden (unavailable). Otherwise always all three. */
  readonly sections: readonly BookSection[] | null;
  readonly wealth?: WealthHome;
};
