/** One label · value row on a card. */
export type AskCardRow = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

/** A tappable chip. `marker` is a short tag such as `Unverified`, or null. */
export type AskChip = {
  readonly key: string;
  readonly label: string;
  readonly marker: string | null;
};

export type AskSheetCard =
  /** PORTFOLIO — rows, and a bold total only when the rows add up. */
  | {
      readonly kind: 'table';
      readonly rows: readonly AskCardRow[];
      readonly total: AskCardRow | null;
    }
  /** HOLDING_FACT — one holding. */
  | {
      readonly kind: 'fact';
      readonly title: string;
      readonly rows: readonly AskCardRow[];
      /** Null when the card has nothing to open (a fee-policy fact). */
      readonly openLabel: string | null;
    }
  | {
      readonly kind: 'facts';
      readonly title: string;
      readonly rows: readonly AskCardRow[];
      readonly openLabel: string | null;
    }
  | {
      readonly kind: 'trade';
      readonly title: string;
      readonly rows: readonly AskCardRow[];
      readonly note: string;
      readonly openReviewLabel: string;
      readonly openReviewEnabled: boolean;
      /** Shown under the card when swaps are off; `null` otherwise. */
      readonly disabledLine: string | null;
      readonly waitLabel: string;
    }
  /** CLARIFY, and the resolver's "which one?" — the question back, and chips. */
  | {
      readonly kind: 'clarify';
      readonly line: string;
      readonly chips: readonly AskChip[];
    }
  /**
   * One calm line: a refusal, out of scope, Can't answer yet, or Ask
   * unavailable. `doors` are device-authored exits (a sell door, Add cash).
   */
  | {
      readonly kind: 'line';
      readonly tone: 'refused' | 'cantYet' | 'unavailable';
      readonly line: string;
      readonly doors: readonly AskChip[];
    };

export type AskSheetState =
  | 'empty'
  | 'thinking'
  | 'table'
  | 'fact'
  | 'facts'
  | 'trade'
  | 'clarify'
  | 'cantYet'
  | 'refused'
  | 'unavailable';

export type AskSheetView = {
  readonly state: AskSheetState;
  /** The person's own question, or the empty title. */
  readonly title: string;
  /** `null` while empty, and while thinking (a placeholder is drawn). */
  readonly card: AskSheetCard | null;
  /** Written by code from the sources the answer read. `null` = read nothing. */
  readonly lookedAt: string | null;
  /** The scrim's and the grab handle's accessibility label. */
  readonly closeLabel: string;
  /** Empty state only. */
  readonly suggestions: readonly AskChip[];
  readonly composer: {
    readonly placeholder: string;
    readonly sendLabel: string;
    /** False while thinking, and while Ask is off. */
    readonly enabled: boolean;
  };
};
