import type { ComponentProps } from 'react';
import type { EthenaCoin } from './EthenaChrome';

/** Display facts supplied by the receipt presenter; no live reads or defaults. */
export type ReceiptModel = Readonly<{
  amount: string;
  cents: string;
  sub: string;
  coinGlyph: string;
  coinMark?: ComponentProps<typeof EthenaCoin>['mark'];
  coinSymbol?: string | null;
  coinMint?: string | null;
  trade: readonly Readonly<{ label: string; value: string; info?: boolean }>[];
  kept: Readonly<{ label: string; value: string }> | null;
  frozen: Readonly<{
    heading: string;
    note: string;
    body: string;
    quoteLabel: string;
    quoteValue: string;
  }> | null;
  chain: Readonly<{ signature: string; action: string }> | null;
  done: string;
}>;
