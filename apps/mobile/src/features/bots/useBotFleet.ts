import { useCallback, useEffect, useState } from 'react';
import { copy } from '@/constants/copy';
import {
  BotClientError,
  cancelStoppedBot,
  killBot,
  killBotSubmit,
  listBots,
  pauseBot,
  resumeBot,
  revokeStoppedBot,
} from './botsClient';
import { readBots, subscribeBots, writeBot, writeBots } from './botsStore';
import type { BotView } from './types';
import { useBotSigners } from './useBotSigners';

export type FleetStatus = 'idle' | 'loading' | 'ready' | 'error';

export function describeBotError(error: unknown, fallback: string): string {
  if (error instanceof BotClientError) {
    switch (error.code) {
      case 'fee_changed':
      case 'output_token_2022_fee_unsupported':
        return error.detail.message ?? fallback;
      case 'resume_unavailable':
        return copy.automation.suspension.resumeUnavailable;
      case 'state_changed':
        return copy.automation.suspension.stateChanged;

      case 'declined':
        return copy.automation.error.declined;
      case 'ata_in_use':
        return copy.automation.error.ataInUse;
      case 'rule_unavailable':
        return copy.automation.setup.unavailable;
      default:
        return fallback;
    }
  }
  return fallback;
}

export function useBotFleet(args: { enabled: boolean }) {
  const signers = useBotSigners();
  const walletAddress = signers.walletAddress;
  const [status, setStatus] = useState<FleetStatus>('idle');
  const [bots, setBots] = useState<BotView[]>(() =>
    walletAddress ? readBots(walletAddress) : [],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feeConfirmation, setFeeConfirmation] = useState<{ botId: string; platformFeeBps: number; message: string } | null>(null);

  useEffect(() => {
    setFeeConfirmation(null);
    if (!walletAddress) return;
    setBots(readBots(walletAddress));
    return subscribeBots(() => setBots(readBots(walletAddress)));
  }, [walletAddress]);

  const common = useCallback(() => {
    if (!walletAddress) throw new BotClientError('session_changed');
    return {
      enabled: args.enabled,
      walletAddress,
      currentWalletAddress: signers.currentWalletAddress,
      signMessage: signers.signMessage,
    };
  }, [
    args.enabled,
    signers.currentWalletAddress,
    signers.signMessage,
    walletAddress,
  ]);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    setStatus('loading');
    setError(null);
    try {
      const listed = await listBots(common());
      writeBots(walletAddress, listed);
      setStatus('ready');
    } catch (caught) {
      setStatus('error');
      setError(describeBotError(caught, copy.automation.error.list));
    }
  }, [args.enabled, common, walletAddress]);

  async function run(
    bot: BotView,
    fallback: string,
    action: () => Promise<void>,
  ) {
    if (busyId || !walletAddress) return;
    setBusyId(bot.id);
    setError(null);
    try {
      await action();
    } catch (caught) {
      if (caught instanceof BotClientError && caught.code === 'fee_changed' && caught.detail.platformFeeBps !== undefined) {
        setFeeConfirmation({ botId: bot.id, platformFeeBps: caught.detail.platformFeeBps, message: caught.detail.message ?? 'The fee changed. Re-confirm to resume.' });
      }
      setError(describeBotError(caught, fallback));
    } finally {
      setBusyId(null);
    }
  }

  // Plain functions on purpose: each closes over the live `busyId` and the
  // live signers; memoising them would only pin a stale guard.
  const pause = (bot: BotView) =>
    run(bot, copy.automation.error.pause, async () => {
      const next = await pauseBot({ ...common(), botId: bot.id });
      writeBot(walletAddress!, next);
    });

  const resume = (bot: BotView, platformFeeBps?: number) =>
    run(bot, copy.automation.error.resume, async () => {
      const next = await resumeBot({ ...common(), botId: bot.id, platformFeeBps });
      setFeeConfirmation(null);
      writeBot(walletAddress!, next);
    });

  const kill = (bot: BotView) =>
    run(bot, copy.automation.error.kill, async () => {
      // Step 1 — Revoking…: the server cancels first, then hands back the Revoke.
      const step1 = await killBot({ ...common(), botId: bot.id });
      writeBot(walletAddress!, step1.bot);
      if (step1.revoke === null) {
        if (step1.supersededBy) setError(copy.automation.killState.superseded);
        return;
      }
      const killed = await killBotSubmit({
        ...common(),
        botId: bot.id,
        revoke: step1.revoke,
        signTransaction: signers.signTransaction,
      });
      writeBot(walletAddress!, killed);
    });

  const cancel = (bot: BotView) =>
    run(bot, copy.automation.error.kill, async () => {
      try {
        await cancelStoppedBot({ ...common(), botId: bot.id });
      } finally {
        // Cancellation can land in the ledger before Revoke preparation fails.
        const listed = await listBots(common());
        writeBots(walletAddress!, listed);
      }
    });

  const revoke = (bot: BotView) =>
    run(bot, copy.automation.revokeFailed, async () => {
      await revokeStoppedBot({
        ...common(),
        botId: bot.id,
        signTransaction: signers.signTransaction,
      });
      const listed = await listBots(common());
      writeBots(walletAddress!, listed);
    });

  return {
    walletAddress,
    status,
    bots,
    busyId,
    error,
    feeConfirmation,
    refresh,
    pause,
    resume,
    kill,
    revoke,
    cancel,
    stepUpSheet: signers.stepUpSheet,
  };
}
