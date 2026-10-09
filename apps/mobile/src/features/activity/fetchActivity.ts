import { PublicKey, type Connection } from '@solana/web3.js';
import { openSolanaConnection } from '@/src/features/send/solanaConnection';
import { classifyParsedActivity } from './classifyActivity';
import type { ActivityItem } from './types';

const DEFAULT_LIMIT = 40;

/**
 * Must be the JSON integer 1, not "1". A read advertising 0 gets -32015 for
 * the first v1 signature in the window.
 */
export const ACTIVITY_MAX_SUPPORTED_TX_VERSION = 1;

export type ActivityConnection = Pick<
  Connection,
  'getSignaturesForAddress' | 'rpcEndpoint'
>;

export type FetchActivityDeps = {
  openConnection?: () => Promise<ActivityConnection>;
  fetchImpl?: typeof fetch;
};

type RpcBatchEntry = {
  id?: unknown;
  result?: unknown;
  error?: unknown;
};

/**
 * Raw `getTransaction` / `jsonParsed` batch, deliberately NOT
 * `Connection.getParsedTransactions`. web3.js 1.98 runs every parsed row
 * through a superstruct whose `version` is `0 | 'legacy'`; one v1 row throws
 * for the whole batch and the tab goes blank. This read hands each row to the
 * classifier as-is, and a row the node errors on, or one the classifier
 * cannot read, becomes a single unknown item instead of wiping the window.
 * Do not route this back through the typed Connection method while that
 * struct is pinned.
 */
async function fetchParsedRows(args: {
  rpcEndpoint: string;
  signatures: readonly string[];
  fetchImpl: typeof fetch;
}): Promise<unknown[]> {
  const batch = args.signatures.map((signature, id) => ({
    jsonrpc: '2.0',
    id,
    method: 'getTransaction',
    params: [
      signature,
      {
        encoding: 'jsonParsed',
        commitment: 'confirmed',
        maxSupportedTransactionVersion: ACTIVITY_MAX_SUPPORTED_TX_VERSION,
      },
    ],
  }));

  const response = await args.fetchImpl(args.rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
  });
  if (!response.ok) {
    throw new Error(`Activity RPC failed: HTTP ${response.status}`);
  }
  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    throw new Error('Activity RPC returned a non-batch response');
  }

  // Batch entries may come back in any order; match them by id.
  const byId = new Map<number, RpcBatchEntry>();
  for (const entry of body as RpcBatchEntry[]) {
    if (entry && typeof entry === 'object' && typeof entry.id === 'number') {
      byId.set(entry.id, entry);
    }
  }
  return args.signatures.map((_, id) => {
    const entry = byId.get(id);
    if (!entry || entry.error !== undefined) return null;
    const result = entry.result;
    return result && typeof result === 'object' ? result : null;
  });
}

/** Fetch recent signatures for an address and classify via parsed txs. */
export async function fetchWalletActivity(
  address: string,
  limit: number = DEFAULT_LIMIT,
  deps: FetchActivityDeps = {},
): Promise<ActivityItem[]> {
  const owner = new PublicKey(address);
  const connection = await (deps.openConnection ?? openSolanaConnection)();
  const signatures = await connection.getSignaturesForAddress(owner, {
    limit,
  });

  if (signatures.length === 0) return [];

  const parsed = await fetchParsedRows({
    rpcEndpoint: connection.rpcEndpoint,
    signatures: signatures.map((s) => s.signature),
    fetchImpl: deps.fetchImpl ?? fetch,
  });

  return signatures.map((sig, index) =>
    classifyParsedActivity({
      owner: address,
      signature: sig.signature,
      blockTime: sig.blockTime,
      confirmationStatus: sig.confirmationStatus,
      signatureErr: sig.err,
      // Raw node JSON, not a struct-validated row; the classifier tolerates
      // shapes it cannot read by returning an unknown item.
      tx: parsed[index] as Parameters<typeof classifyParsedActivity>[0]['tx'],
    }),
  );
}
