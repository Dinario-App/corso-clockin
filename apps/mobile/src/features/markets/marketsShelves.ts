import type { JurisdictionGateInputs } from '@/src/features/security/jurisdictionGateInputs';
import {
  ACQUIRE_ACCESS_UNKNOWN,
  resolveAcquireAccess,
  type AcquireAccess,
} from '@/src/features/security/acquireAccessPresentation';

export type InvestmentPlansView = { kind: 'absent'; reason: 'no-source' };

/** No plans source exists, so there is nothing to present. */
export function presentInvestmentPlans(): InvestmentPlansView {
  return { kind: 'absent', reason: 'no-source' };
}

export const STOCKS_SHELF_ACCESS_PROBE = Object.freeze({
  mint: 'StocksShelfAccessProbe1111111111111111111111',
  symbol: 'SPYx',
  name: 'SP500 xStock',
});

export type StocksShelfView =
  | {
      kind: 'absent';
      reason: 'no-feed';
      access: Exclude<AcquireAccess, { kind: 'refused' }>;
    }
  /** `note` is the confirm's own line, as `resolveAcquireAccess` worded it. */
  | { kind: 'refused'; note: string };

export function presentStocksShelf(
  gateInputs: JurisdictionGateInputs | null | undefined,
): StocksShelfView {
  const access =
    gateInputs == null
      ? ACQUIRE_ACCESS_UNKNOWN
      : resolveAcquireAccess({ gateInputs, ...STOCKS_SHELF_ACCESS_PROBE });
  if (access.kind === 'refused') return { kind: 'refused', note: access.note };
  return { kind: 'absent', reason: 'no-feed', access };
}
