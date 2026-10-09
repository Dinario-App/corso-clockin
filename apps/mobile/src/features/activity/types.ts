export type ActivityKind = 'sent' | 'received' | 'swap' | 'unknown';

export type ActivityStatus = 'pending' | 'confirmed' | 'failed';

export type ActivityFilter = 'all' | 'pending' | 'sent' | 'received';

/** Display unit when an amount is known. Bounded set only (SOL + native USDC). */
export type ActivityAssetSymbol = 'SOL' | 'USDC';

export type ActivityItem = {
  signature: string;
  kind: ActivityKind;
  status: ActivityStatus;
  /** Unix ms when known; null if RPC omitted blockTime. */
  blockTimeMs: number | null;
  /**
   * Absolute SOL amount for display when known (system transfer).
   * Null for pure USDC rows (use tokenAmountAtomic instead).
   */
  amountLamports: number | null;
  /** Signed SOL delta for owner (post − pre), excluding pure fee-only when possible. */
  signedLamports: number | null;
  /**
   * Atomic amount for bounded SPL rows (USDC raw units, decimals=6).
   * Null when the row is SOL-denominated or amount unknown.
   */
  tokenAmountAtomic: string | null;
  /** Unit for the primary display amount when known. */
  amountSymbol: ActivityAssetSymbol | null;
  tokenMint?: string | null;
  /** Counterparty address when a single transfer is clear. */
  counterparty: string | null;
  /** Network fee in lamports when parsed. */
  feeLamports: number | null;
  /** Actual retained token-account rent funded by this wallet, not the network fee. */
  ataRentLamports?: number | null;
  /** Actual wallet-paid fee plus retained token-account rent. */
  walletCostLamports?: number | null;
  title: string;
};
