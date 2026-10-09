import { PublicKey } from '@solana/web3.js';
import { resolveNetworkStatus } from '@/src/lib/apiConfig';
import {
  fetchUsdcBalanceViaApi,
  type FetchUsdcBalanceArgs,
  type UsdcBalanceClientErrorCode,
} from './fetchUsdcBalanceViaApi';
import { redactRpcUrl, RpcAttemptsError, type RpcFailureCode } from './rpcAttempts';

export type FetchUsdcBalanceDeps = Pick<
  FetchUsdcBalanceArgs,
  'fetchImpl' | 'apiBaseUrl' | 'signal'
>;

/** How each client refusal is named in the aggregate error. */
const FAILURE_CODES: Record<UsdcBalanceClientErrorCode, RpcFailureCode> = {
  missing_api_url: 'rejected',
  invalid_request: 'rejected',
  network: 'network',
  schema: 'rejected',
  rate_limited: 'rate_limited',
  forbidden: 'forbidden',
  unconfigured: 'unconfigured',
  unreadable: 'unreadable',
  http: 'http',
  cluster_mismatch: 'cluster_mismatch',
  mint_mismatch: 'mint_mismatch',
};

export async function fetchUsdcBalanceAtomic(
  address: string,
  deps: FetchUsdcBalanceDeps = {},
): Promise<bigint> {
  // Validates the address locally so a malformed one never costs a request.
  // ⚠️ This throws with the address in its message — `reportBalanceReadFailure`
  // scrubs it, which is why that scrub covers the pre-request path too.
  new PublicKey(address);

  const network = await resolveNetworkStatus();
  if (network.state !== 'known') {
    throw new Error(`USDC balance withheld: network ${network.reason}`);
  }

  const result = await fetchUsdcBalanceViaApi({
    address,
    cluster: network.cluster,
    ...deps,
  });

  if (!result.ok) {
    throw new RpcAttemptsError('USDC balance', [
      {
        url: redactRpcUrl(deps.apiBaseUrl ?? process.env.EXPO_PUBLIC_API_URL),
        code: FAILURE_CODES[result.code],
        ...(result.httpStatus === undefined
          ? {}
          : { httpStatus: result.httpStatus }),
      },
    ]);
  }

  return result.atomic;
}
