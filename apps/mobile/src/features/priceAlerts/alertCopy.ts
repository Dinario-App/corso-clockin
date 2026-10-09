import { formatAlertThresholdUsd } from '@corso/price-format';
import type { Direction } from './alertModel';
export const ALERT_COPY = Object.freeze({
  title: 'Set a price alert',
  above: 'Above',
  below: 'Below',
  price: 'Price',
  set: 'Set alert',
  current: '{TOKEN} is {PRICE} now',
  confirmationAbove: 'Alert set. {TOKEN} above {PRICE}.',
  confirmationBelow: 'Alert set. {TOKEN} below {PRICE}.',
  rowAbove: '{TOKEN} above {PRICE}',
  rowBelow: '{TOKEN} below {PRICE}',
  waiting: 'Waiting',
  done: 'Done',
  ended: 'Ended',
  firedAbove: '{TOKEN} went above {PRICE} · {TIME}',
  firedBelow: '{TOKEN} went below {PRICE} · {TIME}',
  arrivalAbove: 'Your alert: {TOKEN} above {PRICE}',
  arrivalBelow: 'Your alert: {TOKEN} below {PRICE}',
  moved: '{TOKEN} is {PRICE} now.',
  crossedAbove: '{TOKEN} is already above {PRICE}.',
  crossedBelow: '{TOKEN} is already below {PRICE}.',
  cap: 'You have {N} alerts. Remove one to add another.',
  exists: 'You already have this alert.',
  failed: "Couldn't set the alert. Try again.",
  off: "Alerts aren't available right now.",
  gone: 'That alert is gone.',
  noPrice: "Can't read the price right now.",
});
export function safeAlertSymbol(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Za-z][A-Za-z0-9]{0,11}$/.test(raw)
    ? raw
    : null;
}
function displaySymbol(raw: string): string {
  const symbol = safeAlertSymbol(raw);
  if (!symbol) throw Error('alert_symbol_invalid');
  return symbol;
}
export function alertLine(
  kind: 'confirmation' | 'row' | 'fired' | 'crossed' | 'arrival',
  token: string,
  direction: Direction,
  threshold: string,
  time = '',
) {
  const key = `${kind}${direction === 'above' ? 'Above' : 'Below'}` as const;
  return ALERT_COPY[key]
    .replace('{TOKEN}', () => displaySymbol(token))
    .replace('{PRICE}', formatAlertThresholdUsd(threshold) ?? '')
    .replace('{TIME}', () => time);
}
export function currentPriceLine(token: string, price: string) {
  return ALERT_COPY.current
    .replace('{TOKEN}', () => displaySymbol(token))
    .replace('{PRICE}', formatAlertThresholdUsd(price) ?? '');
}

export function alertMovedLine(token: string, price: string) {
  return ALERT_COPY.moved
    .replace('{TOKEN}', () => displaySymbol(token))
    .replace('{PRICE}', formatAlertThresholdUsd(price) ?? '');
}
