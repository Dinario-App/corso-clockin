import type {
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  TokenBalance,
} from '@solana/web3.js';
import { isBoundedUsdcMint, USDC_DECIMALS } from '@/src/features/balances/usdcConstants';
import { activityTitle } from './activityLabels';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@/src/features/security/swapProgramAllowlist';
import type {
  ActivityAssetSymbol,
  ActivityItem,
  ActivityKind,
  ActivityStatus,
} from './types';

type SystemTransfer = { from: string; to: string; lamports: number };

type OwnerTokenDelta = {
  mint: string;
  accountIndex: number;
  before: bigint;
  after: bigint;
  decimals: number | null;
};

/**
 * Rows arrive as raw node JSON (see fetchActivity), where `pubkey` is a base58
 * string, as well as from web3 fixtures where it is a PublicKey.
 */
function accountKeyString(
  key:
    | { pubkey: { toBase58(): string } | string }
    | { toBase58(): string }
    | string,
): string {
  if (typeof key === 'string') return key;
  if ('pubkey' in key) {
    return typeof key.pubkey === 'string' ? key.pubkey : key.pubkey.toBase58();
  }
  return key.toBase58();
}

function isParsedIx(
  ix: ParsedInstruction | PartiallyDecodedInstruction,
): ix is ParsedInstruction {
  return 'parsed' in ix && ix.parsed != null;
}

function collectSystemTransfers(
  tx: ParsedTransactionWithMeta,
): SystemTransfer[] {
  const out: SystemTransfer[] = [];
  const message = tx.transaction.message;
  const allIxs: Array<ParsedInstruction | PartiallyDecodedInstruction> = [
    ...message.instructions,
  ];
  for (const inner of tx.meta?.innerInstructions ?? []) {
    allIxs.push(...inner.instructions);
  }

  for (const ix of allIxs) {
    if (!isParsedIx(ix)) continue;
    if (ix.program !== 'system') continue;
    const parsed = ix.parsed as {
      type?: string;
      info?: { source?: string; destination?: string; lamports?: number };
    };
    if (parsed.type !== 'transfer' && parsed.type !== 'transferChecked') {
      continue;
    }
    const from = parsed.info?.source;
    const to = parsed.info?.destination;
    const lamports = parsed.info?.lamports;
    if (!from || !to || typeof lamports !== 'number') continue;
    out.push({ from, to, lamports });
  }
  return out;
}

/** Actual retained token-account funding, attributed to the wallet that paid it.
 * Temporary accounts closed in the transaction have no retained rent cost.
 * Use parsed system funding plus both balance sides; never infer rent from a
 * token balance increase (a first receipt can be an incoming transfer).
 */
function walletTokenAccountRent(tx: ParsedTransactionWithMeta, owner: string): number | null {
  if (!tx.meta) return null;
  if (tx.meta.err) return 0;
  const keys = tx.transaction.message.accountKeys.map(accountKeyString);
  const instructions = [
    ...tx.transaction.message.instructions,
    ...(tx.meta.innerInstructions ?? []).flatMap((inner) => inner.instructions),
  ];
  let rent = 0;
  const identifiedCreations = new Set<string>();
  for (const ix of instructions) {
    if (!isParsedIx(ix) || ix.program !== 'system') continue;
    const parsed = ix.parsed as { type?: string; info?: { source?: string; newAccount?: string; owner?: string; lamports?: number } };
    const info = parsed.info;
    if (parsed.type !== 'createAccount' || info?.source !== owner ||
        (info.owner !== TOKEN_PROGRAM_ID && info.owner !== TOKEN_2022_PROGRAM_ID)) continue;
    identifiedCreations.add(info.newAccount ?? '');
    const index = keys.indexOf(info.newAccount ?? '');
    const before = tx.meta.preBalances[index];
    const after = tx.meta.postBalances[index];
    if (index < 0 || !Number.isSafeInteger(before) || !Number.isSafeInteger(after) ||
        !Number.isSafeInteger(info.lamports) || info.lamports! < 0) return null;
    if (after > before) rent += Math.min(info.lamports!, after - before);
    if (!Number.isSafeInteger(rent)) return null;
  }
  // A prefunded ATA can use transfer + allocate instead of createAccount.
  // Until those funding semantics are resolved, leave its cost unavailable rather
  // than claim a zero rent deposit. Existing token accounts incur no new rent.
  for (const ix of instructions) {
    const programId = typeof ix.programId?.toBase58 === 'function' ? ix.programId.toBase58() : String(ix.programId);
    if (programId !== ASSOCIATED_TOKEN_PROGRAM_ID && (!isParsedIx(ix) || ix.program !== 'spl-associated-token-account')) continue;
    const parsed = isParsedIx(ix) ? ix.parsed as { type?: string; info?: { account?: string } } : null;
    if (parsed?.type === 'recoverNested') continue;
    const account = parsed?.info?.account ?? (!isParsedIx(ix) ? ix.accounts[1]?.toBase58() : undefined);
    if (!account) return null;
    const index = keys.indexOf(account);
    const existed = (tx.meta.preTokenBalances ?? []).some((balance) => balance.accountIndex === index);
    if (!existed && !identifiedCreations.has(account)) return null;
  }
  return rent;
}

