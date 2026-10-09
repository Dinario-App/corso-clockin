import type { PublicAppConfig } from '@/src/lib/apiConfig';
import type { SessionType } from '@/src/features/session/types';
import {
  type HeldBalance,
  type HeldTokenProgram,
  type HoldingsClientErrorCode,
  type NotSellableReason,
} from './holdingsBook';

export type FetchHoldingsSuccess = Readonly<{
  ok: true;
  /** As STATED by the server, and already proven equal to this session's own. */
  owner: string;
  cluster: PublicAppConfig['cluster'];
  asOfMs: number;
  holdings: readonly HeldBalance[];
}>;

export type FetchHoldingsFailure = Readonly<{
  ok: false;
  code: HoldingsClientErrorCode;
  httpStatus?: number;
}>;

export type FetchHoldingsResult = FetchHoldingsSuccess | FetchHoldingsFailure;

export type FetchHoldingsArgs = {
  session: Readonly<{ type: SessionType; address: string }>;
  /** This device's own cluster, from `NetworkStatus`. Not sent; used to check. */
  cluster: PublicAppConfig['cluster'];
  /** `usePrivy().getAccessToken`. The one credential source. */
  getAccessToken: () => Promise<string | null>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
};

export const MAX_HOLDINGS_ROWS = 128;

const MAX_DISPLAY_DECIMALS = 18;

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const TOKEN_PROGRAMS: readonly HeldTokenProgram[] = ['spl-token', 'token-2022'];

/** Wire values only; `unrecognised` is this build's word and never accepted. */
const NOT_SELLABLE_REASONS: readonly NotSellableReason[] = [
  'token_2022_unsupported',
];

function fail(
  code: HoldingsClientErrorCode,
  httpStatus?: number,
): FetchHoldingsFailure {
  return Object.freeze(
    httpStatus === undefined
      ? ({ ok: false, code } as const)
      : ({ ok: false, code, httpStatus } as const),
  );
}

/**
 * Build the endpoint, refusing anything that is not a clean `https:` origin.
 *
 * Same bar as `deleteAccount.ts`, and for the same reason: this request carries
 * a Bearer credential, so a base URL with a password, a query string, or a
 * plaintext scheme is refused rather than normalised.
 */
export function holdingsUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const base = new URL(value);
    if (
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      return null;
    }
    return new URL('/v1/holdings', base).toString();
  } catch {
    return null;
  }
}

/**
 * Atomic amounts are decimal strings on the wire: a plausible balance exceeds
 * `Number.MAX_SAFE_INTEGER` and JSON has no integer type that survives it.
 * Anything that is not a non-negative integer string is refused — a balance that
 * does not parse is unknown, not zero.
 */
function parseAtomic(raw: unknown): bigint | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

function readHoldingRow(raw: unknown): HeldBalance | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as {
    mint?: unknown;
    atomic?: unknown;
    decimals?: unknown;
    tokenProgram?: unknown;
    sellable?: unknown;
    notSellableReason?: unknown;
  };

  if (typeof row.mint !== 'string' || !MINT_RE.test(row.mint)) return null;

  const atomic = parseAtomic(row.atomic);
  if (atomic === null) return null;

  if (
    typeof row.decimals !== 'number' ||
    !Number.isInteger(row.decimals) ||
    row.decimals < 0 ||
    row.decimals > MAX_DISPLAY_DECIMALS
  ) {
    return null;
  }

  if (typeof row.tokenProgram !== 'string' || row.tokenProgram.length === 0) {
    return null;
  }
  const tokenProgram: HeldTokenProgram = TOKEN_PROGRAMS.includes(
    row.tokenProgram as HeldTokenProgram,
  )
    ? (row.tokenProgram as HeldTokenProgram)
    : 'unrecognised';

  if (typeof row.sellable !== 'boolean') return null;

  let notSellableReason: NotSellableReason | null = null;
  if (row.notSellableReason !== null) {
    if (
      typeof row.notSellableReason !== 'string' ||
      row.notSellableReason.length === 0
    ) {
      return null;
    }
    notSellableReason = NOT_SELLABLE_REASONS.includes(
      row.notSellableReason as NotSellableReason,
    )
      ? (row.notSellableReason as NotSellableReason)
      : 'unrecognised';
  }

  if (tokenProgram === 'unrecognised' || notSellableReason === 'unrecognised') {
    return Object.freeze({
      mint: row.mint,
      atomic,
      displayDecimals: row.decimals,
      tokenProgram,
      sellable: false,
      notSellableReason: notSellableReason ?? 'unrecognised',
    } as const);
  }

  // Sellability and refusal reason must agree for either token program.
  if (row.sellable && notSellableReason !== null) return null;
  if (!row.sellable && notSellableReason === null) return null;
  // Token-2022 sellable now comes from the API mint read; manual sell layers
  // independently require matching TokenFacts before offering or spending it.

  return Object.freeze({
    mint: row.mint,
    atomic,
    displayDecimals: row.decimals,
    tokenProgram,
    sellable: row.sellable,
    notSellableReason,
  } as const);
}

