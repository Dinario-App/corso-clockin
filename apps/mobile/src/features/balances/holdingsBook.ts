import type { PublicAppConfig } from '@/src/lib/apiConfig';

export type HeldTokenProgram = 'spl-token' | 'token-2022' | 'unrecognised';

/**
 * Why a held token cannot be sold, when it cannot.
 *
 * `token_2022_unsupported` means the API could not prove this Token-2022
 * mint passes the shared reviewed extension policy. The complete book still
 * retains its balance; manual sell eligibility requires mobile facts too.
 */
export type NotSellableReason =
  | 'token_2022_unsupported'
  | 'unrecognised';

export type HeldBalance = Readonly<{
  mint: string;
  atomic: bigint;
  displayDecimals: number;
  tokenProgram: HeldTokenProgram;
  sellable: boolean;
  notSellableReason: NotSellableReason | null;
}>;

export type HoldingsClientErrorCode =
  /** `EXPO_PUBLIC_API_URL` is absent or unusable. */
  | 'missing_api_url'
  /** Privy handed back no access token, so nothing may be sent. */
  | 'missing_access_token'
  | 'wallet_type_unsupported'
  /** 400 — we sent something the route refuses. A client bug, never a zero. */
  | 'invalid_request'
  /** 401 — no/expired/invalid Bearer. */
  | 'unauthenticated'
  /** 403 — native-only contract violated (an `Origin` reached the route). */
  | 'forbidden'
  /** 404 — the route is not mounted on this deployment. Unknown, not empty. */
  | 'unavailable'
  /** 409 — Privy has no embedded Solana wallet for this identity. */
  | 'no_embedded_wallet'
  | 'ambiguous_embedded_wallet'
  /** 429 — a limiter (per-IP or per-identity) said no. */
  | 'rate_limited'
  /** 503 — the API has no holdings provider configured. */
  | 'unconfigured'
  /** 502/504 — the read could not be made, or its payload was not trusted. */
  | 'unreadable'
  /** Any other non-2xx. */
  | 'http'
  /** The request never completed. */
  | 'network'
  | 'schema'
  | 'cluster_mismatch'
  | 'owner_mismatch';

export type HoldingsBook =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error'; code: HoldingsClientErrorCode }>
  | Readonly<{
      status: 'ready';
      owner: string;
      cluster: PublicAppConfig['cluster'];
      asOfMs: number;
      byMint: ReadonlyMap<string, HeldBalance>;
    }>;

export const IDLE_HOLDINGS_BOOK: HoldingsBook = Object.freeze({
  status: 'idle',
} as const);

export const LOADING_HOLDINGS_BOOK: HoldingsBook = Object.freeze({
  status: 'loading',
} as const);

export function holdingsBookError(code: HoldingsClientErrorCode): HoldingsBook {
  return Object.freeze({ status: 'error', code } as const);
}

export function holdingsBookReady(read: {
  owner: string;
  cluster: PublicAppConfig['cluster'];
  asOfMs: number;
  holdings: readonly HeldBalance[];
}): HoldingsBook {
  const byMint = new Map<string, HeldBalance>();
  for (const row of read.holdings) byMint.set(row.mint, row);
  return Object.freeze({
    status: 'ready',
    owner: read.owner,
    cluster: read.cluster,
    asOfMs: read.asOfMs,
    byMint,
  } as const);
}

export type HeldBalanceUnknownReason =
  | 'holdings_loading'
  | 'holdings_unavailable'
  | 'wallet_type_unsupported';

export type HeldBalanceRead =
  | Readonly<{ known: true; atomic: bigint; held: HeldBalance | null }>
  | Readonly<{ known: false; reason: HeldBalanceUnknownReason }>;

export function readHeldBalance(
  book: HoldingsBook,
  mint: string,
): HeldBalanceRead {
  if (book.status === 'idle' || book.status === 'loading') {
    return Object.freeze({ known: false, reason: 'holdings_loading' } as const);
  }
  if (book.status === 'error') {
    return Object.freeze({
      known: false,
      reason:
        book.code === 'wallet_type_unsupported'
          ? 'wallet_type_unsupported'
          : 'holdings_unavailable',
    } as const);
  }
  const held = book.byMint.get(mint) ?? null;
  return Object.freeze({ known: true, atomic: held?.atomic ?? 0n, held } as const);
}

/** The sellable held rows, in the order the API stated them. */
export function sellableHoldings(book: HoldingsBook): readonly HeldBalance[] {
  if (book.status !== 'ready') return [];
  return [...book.byMint.values()].filter((row) => row.sellable);
}
