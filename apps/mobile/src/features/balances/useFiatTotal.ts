import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeFiatTotal,
  type FiatTotalResult,
  type FiatTotalStatus,
  type HoldingsSnapshot,
  type PriceQuoteMap,
} from '@/src/features/balances/computeFiatTotal';
import { formatFiatTotal } from '@/src/features/balances/formatFiatTotal';
import {
  buildHoldingsSnapshot,
  type SolQuantityInput,
  type UsdcQuantityInput,
} from '@/src/features/balances/holdingsSnapshot';
import {
  usePriceQuotes,
  type LoadPriceQuotesDeps,
  type PriceQuotesStatus,
} from '@/src/features/balances/usePriceQuotes';
import { useSolBalance } from '@/src/features/balances/useSolBalance';
import { useUsdcBalance } from './useUsdcBalance';
import { useHoldings, type HoldingsSessionInput } from './useHoldings';
import type { HoldingsBook } from './holdingsBook';
import { buildWalletHoldings, walletTotalCaveat } from './walletHoldings';
import { useHeldTokenValuation } from './useHeldTokenValuation';
import {
  resolveNetworkStatus,
  type NetworkStatus,
} from '@/src/lib/apiConfig';
import { resolveFiatTotalCluster } from '@/src/features/balances/fiatTotalNetworkGate';
import type { PriceCluster } from '@/src/features/balances/priceSnapshot';

export type ComposeFiatTotalArgs = {
  /** Null when address is missing — treated as loading. */
  holdings: HoldingsSnapshot | null;
  quotes: PriceQuoteMap;
  priceStatus: PriceQuotesStatus;
  nowMs: number;
  assumeUsdcPeg?: boolean;
  allowPartialTotal?: boolean;
};

export type FiatTotalComposition = {
  result: FiatTotalResult;
  display: string;
  /** True when price feed is still in flight and external SOL quote may be needed. */
  awaitingPrices: boolean;
};

function emptyResult(
  status: FiatTotalStatus,
  scope: HoldingsSnapshot['scope'] = 'home',
): FiatTotalResult {
  return {
    status,
    currency: 'USD',
    totalFiat: null,
    lines: [],
    methodology: 'unavailable',
    pricedMintCount: 0,
    unpricedMintCount: 0,
    asOfMs: null,
    sources: [],
    scope: scope ?? 'home',
  };
}

/**
 * Included non-zero SOL lines need an external spot quote (USDC may peg).
 */
export function holdingsNeedExternalSolQuote(
  holdings: HoldingsSnapshot,
): boolean {
  if (holdings.quantityStatus !== 'ready') return false;
  return holdings.lines.some(
    (line) =>
      line.includeInHomeTotal &&
      line.symbol === 'SOL' &&
      line.atomic !== '0',
  );
}

/**
 * Whether price quotes are still in flight (no usable map yet for SOL).
 * `disabled` / `error` / `unavailable` / `ready` / `partial` are terminal
 * enough to compute (empty map → honest unavailable when SOL needs a quote).
 */
export function pricesStillLoading(status: PriceQuotesStatus): boolean {
  return status === 'idle' || status === 'loading';
}

/**
 * Pure composition: holdings + quotes + price status → FiatTotalResult + display.
 * Never invents `$0.00` for unknown/disabled/unavailable/stale.
 */
export function composeFiatTotal(
  args: ComposeFiatTotalArgs,
): FiatTotalComposition {
  const scope = args.holdings?.scope ?? 'home';

  if (!args.holdings) {
    const result = emptyResult('loading', scope);
    return {
      result,
      display: formatFiatTotal(result.totalFiat, result.status),
      awaitingPrices: false,
    };
  }

  if (args.holdings.quantityStatus === 'loading') {
    const result = computeFiatTotal({
      holdings: args.holdings,
      quotes: args.quotes,
      nowMs: args.nowMs,
      assumeUsdcPeg: args.assumeUsdcPeg,
      allowPartialTotal: args.allowPartialTotal,
    });
    return {
      result,
      display: formatFiatTotal(result.totalFiat, result.status),
      awaitingPrices: false,
    };
  }

  const needsSolQuote = holdingsNeedExternalSolQuote(args.holdings);
  const awaitingPrices =
    needsSolQuote && pricesStillLoading(args.priceStatus);

  if (awaitingPrices) {
    const result = emptyResult('loading', scope);
    return {
      result,
      display: formatFiatTotal(result.totalFiat, result.status),
      awaitingPrices: true,
    };
  }

  // Disabled / error / unavailable / ready / partial: pass quotes as-is.
  // Empty map + non-zero SOL → computeFiatTotal unavailable (never $0.00).
  // Stale SOL quotes age-checked inside computeFiatTotal.
  const result = computeFiatTotal({
    holdings: args.holdings,
    quotes: args.quotes,
    nowMs: args.nowMs,
    assumeUsdcPeg: args.assumeUsdcPeg,
    allowPartialTotal: args.allowPartialTotal,
  });

  return {
    result,
    display: formatFiatTotal(result.totalFiat, result.status),
    awaitingPrices: false,
  };
}

