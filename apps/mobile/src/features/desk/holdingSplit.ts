import type {
  HoldingLine,
  HoldingsSnapshot,
} from '@/src/features/balances/computeFiatTotal';

export type HoldingSource = 'wallet-mint' | 'broker-entitlement';

export type SplitHolding = {
  source: HoldingSource;
  symbol: string;
  mint: string | null;
  atomic: string;
  decimals: number;
};

export type HoldingPresentation = {
  label: string;
  header: string | null;
  subtitle: string | null;
  explainer: string | null;
  freshness: string | null;
};

export type BrokerReviewRow = {
  label: string;
  value: string;
};

export type BrokerReviewAction = {
  enabled: false;
  label: string;
  availability: string;
  href: null;
  deepLink: null;
  apiKey: null;
  signedCall: null;
};

export type BrokerReviewModel = {
  symbol: string;
  rows: readonly BrokerReviewRow[];
  priceCaption: string;
  action: BrokerReviewAction;
  footer: string;
};

const WALLET_LABEL = 'In your wallet';
const BROKER_LABEL = 'Held by Backpack Securities';
const BROKER_HEADER = 'Held at your broker';
const BROKER_SUBTITLE = 'Backpack account · not in your wallet';
const BROKER_EXPLAINER =
  'Your broker records these shares in your Backpack account. Corso shows them. Corso cannot move, sell or sign for them. Changes happen on Backpack.';
const BROKER_FRESHNESS =
  'As reported by your broker at 10:42 ET. Splits and dividends may not show yet.';

const REVIEW_SYMBOL = 'AAPL.US';
const REVIEW_BROKER = 'Backpack Securities Global Limited (New Zealand)';
const REVIEW_WHERE = 'In your Backpack account. Not in your wallet.';
const REVIEW_PRICE =
  'Indicative $X.XX per share, as of 10:42 ET. Backpack gives the real quote.';
const REVIEW_PRICE_CAPTION = 'indicative, not a quote';
const REVIEW_FEE = 'None';
const REVIEW_NEXT =
  'You confirm this order on Backpack. Corso does not place it.';
const REVIEW_CTA = 'Confirm on Backpack';
const REVIEW_CTA_STATUS = 'Not live in this build';
const REVIEW_FOOTER =
  'Corso shows this for you to review. It is not advice or a recommendation. The order, the shares and your account are with Backpack.';

export function parseHoldingSource(value: unknown): HoldingSource | null {
  if (value === 'wallet-mint' || value === 'broker-entitlement') return value;
  return null;
}

/** True only for an on-chain wallet mint. Every other source stays out. */
export function includeInWalletTotal(source: HoldingSource): boolean {
  return source === 'wallet-mint';
}

export function presentHolding(source: unknown): HoldingPresentation | null {
  const parsed = parseHoldingSource(source);
  if (parsed == null) return null;
  if (parsed === 'wallet-mint') {
    return {
      label: WALLET_LABEL,
      header: null,
      subtitle: null,
      explainer: null,
      freshness: null,
    };
  }
  return {
    label: BROKER_LABEL,
    header: BROKER_HEADER,
    subtitle: BROKER_SUBTITLE,
    explainer: BROKER_EXPLAINER,
    freshness: BROKER_FRESHNESS,
  };
}

export function presentBrokerReview(): BrokerReviewModel {
  const action: BrokerReviewAction = {
    enabled: false,
    label: REVIEW_CTA,
    availability: REVIEW_CTA_STATUS,
    href: null,
    deepLink: null,
    apiKey: null,
    signedCall: null,
  };
  return {
    symbol: REVIEW_SYMBOL,
    priceCaption: REVIEW_PRICE_CAPTION,
    footer: REVIEW_FOOTER,
    action,
    rows: [
      { label: 'Broker', value: REVIEW_BROKER },
      { label: 'Where the shares are held', value: REVIEW_WHERE },
      { label: 'Price', value: REVIEW_PRICE },
      { label: 'Corso fee', value: REVIEW_FEE },
      { label: 'What happens next', value: REVIEW_NEXT },
    ],
  };
}

/**
 * Lines that `computeFiatTotal` may sum. Broker rows are dropped here,
 * including a row whose mint matches a wallet mint.
 */
export function walletTotalSnapshot(
  rows: readonly SplitHolding[],
  nowMs: number,
): HoldingsSnapshot {
  const lines: HoldingLine[] = [];
  for (const row of rows) {
    if (!includeInWalletTotal(row.source)) continue;
    if (row.mint == null) continue;
    lines.push({
      mint: row.mint,
      symbol: row.symbol,
      atomic: row.atomic,
      decimals: row.decimals,
      includeInHomeTotal: true,
    });
  }
  return {
    address: 'preview-fixture',
    cluster: 'mainnet-beta',
    asOfMs: nowMs,
    lines,
    quantityStatus: 'ready',
    scope: 'home',
  };
}
