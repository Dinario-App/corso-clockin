/**
 * Shared SOL reserve used by Ask and the Swap composer.
 *
 * This is a product-side affordability guard, not a quote fee and not an
 * estimate of `prioritizationFeeLamports`. It leaves room for network fees and
 * first-time token-account rent before any amount reaches the composer.
 */
export const SOL_SWAP_FEE_RENT_RESERVE_LAMPORTS = 10_000_000n;
