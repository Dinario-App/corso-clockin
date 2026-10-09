/** Asset identity marks `EthenaCoin` knows. Content, not a surface. */
export type BookMark = 'usdc' | 'btc' | 'eth' | 'sol' | 'bonk' | 'jup' | 'none';

export type BookSectionKey = 'cash' | 'majors' | 'sleeve';

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
      /** The price-stale age line. */
      readonly note: string | null;
      readonly delta: {
        readonly direction: 'up' | 'down';
        readonly value: string;
        readonly suffix: string;
      } | null;
    };

export type HomeBookState =
  | 'book'
  | 'loading'
  | 'unavailable'
  | 'partial'
  | 'stale'
  | 'new'
  | 'cashOnly';

export type HomeBookModel = {
  readonly state: HomeBookState;
  readonly hero: BookHero;
  /** The new-book line under the hero, or `null`. */
  readonly newBookLine: string | null;
  /** `null` = sections hidden (unavailable). Otherwise always all three. */
  readonly sections: readonly BookSection[] | null;
};
