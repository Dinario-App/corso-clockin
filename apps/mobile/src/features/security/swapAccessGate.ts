/**
 * The gate as the swap path sees it. Pure — config and signals come in as
 * arguments, so this stays testable without a network or a device.
 *
 * Composes the three pieces that already exist:
 *
 *   jurisdictionResolver  →  which jurisdiction, or none
 *   assetAccessGate       →  may this class act here
 *   this file             →  what the swap screen does about it
 *
 * ### The enabled flag is checked first, and it is not a safety hole
 *
 * With the flag off this returns `allowed` without consulting anything. That
 * looks like a bypass and is not: the gate is fail-closed, so with no
 * jurisdiction source wired it refuses **every** acquisition. Enforcing it
 * before a source exists would not protect anyone, it would take swap down.
 *
 * So the sequencing is deliberate and mirrors `FLAG_SWAP_METIS`: land the code,
 * wire the source, then flip the flag. What this file guarantees today is that
 * the wiring exists and is tested, not that it is enforced.
 */
import {
  resolveMintAccess,
  type AccessDecision,
  type AssetAction,
} from './assetAccessGate';
import {
  resolveJurisdiction,
  type JurisdictionSignal,
} from './jurisdictionResolver';

export type SwapAccessInput = {
  /** From `resolveJurisdictionGateEnabled()`. */
  gateEnabled: boolean;
  /** Everything known about where this user is. May be empty. */
  signals: readonly JurisdictionSignal[];
  mint: string;
  symbol?: string | null;
  name?: string | null;
  /** A swap is an acquisition of the receive token. */
  action?: AssetAction;
};

export type SwapAccessResult = AccessDecision & {
  /** True when the gate was consulted. False when the flag is off. */
  enforced: boolean;
  /** The jurisdiction used, for logging and for the refusal string. */
  jurisdiction: string | null;
};

/**
 * Decide whether this swap may proceed.
 *
 * The `action` defaults to `acquire` because that is what a swap does to the
 * receive side, and `acquire` is the only action the gate restricts. A caller
 * asking about `view` or `dispose` always gets through, which is the shape that
 * keeps a restricted user able to see and exit what they already hold.
 */
export function resolveSwapAccess(input: SwapAccessInput): SwapAccessResult {
  if (!input.gateEnabled) {
    return { allowed: true, enforced: false, jurisdiction: null };
  }

  const { jurisdiction } = resolveJurisdiction(input.signals);
  const decision = resolveMintAccess({
    mint: input.mint,
    symbol: input.symbol,
    name: input.name,
    jurisdiction,
    action: input.action ?? 'acquire',
  });

  return { ...decision, enforced: true, jurisdiction };
}

/**
 * Whether a refusal is about *where the user is* rather than *what the asset
 * is*. The two want different words on screen, and conflating them tells
 * someone in New York that Corso does not offer the token.
 */
export function isJurisdictionRefusal(result: SwapAccessResult): boolean {
  return (
    !result.allowed &&
    (result.reason === 'jurisdiction_restricted' ||
      result.reason === 'jurisdiction_unknown' ||
      result.reason === 'jurisdiction_underspecified')
  );
}
