import { scrubProviderErrorMessage } from '@/src/lib/analyticsScrub';

/**
 * Surface a failed balance read to the Metro console in development.
 *
 * Never throws — a diagnostic that can break the catch block it lives in would
 * be worse than no diagnostic at all.
 */
export function reportBalanceReadFailure(
  channel: 'SOL' | 'USDC',
  error: unknown,
): void {
  try {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    // #8: never log raw provider bodies (may embed txs/tokens).
    console.warn(
      `[balances] ${channel} read failed`,
      scrubProviderErrorMessage(error),
    );
  } catch {
    // Diagnostics are best-effort; never let them affect the read's outcome.
  }
}
