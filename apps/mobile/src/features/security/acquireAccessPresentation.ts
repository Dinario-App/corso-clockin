import { copy } from '@/constants/copy';
import type { JurisdictionGateInputs } from '@/src/features/security/jurisdictionGateInputs';
import {
  isJurisdictionRefusal,
  resolveSwapAccess,
} from '@/src/features/security/swapAccessGate';

export type AcquireAccess =
  | { kind: 'unknown' }
  | { kind: 'allowed' }
  /** The confirm would refuse this acquire. `note` is the confirm's own line. */
  | { kind: 'refused'; note: string };

export const ACQUIRE_ACCESS_UNKNOWN: AcquireAccess = { kind: 'unknown' };

export function resolveAcquireAccess(args: {
  gateInputs: JurisdictionGateInputs | null | undefined;
  mint: string;
  symbol?: string | null;
  name?: string | null;
}): AcquireAccess {
  if (args.gateInputs == null) return ACQUIRE_ACCESS_UNKNOWN;
  const access = resolveSwapAccess({
    gateEnabled: args.gateInputs.gateEnabled,
    signals: [
      { source: 'api-ip', value: args.gateInputs.observedJurisdiction },
    ],
    mint: args.mint,
    symbol: args.symbol,
    name: args.name,
    action: 'acquire',
  });
  if (access.allowed) return { kind: 'allowed' };
  return {
    kind: 'refused',
    note: isJurisdictionRefusal(access)
      ? copy.swap.accessJurisdiction
      : copy.swap.accessAsset,
  };
}
