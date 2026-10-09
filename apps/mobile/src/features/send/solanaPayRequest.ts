/**
 * What came out of the camera.
 *
 * Two shapes are accepted: a bare base58 address, and a Solana Pay transfer
 * request (`solana:<address>?amount=…&spl-token=…`). Solana Pay *transaction*
 * requests point at a server that hands back a transaction to sign; Corso has
 * no surface for that and refuses them by name rather than by silence.
 *
 * Address judgement lives in `recipientCheck.ts` — this module only takes the
 * URI apart.
 */
import {
  checkRecipientAddress,
  type RecipientRejection,
} from '@/src/features/send/recipientCheck';
import {
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from '@/src/features/swap/tokens';
import type { SendAsset } from '@/src/features/send/usdcSendIntent';

export type SendCluster = 'devnet' | 'mainnet-beta';

export type ScanRejection =
  | RecipientRejection
  | 'not-solana'
  | 'transaction-request'
  | 'bad-amount'
  | 'unsupported-token';

export type ScannedRequest = {
  address: string;
  /** Decimal string exactly as scanned, or null when the code carried none. */
  amount: string | null;
  /** Resolved to something Corso can send, or null for the native asset. */
  asset: SendAsset;
  /** True when the code named an SPL mint rather than defaulting to SOL. */
  assetFromRequest: boolean;
};

export type ScanResult =
  | { ok: true; request: ScannedRequest }
  | { ok: false; reason: ScanRejection };

const SOLANA_SCHEME = /^solana:/iu;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;
/** Solana Pay: a non-negative decimal. No exponent, no sign, no separators. */
const DECIMAL_AMOUNT = /^\d*(?:\.\d*)?$/u;

function splitOnce(value: string, separator: string): [string, string] {
  const at = value.indexOf(separator);
  if (at < 0) return [value, ''];
  return [value.slice(0, at), value.slice(at + separator.length)];
}

function decodeComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** First occurrence wins, matching the Solana Pay reference parser. */
export function parseQueryParams(query: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const pair of query.split('&')) {
    if (pair.length === 0) continue;
    const [rawKey, rawValue] = splitOnce(pair, '=');
    const key = decodeComponent(rawKey.replace(/\+/gu, ' '));
    const value = decodeComponent(rawValue.replace(/\+/gu, ' '));
    if (key === null || value === null) continue;
    if (params.has(key)) continue;
    params.set(key, value);
  }
  return params;
}

/** Reject anything that is not a plain positive decimal amount. */
export function normalizeRequestAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!DECIMAL_AMOUNT.test(trimmed)) return null;
  if (!/\d/u.test(trimmed)) return null;
  if (Number(trimmed) <= 0) return null;
  return trimmed;
}

function assetForMint(mint: string, cluster: SendCluster | null): SendAsset | null {
  if (mint === USDC_MINT_MAINNET && cluster !== 'devnet') return 'USDC';
  if (mint === USDC_MINT_DEVNET && cluster !== 'mainnet-beta') return 'USDC';
  return null;
}

/**
 * Turn one scanned string into something the Send sheet can fill in.
 *
 * `ownerAddress` is passed straight through so scanning your own QR is caught
 * inside the scanner instead of two taps later.
 */
export function parseScannedPayload(input: {
  raw: unknown;
  ownerAddress?: string | null;
  cluster?: SendCluster | null;
}): ScanResult {
  if (typeof input.raw !== 'string') return { ok: false, reason: 'empty' };
  const trimmed = input.raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: 'empty' };

  const cluster = input.cluster ?? null;

  if (!SOLANA_SCHEME.test(trimmed)) {
    if (ANY_SCHEME.test(trimmed)) return { ok: false, reason: 'not-solana' };
    const check = checkRecipientAddress({
      raw: trimmed,
      ownerAddress: input.ownerAddress,
    });
    if (!check.ok) return { ok: false, reason: check.reason };
    return {
      ok: true,
      request: {
        address: check.address,
        amount: null,
        asset: 'SOL',
        assetFromRequest: false,
      },
    };
  }

  const [pathRaw, queryRaw] = splitOnce(trimmed.slice('solana:'.length), '?');
  const path = decodeComponent(pathRaw);
  if (path === null) return { ok: false, reason: 'malformed' };
  // A transaction request's path is a URL, not an address.
  if (path.includes('/') || ANY_SCHEME.test(path)) {
    return { ok: false, reason: 'transaction-request' };
  }

  const check = checkRecipientAddress({
    raw: path,
    ownerAddress: input.ownerAddress,
  });
  if (!check.ok) return { ok: false, reason: check.reason };

  const params = parseQueryParams(queryRaw);

  let asset: SendAsset = 'SOL';
  let assetFromRequest = false;
  const splToken = params.get('spl-token');
  if (splToken !== undefined) {
    const resolved = assetForMint(splToken.trim(), cluster);
    if (resolved === null) return { ok: false, reason: 'unsupported-token' };
    asset = resolved;
    assetFromRequest = true;
  }

  let amount: string | null = null;
  const rawAmount = params.get('amount');
  if (rawAmount !== undefined) {
    amount = normalizeRequestAmount(rawAmount);
    if (amount === null) return { ok: false, reason: 'bad-amount' };
  }

  return {
    ok: true,
    request: { address: check.address, amount, asset, assetFromRequest },
  };
}
