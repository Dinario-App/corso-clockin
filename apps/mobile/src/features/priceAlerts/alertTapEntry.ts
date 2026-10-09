import type { SpotPrice } from './alertModel';
import type { CorsoSession } from '../session/types';
import type { AlertPrefill } from './alertPrefill';
export type AlertTapEntry = {
  owner: CorsoSession;
  tappedAtMs: number;
  key: string;
  prefill: AlertPrefill;
  spot: SpotPrice | null;
};
let entry: AlertTapEntry | null = null;
let sequence = 0;
export function clearAlertTapEntry() {
  entry = null;
}
export async function openAlertReview(
  owner: CorsoSession,
  tappedAtMs: number,
  prefill: AlertPrefill,
  spot: SpotPrice | null,
  assertCurrent: () => void,
) {
  assertCurrent();
  const { router } = await import('expo-router');
  assertCurrent();
  const key = String(++sequence);
  entry = { owner, tappedAtMs, key, prefill, spot };
  router.push({ pathname: '/swap', params: { alertTap: key } });
}
export function takeAlertTapEntry(key: unknown, owner: CorsoSession | null) {
  const value = entry;
  if (!value || value.key !== key) return null;
  entry = null;
  return value.owner === owner ? value : null;
}
