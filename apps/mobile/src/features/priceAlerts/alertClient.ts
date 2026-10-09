import type { HeadsUpAccessArgs } from '../skills/directory/headsUpAccessClient';
import { isValidPriceMint } from '../balances/priceSnapshot';
import { fetchPrices } from '../balances/fetchPrices';
import {
  normalizeThreshold,
  type Direction,
  type SpotPrice,
} from './alertModel';
import { pushApiBase, readPushFlags } from './pushClient';
import { pushArmed } from './pushRegistration';
export type AlertRule = {
  mint: string;
  direction: Direction;
  thresholdPrice: string;
};
export type OwnedAlert = AlertRule & {
  id: string;
  walletAddress: string;
  state: 'waiting' | 'done' | 'ended';
  createdAtMs: number;
  expiresAtMs: number;
  firedAtMs: number | null;
};
export type FiredAlert = AlertRule & {
  id: string;
  alertId: string;
  walletAddress: string;
  observedPrice: string;
  firedAtMs: number;
  priceAsOfMs: number;
};
export type AlertScope = {
  walletAddress: string;
  action: 'create' | 'list' | 'remove' | 'inbox';
  alertId?: string;
} & Partial<AlertRule>;
export function alertOwnershipMessage(
  scope: AlertScope,
  nonce: string,
  expiresAt: string,
) {
  const path =
    '/v1/price-alerts' +
    (scope.action === 'remove'
      ? '/' + scope.alertId
      : scope.action === 'inbox'
        ? '/inbox'
        : '');
  return [
    'Corso price alert ownership v1',
    'Network: mainnet-beta',
    `Action: price-alert:${scope.action}`,
    `Request: ${scope.action === 'create' ? 'POST' : scope.action === 'remove' ? 'DELETE' : 'GET'} ${path}`,
    `Wallet: ${scope.walletAddress}`,
    ...(scope.action === 'create'
      ? [
          `Mint: ${scope.mint}`,
          `Direction: ${scope.direction}`,
          `Threshold USD: ${scope.thresholdPrice}`,
        ]
      : []),
    `Nonce: ${nonce}`,
    `Expires: ${expiresAt}`,
  ].join('\n');
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v);
const timestamp = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function rule(v: unknown): v is AlertRule & Record<string, unknown> {
  return (
    record(v) &&
    typeof v.mint === 'string' &&
    isValidPriceMint(v.mint, 'mainnet-beta') &&
    (v.direction === 'above' || v.direction === 'below') &&
    typeof v.thresholdPrice === 'string' &&
    normalizeThreshold(v.thresholdPrice) === v.thresholdPrice
  );
}
export function isOwnedAlert(v: unknown, owner: string): v is OwnedAlert {
  return (
    rule(v) &&
    id(v.id) &&
    v.walletAddress === owner &&
    (v.state === 'waiting' || v.state === 'done' || v.state === 'ended') &&
    timestamp(v.createdAtMs) &&
    timestamp(v.expiresAtMs) &&
    v.expiresAtMs > v.createdAtMs &&
    (v.firedAtMs === null || timestamp(v.firedAtMs))
  );
}
function isFired(v: unknown, owner: string): v is FiredAlert {
  return (
    rule(v) &&
    id(v.id) &&
    id(v.alertId) &&
    v.walletAddress === owner &&
    timestamp(v.firedAtMs) &&
    timestamp(v.priceAsOfMs) &&
    typeof v.observedPrice === 'string' &&
    normalizeThreshold(v.observedPrice) === v.observedPrice
  );
}
export class AlertRequestError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function alertRequest(args: HeadsUpAccessArgs, scope: AlertScope) {
  const base = (
    args.apiBaseUrl === undefined ? pushApiBase() : args.apiBaseUrl
  )?.replace(/\/$/, '');
  const check = () => {
    if (args.signal?.aborted) throw Error('alert_cancelled');
    args.assertCurrent();
  };
  const request = args.fetchImpl ?? fetch;
  if (
    !base ||
    scope.walletAddress !== args.walletAddress ||
    !isValidPriceMint(args.walletAddress, 'mainnet-beta') ||
    (scope.action === 'remove' && !id(scope.alertId)) ||
    (scope.action === 'create' && !rule(scope))
  )
    throw Error('alert_invalid_request');
  check();
  const flags = await request(base + '/v1/config', {
    signal: args.signal ?? AbortSignal.timeout(3000),
  });
  check();
  if (!flags.ok || !pushArmed((await flags.json())?.flags))
    throw new AlertRequestError('disabled');
  check();
  const challenge = await request(base + '/v1/price-alerts/ownership', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(scope),
    signal: args.signal ?? AbortSignal.timeout(10000),
  });
  check();
  if (!challenge.ok)
    throw new AlertRequestError(
      challenge.status === 404 || challenge.status === 503
        ? 'disabled'
        : 'failed',
    );
  const c: unknown = await challenge.json();
  check();
  if (
    !record(c) ||
    typeof c.nonce !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(c.nonce) ||
    typeof c.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(c.expiresAt)) ||
    new Date(c.expiresAt).toISOString() !== c.expiresAt ||
    Date.parse(c.expiresAt) <= Date.now() ||
    Date.parse(c.expiresAt) > Date.now() + 130000 ||
    c.message !== alertOwnershipMessage(scope, c.nonce, c.expiresAt)
  )
    throw Error('alert_invalid_challenge');
  const signature = await args.signMessage(Buffer.from(c.message as string));
  check();
  if (signature.length !== 64 || Date.parse(c.expiresAt) <= Date.now())
    throw Error('alert_invalid_proof');
  const response = await request(
    base +
      '/v1/price-alerts' +
      (scope.action === 'remove'
        ? '/' + scope.alertId
        : scope.action === 'inbox'
          ? '/inbox'
          : ''),
    {
      method:
        scope.action === 'create'
          ? 'POST'
          : scope.action === 'remove'
            ? 'DELETE'
            : 'GET',
      headers: {
        'content-type': 'application/json',
        'x-corso-wallet': args.walletAddress,
        'x-corso-nonce': c.nonce,
        'x-corso-signature': Buffer.from(signature).toString('base64'),
      },
      ...(scope.action === 'create'
        ? {
            body: JSON.stringify({
              mint: scope.mint,
              direction: scope.direction,
              thresholdPrice: scope.thresholdPrice,
            }),
          }
        : {}),
      signal: args.signal ?? AbortSignal.timeout(10000),
    },
  );
  check();
  const body: unknown = await response.json();
  check();
  if (!response.ok)
    throw new AlertRequestError(
      record(body) && typeof body.error === 'string' ? body.error : 'failed',
    );
  return body;
}
export async function createAlert(args: HeadsUpAccessArgs, input: AlertRule) {
  const body = await alertRequest(args, {
    walletAddress: args.walletAddress,
    action: 'create',
    ...input,
  });
  if (
    !record(body) ||
    !isOwnedAlert(body.alert, args.walletAddress) ||
    body.alert.state !== 'waiting' ||
    body.alert.mint !== input.mint ||
    body.alert.direction !== input.direction ||
    body.alert.thresholdPrice !== input.thresholdPrice
  )
    throw Error('alert_invalid_response');
  return body.alert;
}
export async function listAlerts(args: HeadsUpAccessArgs) {
  const body = await alertRequest(args, {
    walletAddress: args.walletAddress,
    action: 'list',
  });
  if (
    !record(body) ||
    !Array.isArray(body.alerts) ||
    body.alerts.length > 1000 ||
    !body.alerts.every((v) => isOwnedAlert(v, args.walletAddress))
  )
    throw Error('alert_invalid_response');
  return body.alerts as OwnedAlert[];
}
// One list proof reads rules and fired history from the same existing route.
export async function readAlertNotifications(args: HeadsUpAccessArgs) {
  const body = await alertRequest(args, {
    walletAddress: args.walletAddress,
    action: 'list',
  });
  if (
    !record(body) ||
    !Array.isArray(body.alerts) ||
    body.alerts.length > 1000 ||
    !body.alerts.every((v) => isOwnedAlert(v, args.walletAddress)) ||
    !Array.isArray(body.events) ||
    body.events.length > 100 ||
    !body.events.every((v) => isFired(v, args.walletAddress))
  )
    throw Error('alert_invalid_response');
  return {
    alerts: body.alerts as OwnedAlert[],
    events: body.events as FiredAlert[],
  };
}
export async function readAlertInbox(args: HeadsUpAccessArgs) {
  const body = await alertRequest(args, {
    walletAddress: args.walletAddress,
    action: 'inbox',
  });
  if (
    !record(body) ||
    !Array.isArray(body.events) ||
    body.events.length > 100 ||
    !body.events.every((v) => isFired(v, args.walletAddress))
  )
    throw Error('alert_invalid_response');
  return body.events as FiredAlert[];
}
export async function removeAlert(args: HeadsUpAccessArgs, alertId: string) {
  const body = await alertRequest(args, {
    walletAddress: args.walletAddress,
    action: 'remove',
    alertId,
  });
  if (!record(body) || body.ok !== true || typeof body.removed !== 'boolean')
    throw Error('alert_invalid_response');
}
export async function readAlertPrice(
  mint: string,
  signal?: AbortSignal,
): Promise<SpotPrice | null> {
  if (!pushArmed(await readPushFlags().catch(() => ({})))) return null;
  const result = await fetchPrices({
    cluster: 'mainnet-beta',
    pricesEnabled: true,
    mints: [mint],
    signal,
  });
  if (!result.ok) return null;
  const line = result.snapshot.lines.find(
    (line) => line.mint === mint && line.status === 'ok',
  );
  const quote = line?.quote;
  return quote &&
    normalizeThreshold(quote.price) &&
    Math.abs(Date.now() - quote.asOfMs) <= 60000
    ? { price: normalizeThreshold(quote.price)!, asOfMs: quote.asOfMs }
    : null;
}
