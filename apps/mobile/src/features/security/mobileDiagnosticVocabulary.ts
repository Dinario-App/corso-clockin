export const MOBILE_LEVELS: ReadonlySet<string> = new Set([
  'fatal',
  'error',
  'warning',
  'info',
  'debug',
]);

export const MOBILE_PLATFORMS: ReadonlySet<string> = new Set(['javascript']);

export const MOBILE_ENVIRONMENTS = ['production', 'staging', 'development'] as const;
export type MobileSentryEnvironment = (typeof MOBILE_ENVIRONMENTS)[number];
export const MOBILE_ENVIRONMENT_SET: ReadonlySet<string> = new Set(MOBILE_ENVIRONMENTS);

/**
 * Swap error codes Corso's own code defines (mobile `SwapApiError` call sites
 * and the API's `/v1/swap/*` error literals). A code from a response body is
 * forwarded only if it is one of these.
 */
export const SWAP_ERROR_CODES = [
  'api_unconfigured',
  'swap_confirm_invalid',
  'swap_confirm_timeout',
  'swap_disabled',
  'swap_execute_failed',
  'swap_execute_provider_error',
  'swap_execute_unsupported',
  'swap_failed',
  'swap_failed_on_chain',
  'swap_fee_dropped',
  'swap_fee_invalid_configuration',
  'swap_fee_unconfigured',
  'swap_instruction_version_drift',
  'swap_instruction_version_unpinned',
  'swap_land_blockhash_expired',
  'swap_land_dropped',
  'swap_land_failed',
  'swap_land_failed_on_chain',
  'swap_land_insufficient_funds',
  'swap_land_rejected',
  'swap_land_rpc_unavailable',
  'swap_land_simulation_failed',
  'swap_land_slippage_exceeded',
  'swap_land_uncertain',
  'swap_land_unsupported',
  'swap_order_failed',
  'swap_order_provider_error',
  'swap_program_unexpected',
  'swap_provider_error',
  'swap_provider_unconfigured',
  'swap_quote_digest_mismatch',
  'swap_quote_invalid',
  'swap_quote_mismatch',
  'swap_quote_unbound',
  'swap_quote_unknown',
  'swap_rpc_unconfigured',
  'swap_mint_facts_unavailable',
  'swap_token2022_buy_requires_sol',
  'swap_semantics',
  'swap_signature_mismatch',
  'swap_signed_transaction_rejected',
  'swap_slippage_unsupported',
  'swap_transaction_unavailable',
] as const;
export const SWAP_ERROR_CODE_SET: ReadonlySet<string> = new Set(SWAP_ERROR_CODES);

/** Buckets for failures whose own code is not in the vocabulary. */
export const SWAP_FAILURE_BUCKETS = [
  'signing_refused',
  'execute_or_confirm_failed',
  'swap_api_error',
  'swap_http_4xx',
  'swap_http_5xx',
  'unknown',
] as const;

/** Allowed values per diagnostic tag key. Keys not listed never leave. */
export const MOBILE_TAG_VOCABULARY: Readonly<Record<string, ReadonlySet<string>>> = {
  component: new Set(['root_error_boundary']),
  stage: new Set(['render', 'confirm']),
  feature: new Set(['swap']),
  code: new Set<string>([...SWAP_FAILURE_BUCKETS, ...SWAP_ERROR_CODES]),
};

export const MOBILE_EXCEPTION_TYPES: ReadonlySet<string> = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'EvalError',
  'URIError',
  'AggregateError',
  'SwapApiError',
  'SwapLandUncertainError',
]);
export const MOBILE_UNLISTED_EXCEPTION_TYPE = 'UnlistedError';
