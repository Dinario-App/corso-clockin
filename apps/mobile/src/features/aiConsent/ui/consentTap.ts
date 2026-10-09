import {
  currentConsentRequest,
  resolveConsentRequest,
  type ConsentRequest,
  type ConsentResolution,
} from '@/src/features/aiConsent/consentRequests';

export type ConsentTapStore = Readonly<{
  currentConsentRequest: () => ConsentRequest | null;
  resolveConsentRequest: (id: string, resolution: ConsentResolution) => void;
}>;

/**
 * Proof that this module verified and removed one connected request. Matching
 * fields cannot forge it: runtime authority lives in the private WeakSet.
 */
export type SettledConnectedConsentTap = Readonly<{
  requestId: string;
  resolution: ConsentResolution;
}>;

const unsettledConnectedClaims = new WeakSet<SettledConnectedConsentTap>();

function issueConnectedClaim(
  canonical: ConsentRequest,
  resolution: ConsentResolution,
): SettledConnectedConsentTap | undefined {
  if (canonical.kind !== 'connected') return undefined;
  const claim = Object.freeze({ requestId: canonical.id, resolution });
  unsettledConnectedClaims.add(claim);
  return claim;
}

/** Consume once. Presenting A's claim for B burns it without settling either. */
export function consumeSettledConnectedConsentTap(
  claim: SettledConnectedConsentTap | undefined,
  requestId: string,
  resolution: ConsentResolution,
): boolean {
  if (claim === undefined) return false;
  const issued = unsettledConnectedClaims.delete(claim);
  return issued && claim.requestId === requestId && claim.resolution === resolution;
}

const STORE: ConsentTapStore = Object.freeze({
  currentConsentRequest,
  resolveConsentRequest,
});

/**
 * Settle the tap, if it is the answer to the sheet that is up.
 *
 * Returns whether the tap was delivered. A tap is refused whenever its request
 * is not the one the queue is showing — which covers the stale tap (another
 * question's sheet is up now) and the double tap alike (the first tap took the
 * request off the queue before this one arrived). In neither case is a decision
 * recorded, the queue touched, or anything handed on.
 */
export function settleConsentTap(
  shown: ConsentRequest,
  resolution: ConsentResolution,
  deliver: (
    request: ConsentRequest,
    resolution: ConsentResolution,
    connectedClaim?: SettledConnectedConsentTap,
  ) => void,
  store: ConsentTapStore = STORE,
): boolean {
  const canonical = store.currentConsentRequest();
  if (canonical !== shown) return false;
  if (store.currentConsentRequest()?.id !== shown.id) return false;
  store.resolveConsentRequest(shown.id, resolution);
  deliver(shown, resolution, issueConnectedClaim(canonical, resolution));
  return true;
}
