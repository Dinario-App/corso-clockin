import { Connection, PublicKey } from '@solana/web3.js';
import { resolveNetworkStatus } from '@/src/lib/apiConfig';
import {
  fetchSolBalanceViaApi,
  resolveApiBaseUrl,
  type FetchSolBalanceArgs,
  type SolBalanceClientErrorCode,
} from './fetchSolBalanceViaApi';
import {
  readAttemptFromRpcUrls,
  redactRpcUrl,
  RpcAttemptsError,
  type RpcAttemptFailure,
  type RpcFailureCode,
} from './rpcAttempts';

export type FetchSolBalanceDeps = Pick<
  FetchSolBalanceArgs,
  'fetchImpl' | 'apiBaseUrl' | 'signal'
> & {
  rpcReadImpl?: (rpcUrl: string, address: string) => Promise<number>;
};

/** The real fallback read. Kept out of the main flow so it can be replaced. */
async function readLamportsFromConnection(
  rpcUrl: string,
  address: string,
): Promise<number> {
  const connection = new Connection(rpcUrl, 'confirmed');
  return await connection.getBalance(new PublicKey(address), 'confirmed');
}

/** How each client refusal is named in the aggregate error. */
const FAILURE_CODES: Record<SolBalanceClientErrorCode, RpcFailureCode> = {
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
};

export async function fetchSolBalanceLamports(
  address: string,
  deps: FetchSolBalanceDeps = {},
): Promise<number> {
  // Validates the address locally so a malformed one never costs a request.
  // ⚠️ This throws with the address in its message — `reportBalanceReadFailure`
  // scrubs it, which is why that scrub covers the pre-request path too.
  new PublicKey(address);

  const network = await resolveNetworkStatus();
  if (network.state !== 'known') {
    throw new Error(`SOL balance withheld: network ${network.reason}`);
  }

  const apiResult = await fetchSolBalanceViaApi({
    address,
    cluster: network.cluster,
    ...deps,
  });

  if (apiResult.ok) return apiResult.lamports;

  const apiAttempt: RpcAttemptFailure = {
    url: redactRpcUrl(resolveApiBaseUrl(deps.apiBaseUrl)),
    code: FAILURE_CODES[apiResult.code],
    ...(apiResult.httpStatus === undefined
      ? {}
      : { httpStatus: apiResult.httpStatus }),
  };

  if (apiResult.code === 'cluster_mismatch') {
    throw new RpcAttemptsError('SOL balance', [apiAttempt]);
  }

  const rpcRead = deps.rpcReadImpl ?? readLamportsFromConnection;
  const fallback = await readAttemptFromRpcUrls(network.rpcUrls, (rpcUrl) =>
    rpcRead(rpcUrl, address),
  );

  if (fallback.ok) return fallback.value;

  // Every transport, in the order tried, with the API named first.
  throw new RpcAttemptsError('SOL balance', [apiAttempt, ...fallback.attempts]);
}
