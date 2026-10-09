import type { HoldingsBook } from './holdingsBook';
import type { HoldingsSnapshot } from './computeFiatTotal';
import { buildSolHoldingLine, type SolQuantityInput } from './holdingsSnapshot';
import { SOL_MINT, usdcMintForCluster } from '../swap/tokens';
import type { TokenFactsResponse } from '../tokenFacts/types';
export type HeldFactsMap = Record<string, TokenFactsResponse | undefined>;
export function heldTokenValuationEligible(
  facts: TokenFactsResponse | undefined,
  mint: string,
  cluster: HoldingsSnapshot['cluster'],
  nowMs: number,
): boolean {
  const source = facts?.sources.jupiter;
  return (
    !!facts &&
    facts.mint === mint &&
    facts.cluster === cluster &&
    source?.status === 'ok' &&
    source.fields.isVerified === true &&
    source.fields.liquidityUsd !== null &&
    source.fields.liquidityUsd > 0 &&
    source.asOfMs !== null &&
    nowMs - source.asOfMs <= 60000 &&
    source.asOfMs <= nowMs + 5000
  );
}
export function buildWalletHoldings(args: {
  address: string | undefined;
  cluster: HoldingsSnapshot['cluster'];
  book: HoldingsBook;
  sol: SolQuantityInput;
  facts: HeldFactsMap;
  nowMs: number;
}): HoldingsSnapshot | null {
  if (!args.address) return null;
  const sol =
    args.sol.status === 'ready' && args.sol.lamports !== null
      ? buildSolHoldingLine(args.sol.lamports)
      : null;
  if (sol) sol.nativeAtomic = sol.atomic;
  const ready =
    args.book.status === 'ready' &&
    args.book.owner === args.address &&
    args.book.cluster === args.cluster;
  const lines = sol ? [sol] : [];
  if (ready && args.book.status === 'ready') {
    for (const row of args.book.byMint.values()) {
      if (row.atomic <= 0n) continue;
      // Wrapped SOL and native SOL share the quote identity; aggregate once.
      if (row.mint === SOL_MINT && sol) {
        sol.atomic = (BigInt(sol.atomic) + row.atomic).toString();
        continue;
      }
      const isUsdc =
        args.cluster !== null && row.mint === usdcMintForCluster(args.cluster);
      // Reserved native symbols cannot let metadata select the peg/native path.
      const identity = args.facts[row.mint];
      const rawSymbol =
        identity?.mint === row.mint && identity.cluster === args.cluster
          ? identity.sources.jupiter.fields.symbol
          : null;
      const symbol = isUsdc
        ? 'USDC'
        : rawSymbol && rawSymbol !== 'SOL' && rawSymbol !== 'USDC'
          ? rawSymbol
          : `${row.mint.slice(0, 4)}…${row.mint.slice(-4)}`;
      lines.push({
        mint: row.mint,
        symbol,
        atomic: row.atomic.toString(),
        decimals: row.displayDecimals,
        includeInHomeTotal: true,
        valuationEligible: heldTokenValuationEligible(
          args.facts[row.mint],
          row.mint,
          args.cluster,
          args.nowMs,
        ),
      });
    }
  }
  return {
    address: args.address,
    cluster: args.cluster,
    asOfMs: args.book.status === 'ready' ? args.book.asOfMs : args.nowMs,
    scope: 'home',
    lines,
    quantityStatus:
      ready && sol
        ? 'ready'
        : args.book.status === 'error' || args.sol.status === 'error'
          ? 'error'
          : 'loading',
  };
}
export function walletTotalCaveat(count: number): string | null {
  return count > 0
    ? `${count} ${count === 1 ? 'token' : 'tokens'} not priced`
    : null;
}