export type BuildHoldingsFromBalancesArgs = {
  address: string | undefined;
  /** `null` when the network was never named — see `fiatTotalNetworkGate`. */
  cluster: 'devnet' | 'mainnet-beta' | null;
  asOfMs: number;
  sol: SolQuantityInput;
  usdc: UsdcQuantityInput;
  scope?: HoldingsSnapshot['scope'];
  additionalLines?: HoldingsSnapshot['lines'];
};

/** Address-gated holdings builder for the hook. */
export function buildHoldingsFromBalances(
  args: BuildHoldingsFromBalancesArgs,
): HoldingsSnapshot | null {
  if (!args.address) return null;
  return buildHoldingsSnapshot({
    address: args.address,
    cluster: args.cluster,
    asOfMs: args.asOfMs,
    sol: args.sol,
    usdc: args.usdc,
    scope: args.scope,
    additionalLines: args.additionalLines,
  });
}

export type UseFiatTotalDeps = LoadPriceQuotesDeps & {
  session?: HoldingsSessionInput;
  getAccessToken?: () => Promise<string | null>;
  nowMs?: number;
  assumeUsdcPeg?: boolean;
  allowPartialTotal?: boolean;
  cluster?: PriceCluster;
};

export type FiatTotalState = {
  holdingsBook: HoldingsBook;
  caveat: string | null;
  status: FiatTotalStatus;
  totalFiat: string | null;
  display: string;
  result: FiatTotalResult;
  holdings: HoldingsSnapshot | null;
  quotes: PriceQuoteMap;
  priceStatus: PriceQuotesStatus;
  /** True when a known-good total is held across a later read/age failure. */
  stale: boolean;
  /** Original observation time for the held total; never advanced by failure. */
  staleAsOfMs: number | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

export type KnownFiatSnapshot = {
  address: string;
  cluster: PriceCluster;
  holdings: HoldingsSnapshot;
  quotes: PriceQuoteMap;
  priceStatus: PriceQuotesStatus;
  composition: FiatTotalComposition;
  observedAtMs: number;
};

export type KnownFiatSelection = {
  holdings: HoldingsSnapshot | null;
  quotes: PriceQuoteMap;
  priceStatus: PriceQuotesStatus;
  composition: FiatTotalComposition;
  freshness: 'live' | 'stale' | 'unavailable';
  staleAsOfMs: number | null;
  cache: KnownFiatSnapshot | null;
};

/** Process-memory only: one wallet/cluster, so data never crosses identities. */
let lastKnownFiatSnapshot: KnownFiatSnapshot | null = null;
let lastKnownLegacyFiatSnapshot: KnownFiatSnapshot | null = null;
/** Undefined deps preserves existing bounded consumers; explicit sessions require the full book. */
export function chooseFiatHoldings(session: HoldingsSessionInput, legacy: HoldingsSnapshot | null, wallet: HoldingsSnapshot | null): HoldingsSnapshot | null {
  return session === undefined ? legacy : wallet;
}
const NO_ACCESS_TOKEN = async () => null;

/**
 * Stale-while-error selection for the funded Home book.
 *
 * A rendered fiat total is known-good only when both quantities were read and
 * the total is numeric. Once observed, an unrelated render, failed refresh, or
 * route remount may mark it stale but may not replace it with absence. The
 * prior value is eligible only for the exact same address and cluster.
 */
export function selectKnownFiatSnapshot(args: {
  previous: KnownFiatSnapshot | null;
  address: string | undefined;
  cluster: PriceCluster | null;
  holdings: HoldingsSnapshot | null;
  quotes: PriceQuoteMap;
  priceStatus: PriceQuotesStatus;
  composition: FiatTotalComposition;
  observedAtMs: number;
  hasReadError: boolean;
}): KnownFiatSelection {
  const liveIsKnown =
    args.address != null &&
    args.cluster != null &&
    args.holdings?.quantityStatus === 'ready' &&
    args.composition.result.totalFiat !== null &&
    (args.composition.result.pricedMintCount > 0 ||
      args.composition.result.status === 'zero');

  if (liveIsKnown && !args.hasReadError) {
    const cache: KnownFiatSnapshot = {
      address: args.address!,
      cluster: args.cluster!,
      holdings: args.holdings!,
      quotes: args.quotes,
      priceStatus: args.priceStatus,
      composition: args.composition,
      observedAtMs: args.observedAtMs,
    };
    return {
      holdings: args.holdings,
      quotes: args.quotes,
      priceStatus: args.priceStatus,
      composition: args.composition,
      freshness: 'live',
      staleAsOfMs: null,
      cache,
    };
  }

  const previousMatches =
    args.previous != null &&
    args.address != null &&
    args.cluster != null &&
    args.previous.address === args.address &&
    args.previous.cluster === args.cluster;
  if (previousMatches) {
    return {
      holdings: args.previous!.holdings,
      quotes: args.previous!.quotes,
      priceStatus: args.previous!.priceStatus,
      composition: args.previous!.composition,
      freshness: 'stale',
      staleAsOfMs: args.previous!.observedAtMs,
      cache: args.previous,
    };
  }

  return {
    holdings: args.holdings,
    quotes: args.quotes,
    priceStatus: args.priceStatus,
    composition: args.composition,
    freshness: 'unavailable',
    staleAsOfMs: null,
    cache: null,
  };
}

/**
 * Wallet consumers compose the complete held book plus native SOL; legacy
 * bounded consumers keep SOL/USDC. Refresh reads quantities and prices together.
 */
export function useFiatTotal(
  address: string | undefined,
  deps: UseFiatTotalDeps = {},
): FiatTotalState {
  const sol = useSolBalance(address);
  const legacyMode = deps.session === undefined;
  const usdc = useUsdcBalance(legacyMode ? address : undefined);

  const prices = usePriceQuotes({
    resolveConfig: deps.resolveConfig,
    fetchPricesImpl: deps.fetchPricesImpl,
    nowMs: deps.nowMs,
  });

  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void resolveNetworkStatus().then((next) => {
      if (!cancelled) setNetworkStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cluster = useMemo(
    () =>
      resolveFiatTotalCluster({
        override: deps.cluster,
        status: networkStatus,
      }),
    [deps.cluster, networkStatus],
  );
  const nowMs = deps.nowMs ?? Date.now();

  const held = useHoldings({session: deps.session, cluster, getAccessToken: deps.getAccessToken ?? NO_ACCESS_TOKEN});
  const valuation = useHeldTokenValuation(held.book);
  const quotes = useMemo(() => ({ ...prices.quotes, ...valuation.quotes }), [prices.quotes, valuation.quotes]);
  const walletHoldings = useMemo(() => buildWalletHoldings({address, cluster, nowMs, sol:{status:sol.status,lamports:sol.lamports},book:held.book,facts:valuation.facts}), [address,cluster,nowMs,sol.status,sol.lamports,held.book,valuation.facts]);

  const legacyHoldings = useMemo(() => buildHoldingsFromBalances({ address, cluster, asOfMs: nowMs, sol: {status: sol.status, lamports: sol.lamports}, usdc: {status: usdc.status, atomic: usdc.atomic} }), [address,cluster,nowMs,sol.status,sol.lamports,usdc.status,usdc.atomic]);
  const holdings = chooseFiatHoldings(deps.session, legacyHoldings, walletHoldings);

  const currentComposition = useMemo(
    () =>
      composeFiatTotal({
        holdings,
        quotes,
        priceStatus: prices.status,
        nowMs,
        assumeUsdcPeg: deps.assumeUsdcPeg,
        allowPartialTotal: legacyMode ? deps.allowPartialTotal : true,
      }),
    [
      holdings,
      quotes,
      prices.status,
      nowMs,
      deps.assumeUsdcPeg,
      deps.allowPartialTotal,
      legacyMode,
    ],
  );

  const selected = selectKnownFiatSnapshot({
    previous: legacyMode ? lastKnownLegacyFiatSnapshot : lastKnownFiatSnapshot,
    address,
    cluster,
    holdings,
    quotes,
    priceStatus: prices.status,
    composition: currentComposition,
    observedAtMs: nowMs,
    hasReadError:
      sol.error !== null || (legacyMode ? usdc.error !== null || prices.error !== null : held.book.status === 'error'),
  });

  useEffect(() => {
    if (selected.freshness === 'live') {
      if (legacyMode) lastKnownLegacyFiatSnapshot = selected.cache;
      else lastKnownFiatSnapshot = selected.cache;
    }
  }, [selected.cache, selected.freshness, legacyMode]);

  const refresh = useCallback(async () => {
    await Promise.all([sol.refresh(), legacyMode ? usdc.refresh() : held.refresh(), prices.refresh(), valuation.refresh()]);
  }, [sol.refresh, usdc.refresh, held.refresh, prices.refresh, valuation.refresh, legacyMode]);

  const caveat = legacyMode ? null : walletTotalCaveat(selected.composition.result.unpricedMintCount);
  return {
    status: selected.composition.result.status,
    totalFiat: selected.composition.result.totalFiat,
    display: selected.composition.display,
    caveat,
    holdingsBook: held.book,
    result: selected.composition.result,
    holdings: selected.holdings,
    quotes: selected.quotes,
    priceStatus: selected.priceStatus,
    stale: selected.freshness === 'stale',
    staleAsOfMs: selected.staleAsOfMs,
    refreshing: sol.refreshing || (legacyMode ? usdc.refreshing : held.refreshing) || prices.refreshing,
    refresh,
  };
}
