import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';

export type StatusScope = {
  audience: string;
  owner: string;
  environment: 'sandbox' | 'production';
  cluster: 'devnet' | 'mainnet-beta';
};
export type StatusCredential = StatusScope & {
  credentialId: string;
  token: string;
  scope: 'retained-purchases';
  issuedAt: string;
  expiresAt: string;
};
const challengeKeys = [
  'purpose',
  'version',
  'audience',
  'owner',
  'nonce',
  'environment',
  'cluster',
  'issuedAt',
  'expiresAt',
] as const;
const credentialKeys = [
  'credentialId',
  'token',
  'owner',
  'audience',
  'environment',
  'cluster',
  'scope',
  'issuedAt',
  'expiresAt',
] as const;
function exactObject(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
export function canonicalStatusToken(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
    return false;
  const bytes = Buffer.from(
    value.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
  return (
    bytes.length === 32 &&
    bytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '') === value
  );
}
function timestamp(value: unknown): number | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  )
    return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value
    ? time
    : null;
}
function lifetime(value: Record<string, unknown>, seconds: number): boolean {
  const issued = timestamp(value.issuedAt);
  const expires = timestamp(value.expiresAt);
  return (
    issued !== null && expires !== null && expires - issued === seconds * 1000
  );
}
export function sameStatusScope(
  value: Record<string, unknown>,
  scope: StatusScope,
): boolean {
  return (
    value.audience === scope.audience &&
    value.owner === scope.owner &&
    value.environment === scope.environment &&
    value.cluster === scope.cluster
  );
}
export function validStatusScope(scope: StatusScope): boolean {
  try {
    const origin = new URL(scope.audience);
    return (
      origin.protocol === 'https:' &&
      origin.origin === scope.audience &&
      new PublicKey(scope.owner).toBase58() === scope.owner &&
      (scope.environment === 'sandbox' || scope.environment === 'production') &&
      (scope.cluster === 'devnet' || scope.cluster === 'mainnet-beta')
    );
  } catch {
    return false;
  }
}
export function buildStatusMessage(
  value: unknown,
  scope: StatusScope,
): Uint8Array | null {
  if (
    !validStatusScope(scope) ||
    !exactObject(value, challengeKeys) ||
    value.purpose !== 'ramp-status-read' ||
    value.version !== 1 ||
    !sameStatusScope(value, scope) ||
    !canonicalStatusToken(value.nonce) ||
    !lifetime(value, 60)
  )
    return null;
  if (
    Object.values(value).some(
      (field) =>
        typeof field === 'string' &&
        (field.includes('\r') || field.includes('\n') || field.includes('\0')),
    )
  )
    return null;
  const message = [
    'Corso status read authorization v1',
    ...challengeKeys.map((key) => `${key}:${value[key]}`),
  ].join('\n');
  const bytes = new Uint8Array(Buffer.from(message, 'utf8'));
  return bytes.length <= 1024 ? bytes : null;
}
export function parseStatusCredential(
  value: unknown,
  scope: StatusScope,
): StatusCredential | null {
  if (
    !validStatusScope(scope) ||
    !exactObject(value, credentialKeys) ||
    !sameStatusScope(value, scope) ||
    value.scope !== 'retained-purchases' ||
    !canonicalStatusToken(value.token) ||
    typeof value.credentialId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.credentialId,
    ) ||
    !lifetime(value, 900)
  )
    return null;
  return value as StatusCredential;
}
export type StatusAccessResult =
  | { ok: true; credential: StatusCredential }
  | { ok: false; reason: 'reprove' | 'unavailable' };
/** Both protocol responses are flat objects; reject duplicate decoded keys before JSON loses them. */
async function readStatusObject(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (raw.length > 4096) return null;
  const parsed: unknown = JSON.parse(raw);
  const keys = new Set<string>();
  for (const match of raw.matchAll(/"(?:\\.|[^"\\])*"/g)) {
    if (!/^\s*:/.test(raw.slice(match.index! + match[0].length))) continue;
    const key: string = JSON.parse(match[0]);
    if (keys.has(key)) return null;
    keys.add(key);
  }
  return parsed;
}
export async function requestStatusCredential(args: {
  scope: StatusScope;
  isCurrent: () => boolean;
  getSigner: () => Promise<{
    signMessage: (bytes: Uint8Array) => Promise<Uint8Array>;
    clear: () => void;
  }>;
  previous?: StatusCredential | null;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<StatusAccessResult> {
  const unavailable = { ok: false, reason: 'unavailable' } as const;
  const current = () => !args.signal?.aborted && args.isCurrent();
  if (!validStatusScope(args.scope) || !current()) return unavailable;
  const send = args.fetchImpl ?? fetch;
  try {
    const response = await send(
      `${args.scope.audience}/v1/ramps/status/challenge`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: args.scope.owner }),
        redirect: 'error',
        signal: args.signal,
      },
    );
    if (!response.ok)
      return {
        ok: false,
        reason: response.status === 401 ? 'reprove' : 'unavailable',
      };
    const challenge: unknown = await readStatusObject(response);
    const bytes = buildStatusMessage(challenge, args.scope);
    if (!bytes || !current()) return unavailable;
    const signer = await args.getSigner();
    let signature: Uint8Array;
    try {
      if (!current()) return unavailable;
      signature = await signer.signMessage(bytes);
    } finally {
      signer.clear();
    }
    if (!current() || signature.length !== 64) return unavailable;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (args.previous) {
      if (!parseStatusCredential(args.previous, args.scope)) return unavailable;
      headers.Authorization = `RampStatus ${args.previous.token}`;
    }
    const exchanged = await send(
      `${args.scope.audience}/v1/ramps/status/credential`,
      {
        method: 'POST',
        headers,
        redirect: 'error',
        signal: args.signal,
        body: JSON.stringify({
          owner: args.scope.owner,
          nonce: (challenge as { nonce: string }).nonce,
          signature: Buffer.from(signature).toString('base64'),
        }),
      },
    );
    if (!exchanged.ok)
      return {
        ok: false,
        reason: exchanged.status === 401 ? 'reprove' : 'unavailable',
      };
    const credential = parseStatusCredential(
      await readStatusObject(exchanged),
      args.scope,
    );
    return credential && current() ? { ok: true, credential } : unavailable;
  } catch {
    return unavailable;
  }
}
