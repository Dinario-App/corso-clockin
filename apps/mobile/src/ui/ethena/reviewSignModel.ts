/** Named extension point for later Review chips (sentiment / macro). */
export type ReviewContextChip = {
  key: string;
  label: string;
};

/** Read-only display contract. Signing authority stays in the route. */
export type ReviewSignModel = {
  state:
    | 'quoting'
    | 'quoted'
    | 'aging'
    | 'expired'
    | 'insufficient'
    | 'signing'
    | 'unconfirmed'
    | 'failed'
    | 'off';
  title: string;
  caution: { heading: string; body: string } | null;
  costs: readonly { label: string; value: string }[];
  /** Rows directly after the total; minimum first, then retained extra costs. */
  trailingCosts?: readonly { label: string; value: string; muted?: boolean }[];
  total: { label: string; value: string } | null;
  /** Code-derived position effect. Null when holdings cannot price the move. */
  bag: string | null;
  /**
   * Remainder after a sell, from the review quote. Null on a buy and while
   * there is no quote in amount.
   */
  afterSale: string | null;
  /** Subject-mint handle for the existing chart surface. Null omits the slot. */
  chart: { mint: string; priceUsd: string | null } | null;
  chips: readonly ReviewContextChip[];
  explain: { heading: string; action: string; body: string | null } | null;
  wait: string;
  sign: string;
  action: 'sign' | 'requote' | 'addCash' | 'retry' | 'none';
  disabled: boolean;
  waitDisabled: boolean;
};
