/**
 * Mobile token search client — `GET /v1/tokens/search?query=`.
 *
 * Two forms. `fetchTokenSearchOutcome` tells a search that failed on this side
 * (no API url, no answer, a non-OK answer, a body that is not the search
 * envelope) from one that ran, and the picker says which. `fetchTokenSearch`
 * is the array form: every failure is an empty list.
 *
 * ⚠️ The outcome sees only this side. The API answers 200 with an empty
 * `candidates` array when its own vendor fails, so that failure arrives here
 * as a search that ran and matched nothing.
 *
 * ── The store gate runs here too ─────────────────────────────────────────────
 * A search row prints a name a stranger typed into a launchpad, exactly like a
 * Discover row. `GET /v1/tokens/search` already drops the pairs the moderation
 * list condemns; this is the same net a second time, because a device can be
 * talking to an older server and a condemned symbol reaching the sheet is a
 * store rejection either way. One list, byte-identical with the server's
 * (`features/discovery/moderation.ts`), so the two can never disagree.
 */
import { isModeratedTokenLabel } from '@/src/features/discovery/moderation';
import type { SwapToken } from '@/src/features/swap/tokens';
import { normalizeSolanaAddressInput } from '@/src/ui/controls/addressChipPresentation';

export type TokenSearchResult = {
  token: SwapToken;
  /** Jupiter's verified list. Null is unknown, which is not the same as false. */
  isVerified: boolean | null;
  /** Jupiter's reported USD liquidity. Null stays unknown. */
  liquidityUsd: number | null;
};

function resolveApiBaseUrl(override?: string | null): string | null {
  if (override !== undefined) {
    if (override === null) return null;
    const trimmed = override.trim();
    return trimmed.length > 0 ? trimmed.replace(/\/$/, '') : null;
  }
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

/**
 * One row → one selectable token. A row with no usable decimals is dropped:
 * without them there is no honest way to turn a typed amount into base units,
 * and guessing 9 is how someone sends a thousand times what they meant.
 */
export function parseTokenSearchRow(value: unknown): TokenSearchResult | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const mint =
    typeof row.mint === 'string'
      ? normalizeSolanaAddressInput(row.mint.trim())
      : null;
  const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : '';
  if (mint == null || symbol.length === 0) return null;

  // A condemned label is not a thin row, it is not a row. Dropped before the
  // sheet can render it and before it can cost a token-facts round trip.
  const name = typeof row.name === 'string' ? row.name : null;
  if (isModeratedTokenLabel({ name, symbol })) return null;

  const decimals = row.decimals;
  if (
    typeof decimals !== 'number' ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18
  ) {
    return null;
  }

  const liquidityUsd = row.liquidityUsd;

  return {
    token: { symbol, mint, decimals },
    isVerified: typeof row.isVerified === 'boolean' ? row.isVerified : null,
    liquidityUsd:
      typeof liquidityUsd === 'number' &&
      Number.isFinite(liquidityUsd) &&
      liquidityUsd >= 0
        ? liquidityUsd
        : null,
  };
}

/** The search envelope's rows, or null when the body is not the envelope. */
function tokenSearchCandidates(raw: unknown): unknown[] | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidates = (raw as Record<string, unknown>).candidates;
  return Array.isArray(candidates) ? candidates : null;
}

export function parseTokenSearchBody(raw: unknown): TokenSearchResult[] {
  const candidates = tokenSearchCandidates(raw);
  if (candidates == null) return [];

  const results: TokenSearchResult[] = [];
  const seen = new Set<string>();
  for (const row of candidates) {
    const parsed = parseTokenSearchRow(row);
    if (parsed == null || seen.has(parsed.token.mint)) continue;
    seen.add(parsed.token.mint);
    results.push(parsed);
  }
  return results;
}

export type TokenSearchOutcome =
  | { status: 'ok'; results: TokenSearchResult[] }
  | { status: 'failed' };

export async function fetchTokenSearchOutcome(args: {
  query: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
}): Promise<TokenSearchOutcome> {
  const query = args.query.trim();
  if (query.length === 0) return { status: 'ok', results: [] };

  const base = resolveApiBaseUrl(args.apiBaseUrl);
  if (!base) return { status: 'failed' };

  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  try {
    const response = await fetchImpl(
      `${base}/v1/tokens/search?query=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        signal: args.signal,
        headers: { accept: 'application/json' },
      },
    );
    if (!response.ok) return { status: 'failed' };
    const body: unknown = await response.json();
    if (tokenSearchCandidates(body) == null) return { status: 'failed' };
    return { status: 'ok', results: parseTokenSearchBody(body) };
  } catch {
    return { status: 'failed' };
  }
}

export async function fetchTokenSearch(args: {
  query: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string | null;
}): Promise<TokenSearchResult[]> {
  const outcome = await fetchTokenSearchOutcome(args);
  return outcome.status === 'ok' ? outcome.results : [];
}
