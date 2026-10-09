import {
  isJurisdictionRefusal,
  resolveSwapAccess,
  type SwapAccessResult,
} from '@/src/features/security/swapAccessGate';
import type { JurisdictionGateInputs } from '@/src/features/security/jurisdictionGateInputs';

/** The three refusal strings the swap screen can show before signing. */
export type SwapAccessCopy = {
  /** Shown when the required disclosures could not be established. */
  accessDisclosures: string;
  /** Shown when the gate's own inputs could not be read. */
  accessUnavailable: string;
  /** Shown when the refusal is about where the user is. */
  accessJurisdiction: string;
  /** Shown when the refusal is about what the asset is. */
  accessAsset: string;
};

export type SwapGateAsset = {
  /** `frozenIntent.outputMint` for the acquire leg, `inputMint` for dispose. */
  mint: string;
  /** `frozenIntent.receiveSymbol` for acquire, `paySymbol` for dispose. */
  symbol?: string | null;
  /**
   * The Jupiter-sourced name, or `null` when that slice did not resolve.
   *
   * Symbol *and* name are both passed because `SwapToken` carries no name and
   * mint-only classification cannot see an issuer marker.
   */
  name?: string | null;
};

/** Which of the three refusals fired, so the copy cannot be picked at random. */
export type SwapRefusal =
  | 'disclosures'
  | 'unavailable'
  | 'jurisdiction'
  | 'asset';

export type SwapGateDecision =
  | {
      allowed: true;
      enforced: boolean;
      /** The `acquire` answer for the receive leg. */
      access: SwapAccessResult;
      /** The `dispose` answer for the pay leg. */
      disposeAccess: SwapAccessResult;
    }
  | {
      allowed: false;
      refusal: SwapRefusal;
      errorMessage: string;
      /** Absent for the two refusals that fire before the gate is consulted. */
      access: SwapAccessResult | null;
      /** Absent for those same two, and for an acquire refusal. */
      disposeAccess: SwapAccessResult | null;
    };

export type SwapGateArgs = {
  /**
   * `disclosuresReadyRef.current`, read by the caller after awaiting the mount
   * load. A ref and not state, because a closure is not refreshed by awaiting
   * inside it.
   */
  disclosuresReady: boolean;
  /**
   * Produces the gate's inputs, or `null` when no honest answer exists.
   *
   * ⚠️ A thunk, not a value. The disclosure refusal currently returns *before*
   * `readJurisdictionGateInputs` is called, and passing an already-awaited
   * value here would quietly move that read ahead of the refusal.
   */
  readGateInputs: () => Promise<JurisdictionGateInputs | null>;
  /** The receive leg. Asked about `acquire`. */
  asset: SwapGateAsset;
  dispose: SwapGateAsset;
  copy: SwapAccessCopy;
};

export async function resolveSwapGateDecision(
  args: SwapGateArgs,
): Promise<SwapGateDecision> {
  if (!args.disclosuresReady) {
    return {
      allowed: false,
      refusal: 'disclosures',
      errorMessage: args.copy.accessDisclosures,
      access: null,
      disposeAccess: null,
    };
  }

  const gateInputs = await args.readGateInputs();
  if (!gateInputs) {
    return {
      allowed: false,
      refusal: 'unavailable',
      errorMessage: args.copy.accessUnavailable,
      access: null,
      disposeAccess: null,
    };
  }

  const signals = [
    { source: 'api-ip' as const, value: gateInputs.observedJurisdiction },
  ];

  const access = resolveSwapAccess({
    gateEnabled: gateInputs.gateEnabled,
    signals,
    mint: args.asset.mint,
    symbol: args.asset.symbol,
    name: args.asset.name,
    action: 'acquire',
  });

  const disposeAccess = resolveSwapAccess({
    gateEnabled: gateInputs.gateEnabled,
    signals,
    mint: args.dispose.mint,
    symbol: args.dispose.symbol,
    name: args.dispose.name,
    action: 'dispose',
  });

  if (access.allowed && disposeAccess.allowed) {
    return {
      allowed: true,
      enforced: access.enforced,
      access,
      disposeAccess,
    };
  }

  // Neither the state nor the rule is named. A restricted jurisdiction is a
  // spoof map: telling an honest user which place is blocked tells a probing
  // user exactly what to set.
  //
  // Acquire is read first so the existing refusal keeps its existing words on
  // every pair that fires today.
  const refused = access.allowed ? disposeAccess : access;
  const jurisdictional = isJurisdictionRefusal(refused);
  return {
    allowed: false,
    refusal: jurisdictional ? 'jurisdiction' : 'asset',
    errorMessage: jurisdictional
      ? args.copy.accessJurisdiction
      : args.copy.accessAsset,
    access,
    disposeAccess,
  };
}

export type GatedSwapConfirmResult =
  | {
      /** A refusal fired. Nothing was signed and nothing was attempted. */
      status: 'refused';
      refusal: SwapRefusal;
      errorMessage: string;
      decision: SwapGateDecision;
    }
  | {
      /** Every refusal passed, and the confirm body ran. */
      status: 'continued';
      decision: SwapGateDecision;
    };

export async function runGatedSwapConfirm(
  args: SwapGateArgs & { proceed: () => Promise<void> },
): Promise<GatedSwapConfirmResult> {
  const decision = await resolveSwapGateDecision(args);

  if (!decision.allowed) {
    return {
      status: 'refused',
      refusal: decision.refusal,
      errorMessage: decision.errorMessage,
      decision,
    };
  }

  await args.proceed();
  return { status: 'continued', decision };
}
