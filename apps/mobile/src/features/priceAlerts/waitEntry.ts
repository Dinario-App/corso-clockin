import type { Href } from 'expo-router';
import { readPushFlags } from './pushClient';
import { pushArmed } from './pushRegistration';
import type { CorsoSession } from '../session/types';
export type WaitAlertEntry = {
  owner: CorsoSession;
  mint: string;
  symbol: string;
  cluster: 'devnet' | 'mainnet-beta';
  preset: {
    payMint: string;
    paySymbol: string;
    payDecimals: number;
    receiveMint: string;
    receiveSymbol: string;
    receiveDecimals: number;
    inAmountAtomic: string | null;
    side: 'buy' | 'sell';
  };
};
let entry: WaitAlertEntry | null = null;
export function readWaitAlertEntry() {
  return entry;
}
export function clearWaitAlertEntry() {
  entry = null;
}
export async function openWaitAlert(
  next: WaitAlertEntry,
  isCurrent: () => boolean,
) {
  if (!isCurrent() || next.cluster !== 'mainnet-beta') return;
  const flags = await readPushFlags().catch(() => ({}));
  if (!isCurrent() || !pushArmed(flags)) return;
  entry = next;
  const { router } = await import('expo-router');
  if (!isCurrent()) {
    entry = null;
    return;
  }
  router.push('/profile/notifications/set-alert' as Href);
}
