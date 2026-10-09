import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { resolveAutopilotSuspensionReason } from '@/src/lib/apiConfig';
import { writeBot } from './botsStore';
import type { BotView, BotSuspensionReason } from './types';
/** Unsigned config discloses a suspension without requesting an owner signature.
 * Flag and global-pause suspensions remain cached until signed server Resume replaces the row. */
export function useCorsoPausedFleet<T extends { bots: BotView[] }>(fleet: T) {
  const [reason, setReason] = useState<BotSuspensionReason | null>(null);
  const [configReady, setConfigReady] = useState(false);
  useEffect(() => {
    let canceled = false;
    const read = () => { void resolveAutopilotSuspensionReason().then(value => {
      if (!canceled) { setReason(value); setConfigReady(true); }
    }).catch(() => {}); };
    read();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') read(); });
    return () => { canceled = true; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reason !== 'flags' && reason !== 'global_pause') return;
    for (const bot of fleet.bots) {
      if (bot.key.standing && !bot.revokeRequired && ['live', 'paused', 'firing'].includes(bot.status) && bot.suspendedBy !== reason) {
        writeBot(bot.walletAddress, { ...bot, status: 'paused', suspendedBy: reason, pausedByCorso: reason === 'global_pause' });
      }
    }
  }, [fleet.bots, reason]);
  const bots = useMemo(() => fleet.bots.map(bot => {
    const suspendedBy = reason ?? bot.suspendedBy ?? (bot.pausedByCorso ? 'global_pause' : null);
    return suspendedBy && bot.key.standing && !bot.revokeRequired && ['live', 'paused', 'firing'].includes(bot.status)
      ? { ...bot, status: 'paused' as const, suspendedBy, pausedByCorso: suspendedBy === 'global_pause' }
      : bot;
  }), [fleet.bots, reason]);
  const canResume = (bot: BotView) => configReady && reason === null && bot.status === 'paused' && !bot.revokeRequired && bot.key.standing && ['user', 'flags', 'global_pause', 'fee_changed'].includes(bot.suspendedBy ?? '');
  return { ...fleet, bots, canResume };
}
