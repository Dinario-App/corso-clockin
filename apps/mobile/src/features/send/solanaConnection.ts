import { Connection } from '@solana/web3.js';
import {
  resolveNetworkStatus,
  resolveRpcUrls,
  type NetworkStatus,
} from '@/src/lib/apiConfig';

/**
 * Send/Swap refused to open an RPC connection because the app does not know
 * which network it is on.
 *
 * A distinct type rather than a bare `Error` so the sheet can tell "we declined"
 * apart from "the RPC was down" and show the right words. `copy.send.errorGeneric`
 * would be wrong here: nothing was attempted and nothing failed.
 */
export class SolanaNetworkUnknownError extends Error {
  readonly reason: Extract<NetworkStatus, { state: 'unknown' }>['reason'];

  constructor(reason: Extract<NetworkStatus, { state: 'unknown' }>['reason']) {
    super(`Solana connection withheld: network ${reason}`);
    this.name = 'SolanaNetworkUnknownError';
    this.reason = reason;
  }
}

/** Injected so the guard is provable without a network. Production defaults. */
export type SolanaConnectionDeps = {
  resolveNetwork?: () => Promise<NetworkStatus>;
  createConnection?: (rpcUrl: string) => Connection;
};

function defaultCreateConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed');
}

async function firstReachable(
  rpcUrls: readonly string[],
  createConnection: (rpcUrl: string) => Connection,
): Promise<Connection> {
  let lastError: unknown;

  for (const rpcUrl of rpcUrls) {
    try {
      const connection = createConnection(rpcUrl);
      // Cheap readiness check — avoids a dead primary URL.
      await connection.getLatestBlockhash('confirmed');
      return connection;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not reach Solana RPC');
}

export async function openSolanaConnection(
  deps: Pick<SolanaConnectionDeps, 'createConnection'> = {},
): Promise<Connection> {
  const rpcUrls = await resolveRpcUrls();
  return firstReachable(
    rpcUrls,
    deps.createConnection ?? defaultCreateConnection,
  );
}

export async function openSolanaConnectionOnKnownNetwork(
  deps: SolanaConnectionDeps = {},
): Promise<Connection> {
  const network = await (deps.resolveNetwork ?? resolveNetworkStatus)();
  if (network.state !== 'known') {
    throw new SolanaNetworkUnknownError(network.reason);
  }
  return firstReachable(
    network.rpcUrls,
    deps.createConnection ?? defaultCreateConnection,
  );
}