function tokenAmountAtomic(balance: TokenBalance | undefined): bigint {
  const raw = balance?.uiTokenAmount?.amount ?? '0';
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function tokenDecimals(balance: TokenBalance | undefined): number | null {
  const d = balance?.uiTokenAmount?.decimals;
  return typeof d === 'number' && Number.isInteger(d) ? d : null;
}

/** Per-account mint deltas for the wallet owner (pre/post token balances). */
export function ownerTokenDeltas(
  tx: ParsedTransactionWithMeta,
  owner: string,
): OwnerTokenDelta[] {
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  const keys = new Set<string>();
  for (const b of [...pre, ...post]) {
    if (b.owner === owner) keys.add(`${b.accountIndex}:${b.mint}`);
  }

  const out: OwnerTokenDelta[] = [];
  for (const key of keys) {
    const [indexStr, mint] = key.split(':');
    const accountIndex = Number(indexStr);
    if (!mint || !Number.isFinite(accountIndex)) continue;
    const beforeBal = pre.find(
      (b) => b.accountIndex === accountIndex && b.mint === mint,
    );
    const afterBal = post.find(
      (b) => b.accountIndex === accountIndex && b.mint === mint,
    );
    const before = tokenAmountAtomic(beforeBal);
    const after = tokenAmountAtomic(afterBal);
    const decimals = tokenDecimals(afterBal) ?? tokenDecimals(beforeBal);
    out.push({ mint, accountIndex, before, after, decimals });
  }
  return out;
}

function ownerTokenDeltaCount(
  tx: ParsedTransactionWithMeta,
  owner: string,
): { increased: number; decreased: number } {
  let increased = 0;
  let decreased = 0;
  for (const d of ownerTokenDeltas(tx, owner)) {
    if (d.after > d.before) increased += 1;
    if (d.after < d.before) decreased += 1;
  }
  return { increased, decreased };
}

/**
 * Pure single-mint USDC delta for the owner, when honest to label.
 * Returns null when not a pure one-sided bounded-USDC move with decimals=6.
 */
export function pureUsdcDelta(args: {
  deltas: OwnerTokenDelta[];
  direction: 'in' | 'out';
}): { atomic: bigint; mint: string } | null {
  const changed = args.deltas.filter((d) => d.after !== d.before);
  if (changed.length !== 1) return null;
  const only = changed[0]!;
  if (!isBoundedUsdcMint(only.mint)) return null;
  if (only.decimals !== USDC_DECIMALS) return null;

  if (args.direction === 'in') {
    if (only.after <= only.before) return null;
    // No opposing mint decrease for this owner.
    if (args.deltas.some((d) => d.after < d.before)) return null;
    return { atomic: only.after - only.before, mint: only.mint };
  }

  if (only.after >= only.before) return null;
  if (args.deltas.some((d) => d.after > d.before)) return null;
  return { atomic: only.before - only.after, mint: only.mint };
}

function resolveStatus(args: {
  signatureErr: unknown;
  metaErr: unknown;
  confirmationStatus: string | null | undefined;
}): ActivityStatus {
  if (args.signatureErr || args.metaErr) return 'failed';
  if (
    args.confirmationStatus === 'processed' ||
    args.confirmationStatus == null
  ) {
    return 'pending';
  }
  return 'confirmed';
}

function emptyTokenFields(): {
  tokenAmountAtomic: string | null;
  amountSymbol: ActivityAssetSymbol | null;
} {
  return { tokenAmountAtomic: null, amountSymbol: null };
}

type ClassifyArgs = {
  owner: string;
  signature: string;
  blockTime: number | null | undefined;
  confirmationStatus: string | null | undefined;
  signatureErr: unknown;
  tx: ParsedTransactionWithMeta | null;
};

/**
 * One row the classifier cannot read (a transaction v1 shape it has never
 * seen, a node quirk) becomes an unknown row. It must never throw, because a
 * throw here rejects the whole batch and blanks the tab.
 */
export function classifyParsedActivity(args: ClassifyArgs): ActivityItem {
  try {
    return classifyParsedActivityStrict(args);
  } catch {
    return classifyParsedActivityStrict({ ...args, tx: null });
  }
}

function classifyParsedActivityStrict(args: ClassifyArgs): ActivityItem {
  const status = resolveStatus({
    signatureErr: args.signatureErr,
    metaErr: args.tx?.meta?.err,
    confirmationStatus: args.confirmationStatus,
  });

  const blockTimeMs =
    typeof args.blockTime === 'number' ? args.blockTime * 1000 : null;

  if (!args.tx) {
    return {
      signature: args.signature,
      kind: 'unknown',
      status,
      blockTimeMs,
      amountLamports: null,
      signedLamports: null,
      counterparty: null,
      feeLamports: null,
      ataRentLamports: null,
      walletCostLamports: null,
      title: activityTitle('unknown'),
      ...emptyTokenFields(),
    };
  }

  const feeLamports = args.tx.meta?.fee ?? null;
  const keys = args.tx.transaction.message.accountKeys.map(accountKeyString);
  const ownerIndex = keys.indexOf(args.owner);
  const ataRentLamports = walletTokenAccountRent(args.tx, args.owner);
  const ownerPaidFee = keys[0] === args.owner;
  const validFee = Number.isSafeInteger(feeLamports) && feeLamports! > 0;
  const walletCostLamports = ataRentLamports === null || !validFee
    ? null
    : (ownerPaidFee ? feeLamports! : 0) + ataRentLamports;
  let signedLamports: number | null = null;
  if (
    ownerIndex >= 0 &&
    args.tx.meta?.preBalances &&
    args.tx.meta?.postBalances
  ) {
    signedLamports =
      args.tx.meta.postBalances[ownerIndex]! -
      args.tx.meta.preBalances[ownerIndex]!;
  }

  const transfers = collectSystemTransfers(args.tx).filter(
    (t) => t.from === args.owner || t.to === args.owner,
  );

  let kind: ActivityKind = 'unknown';
  let amountLamports: number | null = null;
  let counterparty: string | null = null;
  let tokenAmountAtomic: string | null = null;
  let amountSymbol: ActivityAssetSymbol | null = null;
  let tokenMint: string | null = null;

  if (transfers.length === 1) {
    const t = transfers[0]!;
    amountLamports = t.lamports;
    amountSymbol = 'SOL';
    if (t.from === args.owner) {
      kind = 'sent';
      counterparty = t.to;
    } else {
      kind = 'received';
      counterparty = t.from;
    }
  } else {
    const deltas = ownerTokenDeltas(args.tx, args.owner);
    const token = ownerTokenDeltaCount(args.tx, args.owner);

    if (token.increased > 0 && token.decreased > 0) {
      kind = 'swap';
      amountSymbol = 'SOL';
    } else {
      const usdcIn = pureUsdcDelta({ deltas, direction: 'in' });
      const usdcOut = pureUsdcDelta({ deltas, direction: 'out' });

      if (usdcIn) {
        kind = 'received';
        tokenAmountAtomic = usdcIn.atomic.toString();
        amountSymbol = 'USDC';
        tokenMint = usdcIn.mint;
      } else if (usdcOut) {
        kind = 'sent';
        tokenAmountAtomic = usdcOut.atomic.toString();
        amountSymbol = 'USDC';
        tokenMint = usdcOut.mint;
      } else if (
        token.increased > 0 &&
        signedLamports != null &&
        signedLamports < 0
      ) {
        kind = 'swap';
        amountSymbol = 'SOL';
      } else if (signedLamports != null && signedLamports > 0) {
        kind = 'received';
        amountLamports = signedLamports;
        amountSymbol = 'SOL';
      } else if (
        signedLamports != null &&
        feeLamports != null &&
        signedLamports < -feeLamports
      ) {
        kind = 'sent';
        amountLamports = Math.abs(signedLamports) - feeLamports;
        amountSymbol = 'SOL';
      }
    }
  }

  const symbolForTitle =
    amountSymbol === 'USDC' ? 'USDC' : amountSymbol === 'SOL' ? 'SOL' : 'SOL';

  return {
    signature: args.signature,
    kind,
    status,
    blockTimeMs,
    amountLamports,
    signedLamports,
    tokenAmountAtomic,
    amountSymbol,
    tokenMint,
    counterparty,
    feeLamports,
    ataRentLamports,
    walletCostLamports,
    title:
      kind === 'unknown'
        ? activityTitle('unknown')
        : activityTitle(kind, symbolForTitle),
  };
}
