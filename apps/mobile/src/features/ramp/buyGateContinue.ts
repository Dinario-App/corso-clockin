import {
  isJurisdictionRefusal,
  resolveSwapAccess,
  type SwapAccessResult,
} from '@/src/features/security/swapAccessGate';
import { SOL_MINT, usdcMintForCluster } from '@/src/features/swap/tokens';
import type { RampAsset } from '@/src/features/ramp/rampAssets';
import {
  runBuyContinue,
  type BuyContinueResult,
} from '@/src/features/ramp/buyContinueLogic';

/** The two refusal strings the Buy screen can show for an access refusal. */
export type BuyAccessCopy = {
  /** Shown when the refusal is about where the user is. */
  accessJurisdiction: string;
  /** Shown when the refusal is about what the asset is. */
  accessAsset: string;
};

export type BuyGateInputs = {
  /** From `resolveJurisdictionGateEnabled()`. */
  gateEnabled: boolean;
  /** From `resolveObservedJurisdiction()`. `null` when the API named none. */
  observedJurisdiction: string | null;
  /** The asset the user picked, or `null` before a selection settles. */
  selectedAsset: RampAsset | null;
  /** USDC's mint is cluster-specific, so the classifier gets a real mint. */
  cluster: 'devnet' | 'mainnet-beta';
};

export type BuyGateDecision =
  | { allowed: true; enforced: boolean; access: SwapAccessResult }
  | {
      allowed: false;
      enforced: boolean;
      /** Which refusal this is, so the copy cannot be picked at random. */
      refusal: 'jurisdiction' | 'asset';
      errorMessage: string;
      access: SwapAccessResult;
    };

export function buyGateMint(
  selectedAsset: RampAsset | null,
  cluster: 'devnet' | 'mainnet-beta',
): string {
  return selectedAsset === 'SOL' ? SOL_MINT : usdcMintForCluster(cluster);
}

/**
 * Decide whether this Buy may proceed.
 *
 * `action` is locked to `'acquire'`. Buy is an acquisition of fiat-purchased
 * crypto; there is no disposal path through this door, and passing `'dispose'`
 * from here to "let them through" would be a hole dressed as kindness.
 *
 * The asset-class half is inert on this door: `RampAsset` is only SOL or USDC
 * and neither can be a tokenised equity. Only the jurisdiction half does work.
 * The `refusal` discriminant is still computed honestly rather than assumed,
 * so the door does not start lying if `RampAsset` ever widens.
 */
export function resolveBuyGateDecision(
  inputs: BuyGateInputs,
  copy: BuyAccessCopy,
): BuyGateDecision {
  const access = resolveSwapAccess({
    gateEnabled: inputs.gateEnabled,
    signals: [{ source: 'api-ip', value: inputs.observedJurisdiction }],
    mint: buyGateMint(inputs.selectedAsset, inputs.cluster),
    symbol: inputs.selectedAsset,
    action: 'acquire',
  });

  if (access.allowed) {
    return { allowed: true, enforced: access.enforced, access };
  }

  // Neither the state nor the rule is named. A restricted jurisdiction is a
  // spoof map: telling an honest user which place is blocked tells a probing
  // user exactly what to set.
  const jurisdictional = isJurisdictionRefusal(access);
  return {
    allowed: false,
    enforced: access.enforced,
    refusal: jurisdictional ? 'jurisdiction' : 'asset',
    errorMessage: jurisdictional ? copy.accessJurisdiction : copy.accessAsset,
    access,
  };
}

export type GatedBuyContinueResult =
  | {
      /** The gate refused. No ramp session exists and none was attempted. */
      status: 'refused';
      refusal: 'jurisdiction' | 'asset';
      errorMessage: string;
      decision: BuyGateDecision;
    }
  | {
      /** The gate allowed, and the downstream continue ran. */
      status: 'continued';
      decision: BuyGateDecision;
      result: BuyContinueResult;
    };

export async function runGatedBuyContinue(args: {
  gate: BuyGateInputs;
  copy: BuyAccessCopy;
  continueArgs: Parameters<typeof runBuyContinue>[0];
  runContinue?: typeof runBuyContinue;
  /**
   * Fired once, only after the gate ALLOWS and before the continue runs. The
   * screen raises its busy state here, so a refused user never sees a spinner
   * for work that is not going to happen. Never fired on a refusal.
   */
  onAllowed?: () => void;
}): Promise<GatedBuyContinueResult> {
  const decision = resolveBuyGateDecision(args.gate, args.copy);

  if (!decision.allowed) {
    return {
      status: 'refused',
      refusal: decision.refusal,
      errorMessage: decision.errorMessage,
      decision,
    };
  }

  args.onAllowed?.();

  const runContinue = args.runContinue ?? runBuyContinue;
  const result = await runContinue(args.continueArgs);
  return { status: 'continued', decision, result };
}
