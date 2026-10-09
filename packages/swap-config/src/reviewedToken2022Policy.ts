export type ReviewedToken2022Fields = {
  tokenProgram: string | null;
  token2022ExtensionTypeIds?: readonly number[] | null;
  transferHook: boolean | null;
  transferFee: boolean | null;
  permanentDelegate?: boolean | null;
  defaultAccountFrozen?: boolean | null;
};
const ALLOWED_EXTENSION_IDS = new Set([7, 18, 19, 20, 21, 22, 23]);

/** Missing or malformed facts never confer manual-swap eligibility. */
export function isReviewedToken2022Allowed(
  facts: ReviewedToken2022Fields | null | undefined,
): boolean {
  return (
    facts != null &&
    facts.tokenProgram === 'token-2022' &&
    facts.transferHook === false &&
    facts.transferFee === false &&
    facts.permanentDelegate === false &&
    facts.defaultAccountFrozen === false &&
    Array.isArray(facts.token2022ExtensionTypeIds) &&
    Array.from(facts.token2022ExtensionTypeIds).every(
      (id) => Number.isInteger(id) && ALLOWED_EXTENSION_IDS.has(id),
    )
  );
}