export async function fetchHoldingsViaApi(
  args: FetchHoldingsArgs,
): Promise<FetchHoldingsResult> {
  if (args.session.type !== 'privy_embedded') {
    return fail('wallet_type_unsupported');
  }
  if (!args.session.address) return fail('wallet_type_unsupported');

  const endpoint = holdingsUrl(
    args.apiBaseUrl !== undefined
      ? args.apiBaseUrl
      : process.env.EXPO_PUBLIC_API_URL,
  );
  if (endpoint === null) return fail('missing_api_url');

  let token: string | null;
  try {
    token = await args.getAccessToken();
  } catch {
    return fail('missing_access_token');
  }
  // A token with surrounding whitespace is a token we would be reformatting
  // into a header; refuse it instead, exactly as `deleteAccount.ts` does.
  if (!token || token.trim() !== token) return fail('missing_access_token');

  let response: Response;
  try {
    response = await (args.fetchImpl ?? globalThis.fetch)(endpoint, {
      method: 'GET',
      ...(args.signal ? { signal: args.signal } : {}),
      // Native-only contract: never attach Origin. The token is here and only
      // here.
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    return fail('network');
  }

  if (response.status === 400) return fail('invalid_request', 400);
  if (response.status === 401) return fail('unauthenticated', 401);
  if (response.status === 403) return fail('forbidden', 403);
  if (response.status === 404) return fail('unavailable', 404);
  if (response.status === 409) {
    return fail(await readConflictCode(response), 409);
  }
  if (response.status === 429) return fail('rate_limited', 429);
  if (response.status === 503) return fail('unconfigured', 503);
  if (response.status === 502 || response.status === 504) {
    return fail('unreadable', response.status);
  }
  if (!response.ok) return fail('http', response.status);

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return fail('schema');
  }
  if (!raw || typeof raw !== 'object') return fail('schema');

  const body = raw as {
    cluster?: unknown;
    owner?: unknown;
    asOfMs?: unknown;
    holdings?: unknown;
  };

  if (body.cluster !== 'devnet' && body.cluster !== 'mainnet-beta') {
    return fail('cluster_mismatch');
  }
  if (body.cluster !== args.cluster) return fail('cluster_mismatch');

  if (typeof body.owner !== 'string' || body.owner !== args.session.address) {
    return fail('owner_mismatch');
  }

  if (
    typeof body.asOfMs !== 'number' ||
    !Number.isFinite(body.asOfMs) ||
    !Number.isInteger(body.asOfMs) ||
    body.asOfMs <= 0
  ) {
    return fail('schema');
  }

  if (!Array.isArray(body.holdings)) return fail('schema');
  if (body.holdings.length > MAX_HOLDINGS_ROWS) return fail('schema');

  const holdings: HeldBalance[] = [];
  const seen = new Set<string>();
  for (const entry of body.holdings) {
    const row = readHoldingRow(entry);
    if (row === null) return fail('schema');
    // A repeated mint means the server did not aggregate, so the map this book
    // becomes would silently keep one row and lose the other — a partial book
    // wearing a complete book's clothes.
    if (seen.has(row.mint)) return fail('schema');
    seen.add(row.mint);
    holdings.push(row);
  }

  return Object.freeze({
    ok: true,
    owner: body.owner,
    cluster: body.cluster,
    asOfMs: body.asOfMs,
    holdings: Object.freeze(holdings),
  } as const);
}

async function readConflictCode(
  response: Response,
): Promise<HoldingsClientErrorCode> {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    return 'http';
  }
  if (!raw || typeof raw !== 'object') return 'http';
  const error = (raw as { error?: unknown }).error;
  if (error === 'no_embedded_solana_wallet') return 'no_embedded_wallet';
  if (error === 'ambiguous_embedded_solana_wallet') {
    return 'ambiguous_embedded_wallet';
  }
  return 'http';
}
