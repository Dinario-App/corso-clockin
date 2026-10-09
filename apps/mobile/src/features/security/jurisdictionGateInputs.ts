/**
 * The gate's inputs, read **at confirm time** rather than closed over.
 *
 * ### Why this file exists
 *
 * The swap screen used to hold `jurisdictionGateEnabled` and
 * `observedJurisdiction` in React state and read them inside `onConfirmSwap`.
 * A previous fix added `await configLoadRef.current` before the gate call so
 * the gate "never runs against pre-load defaults". It does not work, and the
 * reason is ordinary JavaScript rather than anything about React:
 *
 * ```
 * // render N: jurisdictionGateEnabled === false (pre-load default)
 * async function onConfirmSwap() {
 *   await configLoadRef.current;        // config lands, state updates, re-render
 *   resolveSwapAccess({ gateEnabled: jurisdictionGateEnabled })  // still render N's false
 * }
 * ```
 *
 * The `await` yields, the load resolves, `setJurisdictionGateEnabled(true)`
 * runs and React re-renders — but the *running* invocation still holds the
 * `const` bindings from the render that created it. The awaited value is never
 * seen by the code after the await. And `resolveSwapAccess` short-circuits on
 * `gateEnabled: false` with `{ allowed: true }`, so the stale read is an allow.
 * That is a fail-open on the money path.
 *
 * The fix is the idiom `swap.tsx` already uses for exactly this hazard
 * (`clusterRef.current`, `signingOutputTokenFactsRef.current`): do not read
 * state after an await. Read the values the load itself produced.
 *
 * ### Fail-closed
 *
 * `readJurisdictionGateInputs` returns `null` when it cannot produce real
 * values. `null` is not "assume off" — the caller must refuse. An unreadable
 * config is not an absent restriction, and an outage must not disarm the gate
 * (see `resolveJurisdictionGateEnabled`, which holds a last-known-good for the
 * same reason).
 */
import {
  resolveJurisdictionGateEnabled,
  resolveObservedJurisdiction,
} from '@/src/lib/apiConfig';

export type JurisdictionGateInputs = {
  /** From `resolveJurisdictionGateEnabled()` — last-known-good aware. */
  gateEnabled: boolean;
  /** From `resolveObservedJurisdiction()`. `null` when the API named none. */
  observedJurisdiction: string | null;
};

/** One load of both gate inputs. Neither resolver throws on a dead config. */
export async function loadJurisdictionGateInputs(): Promise<JurisdictionGateInputs> {
  const [gateEnabled, observedJurisdiction] = await Promise.all([
    resolveJurisdictionGateEnabled(),
    resolveObservedJurisdiction(),
  ]);
  return { gateEnabled, observedJurisdiction };
}

export type JurisdictionGateInputSource = {
  /** Values from a load that has already finished, or `null`. */
  settled: JurisdictionGateInputs | null;
  /** A load started on mount that may still be in flight, or `null`. */
  inFlight: Promise<JurisdictionGateInputs> | null;
  /** Last resort when neither of the above exists. */
  load: () => Promise<JurisdictionGateInputs>;
};

/**
 * Produce the values the gate will actually be given.
 *
 * Order is settled → in-flight → a fresh load. The last branch exists so a
 * confirm that somehow runs before the mount effect is neither allowed on
 * defaults nor refused on a technicality: it pays one round trip instead.
 *
 * Returns `null` only when no honest answer could be produced. The caller
 * refuses on `null`. It never substitutes a default, because the default is an
 * allow and that is the whole bug this file exists to prevent.
 */
export async function readJurisdictionGateInputs(
  source: JurisdictionGateInputSource,
): Promise<JurisdictionGateInputs | null> {
  if (source.settled) return source.settled;
  try {
    const inputs = source.inFlight
      ? await source.inFlight
      : await source.load();
    return inputs ?? null;
  } catch {
    return null;
  }
}
