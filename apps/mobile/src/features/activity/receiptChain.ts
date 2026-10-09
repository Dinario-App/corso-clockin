import { openSolanaConnectionOnKnownNetwork } from '../send/solanaConnection';

export type ReceiptChainLeg = {
  mint: string;
  amountAtomic: string;
  decimals: number;
  direction: 'in' | 'out';
};
export type ReceiptChainRecord = {
  signature: string;
  status: 'sending' | 'confirmed' | 'finalised' | 'failed';
  statusKnown?: boolean;
  timeMs: number | null;
  legs: ReceiptChainLeg[];
  networkFeeLamports: number | null;
  nothingTaken: boolean;
};
type Row = Record<string, unknown>;
const record = (value: unknown): Row | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : null;
const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function tokenLegs(meta: Row, owner: string): ReceiptChainLeg[] {
  if (
    !Array.isArray(meta.preTokenBalances) ||
    !Array.isArray(meta.postTokenBalances)
  )
    return [];
  type Balance = {
    mint: string;
    owner: string;
    amount: bigint;
    decimals: number;
  };
  const sides: Map<number, Balance>[] = [];
  for (const rows of [meta.preTokenBalances, meta.postTokenBalances]) {
    const side = new Map<number, Balance>();
    for (const value of rows) {
      const row = record(value);
      const amount = record(row?.uiTokenAmount);
      if (
        !row ||
        !amount ||
        !natural(row.accountIndex) ||
        typeof row.mint !== 'string' ||
        !row.mint ||
        typeof row.owner !== 'string' ||
        !row.owner ||
        typeof amount.amount !== 'string' ||
        !/^\d+$/.test(amount.amount) ||
        !natural(amount.decimals) ||
        amount.decimals > 255 ||
        side.has(row.accountIndex)
      )
        return [];
      side.set(row.accountIndex, {
        mint: row.mint,
        owner: row.owner,
        amount: BigInt(amount.amount),
        decimals: amount.decimals,
      });
    }
    sides.push(side);
  }
  const [pre, post] = sides as [Map<number, Balance>, Map<number, Balance>];
  const totals = new Map<string, { amount: bigint; decimals: number }>();
  for (const index of new Set([...pre.keys(), ...post.keys()])) {
    const before = pre.get(index);
    const after = post.get(index);
    if (before?.owner !== owner && after?.owner !== owner) continue;
    if (
      before &&
      after &&
      (before.owner !== after.owner ||
        before.mint !== after.mint ||
        before.decimals !== after.decimals)
    )
      return [];
    const balance = after ?? before!;
    const previous = totals.get(balance.mint);
    if (previous && previous.decimals !== balance.decimals) return [];
    totals.set(balance.mint, {
      amount:
        (previous?.amount ?? 0n) +
        (after?.amount ?? 0n) -
        (before?.amount ?? 0n),
      decimals: balance.decimals,
    });
  }
  return [...totals].flatMap(
    ([mint, { amount, decimals }]): ReceiptChainLeg[] =>
      amount === 0n
        ? []
        : [
            {
              mint,
              amountAtomic: (amount < 0n ? -amount : amount).toString(),
              decimals,
              direction: amount < 0n ? 'out' : 'in',
            },
          ],
  );
}

export function parseReceiptChain(args: {
  signature: string;
  owner: string;
  signatureStatus: unknown;
  transaction: unknown;
}): ReceiptChainRecord {
  const signatureStatus = record(args.signatureStatus);
  const transaction = record(args.transaction);
  const meta = record(transaction?.meta);
  const failed =
    (signatureStatus?.err !== undefined && signatureStatus.err !== null) ||
    (meta?.err !== undefined && meta.err !== null);
  const commitment =
    signatureStatus?.err === null ? signatureStatus.confirmationStatus : null;
  const status = failed
    ? 'failed'
    : commitment === 'finalized'
      ? 'finalised'
      : commitment === 'confirmed'
        ? 'confirmed'
        : 'sending';
  const blockTime = transaction?.blockTime;
  return {
    signature: args.signature,
    status,
    statusKnown:
      failed ||
      commitment === 'processed' ||
      commitment === 'confirmed' ||
      commitment === 'finalized',
    timeMs:
      natural(blockTime) && Number.isSafeInteger(blockTime * 1000)
        ? blockTime * 1000
        : null,
    legs: !failed && meta?.err === null ? tokenLegs(meta, args.owner) : [],
    networkFeeLamports: natural(meta?.fee) ? meta.fee : null,
    // A failed swap may still pay fees. This reader makes no zero-loss claim.
    nothingTaken: false,
  };
}

type ReceiptConnection = {
  rpcEndpoint: string;
  getSignatureStatuses: (
    signatures: string[],
    config: { searchTransactionHistory: boolean },
  ) => Promise<{ value: unknown[] }>;
};
export type ReceiptChainDeps = {
  openConnection?: () => Promise<ReceiptConnection>;
  fetchImpl?: typeof fetch;
};

export async function fetchReceiptChain(
  signature: string,
  owner: string,
  deps: ReceiptChainDeps = {},
): Promise<ReceiptChainRecord> {
  const connection = await (
    deps.openConnection ?? openSolanaConnectionOnKnownNetwork
  )();
  const statuses = await connection.getSignatureStatuses([signature], {
    searchTransactionHistory: true,
  });
  const response = await (deps.fetchImpl ?? fetch)(connection.rpcEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: [
        signature,
        {
          encoding: 'jsonParsed',
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 1,
        },
      ],
    }),
  });
  if (!response.ok)
    throw new Error(`Receipt RPC failed: HTTP ${response.status}`);
  const body = record(await response.json());
  if (!body || body.id !== 1 || body.error !== undefined || !('result' in body))
    throw new Error('Receipt RPC returned invalid transaction evidence');
  return parseReceiptChain({
    signature,
    owner,
    signatureStatus: statuses.value[0],
    transaction: body.result,
  });
}
