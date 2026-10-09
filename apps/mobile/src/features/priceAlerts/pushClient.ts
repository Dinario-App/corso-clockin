import { sha256 } from '@noble/hashes/sha256';
import type { HeadsUpAccessArgs } from '../skills/directory/headsUpAccessClient';
import type { Revocation } from './pushRegistration';
export const pushApiBase = () =>
  process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');
export async function readPushFlags() {
  const base = pushApiBase();
  if (!base) return {};
  const response = await fetch(base + '/v1/config', {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) return {};
  const body = await response.json();
  return {
    priceAlertsEnabled: body?.flags?.priceAlertsEnabled === true,
    pricesEnabled: body?.flags?.pricesEnabled === true,
  };
}
export function deviceOwnershipMessage(
  walletAddress: string,
  token: string,
  nonce: string,
  expiresAt: string,
  id: string,
) {
  const digest = Buffer.from(sha256(Buffer.from(token))).toString('hex');
  return deviceOwnershipDigestMessage(
    walletAddress,
    digest,
    nonce,
    expiresAt,
    id,
  );
}
export function deviceOwnershipDigestMessage(
  walletAddress: string,
  digest: string,
  nonce: string,
  expiresAt: string,
  id: string,
) {
  return [
    'Corso price alert device ownership v1',
    'Network: mainnet-beta',
    'Action: price-alert-device:register',
    'Request: POST /v1/price-alerts/devices',
    `Registration: ${id}`,
    `Wallet: ${walletAddress}`,
    `Device digest: ${digest}`,
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
  ].join('\n');
}
export async function registerPushToken(
  args: HeadsUpAccessArgs,
  token: string,
  onPrepared: (row: Revocation) => Promise<void>,
  requestId?: string,
): Promise<Revocation & { receipt: string }> {
  const id = requestId ?? (await import('expo-crypto')).randomUUID();
  const base = (
    args.apiBaseUrl === undefined ? pushApiBase() : args.apiBaseUrl
  )?.replace(/\/$/, '');
  if (!base) throw Error('push_unavailable');
  const check = () => {
    if (args.signal?.aborted) throw Error('push_cancelled');
    args.assertCurrent();
  };
  const request = args.fetchImpl ?? fetch;
  check();
  const response = await request(base + '/v1/price-alerts/devices/ownership', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      walletAddress: args.walletAddress,
      action: 'register',
      token,
      id,
    }),
    signal: args.signal ?? AbortSignal.timeout(10000),
  });
  check();
  if (!response.ok) throw Error('push_unavailable');
  const c = await response.json();
  check();
  if (
    typeof c.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(c.nonce) ||
    typeof c.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(c.expiresAt)) ||
    new Date(c.expiresAt).toISOString() !== c.expiresAt ||
    Date.parse(c.expiresAt) <= Date.now() ||
    Date.parse(c.expiresAt) > Date.now() + 120000 ||
    c.message !==
      deviceOwnershipMessage(
        args.walletAddress,
        token,
        c.nonce,
        c.expiresAt,
        id,
      )
  )
    throw Error('push_invalid_challenge');
  const signature = await args.signMessage(Buffer.from(c.message));
  check();
  if (signature.length !== 64 || Date.parse(c.expiresAt) <= Date.now())
    throw Error('push_invalid_proof');
  // Bind deletion authority to this exact signed registration. Persist it before
  // the request crosses the network so response loss cannot strand a live row.
  const capability = Buffer.from(
    sha256(
      Buffer.concat([
        Buffer.from('corso:price-alert-device:revocation:v2\n' + id + '\n'),
        Buffer.from(signature),
      ]),
    ),
  ).toString('base64url');
  const receipt = Buffer.from(
    sha256(
      Buffer.concat([
        Buffer.from('corso:price-alert-device:receipt:v2\n' + id + '\n'),
        Buffer.from(signature),
      ]),
    ),
  ).toString('base64url');
  const prepared = { id, capability };
  await onPrepared(prepared);
  check();
  const registered = await request(base + '/v1/price-alerts/devices', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-corso-wallet': args.walletAddress,
      'x-corso-nonce': c.nonce,
      'x-corso-signature': Buffer.from(signature).toString('base64'),
    },
    body: JSON.stringify({ token, id }),
    signal: args.signal ?? AbortSignal.timeout(10000),
  });
  // The caller owns teardown races through the already persisted capability.
  if (!registered.ok) throw Error('push_unavailable');
  const row = await registered.json();
  if (row.id !== id || row.capability !== capability || row.receipt !== receipt)
    throw Error('push_invalid_registration');
  return { ...prepared, receipt };
}
async function capabilityRequest(
  path: 'confirm' | 'status',
  row: { id: string; receipt: string },
  apiBaseUrl = pushApiBase(),
  fetchImpl: typeof fetch = fetch,
) {
  const base = apiBaseUrl?.replace(/\/$/, '');
  if (!base) throw Error('push_unavailable');
  const response = await fetchImpl(base + '/v1/price-alerts/devices/' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: row.id, receipt: row.receipt }),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw Error('push_unavailable');
  return response.json();
}
export async function confirmPushRow(
  row: { id: string; receipt: string },
  apiBaseUrl?: string,
  fetchImpl?: typeof fetch,
): Promise<void> {
  if (
    (await capabilityRequest('confirm', row, apiBaseUrl, fetchImpl)).ok !== true
  )
    throw Error('push_invalid_registration');
}
export async function checkPushRow(
  row: { id: string; receipt: string },
  apiBaseUrl?: string,
  fetchImpl?: typeof fetch,
): Promise<boolean> {
  const body = await capabilityRequest('status', row, apiBaseUrl, fetchImpl);
  if (typeof body.registered !== 'boolean')
    throw Error('push_invalid_registration');
  return body.registered;
}
export async function revokePushRow(row: Revocation) {
  const base = pushApiBase();
  if (!base) throw Error('push_unavailable');
  const response = await fetch(base + '/v1/price-alerts/devices/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: row.id, capability: row.capability }),
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok || (await response.json()).ok !== true)
    throw Error('push_unavailable');
}
