import {
  SOL_DECIMALS,
  type HoldingLine,
  type HoldingsSnapshot,
} from './computeFiatTotal';
import { USDC_DECIMALS, usdcMintForCluster } from './usdcConstants';
import { SOL_MINT } from '@/src/features/swap/tokens';

export type QuantityChannelStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SolQuantityInput = {
  status: QuantityChannelStatus;
  /** Lamports when known; null when unknown. */
  lamports: number | null;
};

export type UsdcQuantityInput = {
  status: QuantityChannelStatus;
  /** Atomic USDC (decimals=6) when known; null when unknown. */
  atomic: bigint | null;
};

export type BuildHoldingsSnapshotArgs = {
  address: string;
  /** `null` when the network was never named — see `fiatTotalNetworkGate`. */
  cluster: 'devnet' | 'mainnet-beta' | null;
  asOfMs: number;
  sol: SolQuantityInput;
  usdc: UsdcQuantityInput;
  /** Home vs pot surface metadata; exclusion still via includeInHomeTotal. */
  scope?: HoldingsSnapshot['scope'];
  /**
   * Extra lines (e.g. Autopilot pot) — typically `includeInHomeTotal: false`.
   * Kept for a later Grid pot; Grid itself is not enabled.
   */
  additionalLines?: HoldingLine[];
};

/**
 * True when a channel has an accepted quantity (ready with a value,
 * including known zero). Idle/loading/error without a value → unknown.
 */
export function channelHasQuantity(
  status: QuantityChannelStatus,
  hasValue: boolean,
): boolean {
  return status === 'ready' && hasValue;
}

/**
 * Compose SOL + USDC quantity status into HoldingsSnapshot.quantityStatus.
 *
 * - loading: either channel still in flight without a ready quantity
 * - ready: both channels ready with known quantities (incl. zero)
 * - partial: one ready, the other error/unknown without a quantity
 * - error: neither channel has a usable quantity and at least one errored
 */
export function composeQuantityStatus(
  sol: SolQuantityInput,
  usdc: UsdcQuantityInput,
): HoldingsSnapshot['quantityStatus'] {
  const solOk = channelHasQuantity(
    sol.status,
    sol.lamports !== null && Number.isFinite(sol.lamports),
  );
  const usdcOk = channelHasQuantity(usdc.status, usdc.atomic !== null);

  if (solOk && usdcOk) return 'ready';

  const solPending = sol.status === 'idle' || sol.status === 'loading';
  const usdcPending = usdc.status === 'idle' || usdc.status === 'loading';
  if (solPending || usdcPending) return 'loading';

  // Neither pending: each is ready-without-value (shouldn't happen) or error.
  if (solOk || usdcOk) return 'partial';
  return 'error';
}

/** Lamports → atomic decimal string; null when unsafe / unknown. */
export function solAtomicFromLamports(lamports: number | null): string | null {
  if (lamports === null) return null;
  if (!Number.isInteger(lamports) || lamports < 0 || !Number.isSafeInteger(lamports)) {
    return null;
  }
  return String(lamports);
}

export function buildSolHoldingLine(
  lamports: number,
  includeInHomeTotal = true,
): HoldingLine | null {
  const atomic = solAtomicFromLamports(lamports);
  if (atomic === null) return null;
  return {
    mint: SOL_MINT,
    symbol: 'SOL',
    atomic,
    decimals: SOL_DECIMALS,
    includeInHomeTotal,
  };
}

export function buildUsdcHoldingLine(args: {
  atomic: bigint;
  cluster: 'devnet' | 'mainnet-beta' | null;
  includeInHomeTotal?: boolean;
}): HoldingLine | null {
  if (args.cluster === null) return null;
  if (args.atomic < 0n) return null;
  return {
    mint: usdcMintForCluster(args.cluster),
    symbol: 'USDC',
    atomic: args.atomic.toString(),
    decimals: USDC_DECIMALS,
    includeInHomeTotal: args.includeInHomeTotal ?? true,
  };
}

/**
 * Pure join: SOL + USDC readiness → HoldingsSnapshot.
 * Does not invent quantities. Does not call network or price modules.
 */
export function buildHoldingsSnapshot(
  args: BuildHoldingsSnapshotArgs,
): HoldingsSnapshot {
  const quantityStatus = composeQuantityStatus(args.sol, args.usdc);
  const lines: HoldingLine[] = [];

  if (quantityStatus === 'ready') {
    const solLine = buildSolHoldingLine(args.sol.lamports as number);
    const usdcLine = buildUsdcHoldingLine({
      atomic: args.usdc.atomic as bigint,
      cluster: args.cluster,
    });
    // Corrupt ready values fail closed as partial book (compute → unavailable).
    if (!solLine || !usdcLine) {
      return {
        address: args.address,
        cluster: args.cluster,
        asOfMs: args.asOfMs,
        lines: [...(args.additionalLines ?? [])],
        quantityStatus: 'partial',
        scope: args.scope ?? 'home',
      };
    }
    lines.push(solLine, usdcLine);
  }

  if (args.additionalLines?.length) {
    lines.push(...args.additionalLines);
  }

  return {
    address: args.address,
    cluster: args.cluster,
    asOfMs: args.asOfMs,
    lines,
    quantityStatus,
    scope: args.scope ?? 'home',
  };
}
