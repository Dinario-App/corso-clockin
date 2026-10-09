import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import type {
  FiatTotalResult,
  HoldingsSnapshot,
  PriceQuoteMap,
} from '@/src/features/balances/computeFiatTotal';
import { submitAsk as submitAskRequest } from '@/src/features/ask/askClient';
import { captureAiConsentOwner } from '@/src/features/aiConsent/aiConsentStore';
import { bindHomeAsk } from '@/src/features/aiConsent/ui/homeConsentHold';
import { StepUpSheet } from '@/src/features/security/StepUpSheet';
import { writeAskSourceTextForSwap } from '@/src/features/swap/askSourceTextStore';
import {
  clearRoutineFireForSwap,
  writeRoutineFireForSwap,
} from './routineFireStore';
import { buildTriggeredRoutineAsk } from './routinePresentation';
import { RoutinesMoneySection } from './RoutinesMoneySection';
import { cancelRoutine, listRoutines } from './routinesClient';
import type { RoutineRecord } from './types';
import { useRoutineMessageSigner } from './useRoutineMessageSigner';

type Props = {
  walletAddress: string;
  holdings: HoldingsSnapshot | null;
  result: FiatTotalResult;
  quotes: PriceQuoteMap;
  armingOpen: boolean;
};

/** Flag-on-only Money child. Unmounting it removes the entire routines lane. */
export function RoutinesMoneyController(props: Props) {
  const signer = useRoutineMessageSigner();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [routines, setRoutines] = useState<RoutineRecord[]>([]);
  const [busyRoutineId, setBusyRoutineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    void listRoutines({
      enabled: true,
      walletAddress: props.walletAddress,
      currentWalletAddress: signer.currentWalletAddress,
      signMessage: signer.signMessage,
    }).then(
      (listed) => {
        if (cancelled) return;
        setRoutines(listed);
        setStatus('ready');
      },
      () => {
        if (cancelled) return;
        setStatus('error');
        setError('Routines are not available right now.');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [props.walletAddress, signer.currentWalletAddress, signer.signMessage]);

  async function cancelListedRoutine(routine: RoutineRecord) {
    if (busyRoutineId) return;
    setBusyRoutineId(routine.id);
    setError(null);
    try {
      const canceled = await cancelRoutine({
        enabled: true,
        routineId: routine.id,
        walletAddress: props.walletAddress,
        currentWalletAddress: signer.currentWalletAddress,
        signMessage: signer.signMessage,
      });
      setRoutines((current) =>
        current.map((candidate) =>
          candidate.id === canceled.id ? canceled : candidate,
        ),
      );
    } catch {
      setError('Routine could not be canceled. Try again.');
    } finally {
      setBusyRoutineId(null);
    }
  }

  async function openTriggeredRoutine(routine: RoutineRecord) {
    if (busyRoutineId) return;
    const question = buildTriggeredRoutineAsk(routine);
    if (!question) return;
    setBusyRoutineId(routine.id);
    setError(null);
    try {
      const askedFor = bindHomeAsk(props.walletAddress, captureAiConsentOwner());
      const askId = `routine-${routine.id}-${Date.now()}`;
      // Ask resolves current affordability and amount; Swap then obtains its
      // normal fresh quote. No quote, transaction, or signature is carried.
      const answer = await submitAskRequest({
        text: question,
        holdings: props.holdings,
        result: props.result,
        quotes: props.quotes,
        requestId: askId,
      });
      if (!askedFor.stillCurrent())
        throw new Error('Routine ask is no longer current.');
      if (!answer.swap) throw new Error('Routine swap is unavailable.');
      writeAskSourceTextForSwap(routine.sourceText);
      writeRoutineFireForSwap({
        routineId: routine.id,
        walletAddress: props.walletAddress,
        positionMint: routine.positionMint,
      });
      router.push({
        pathname: '/swap',
        params: {
          askFromSymbol: answer.swap.fromSymbol,
          askToSymbol: answer.swap.toSymbol,
          askToMint: answer.swap.toMint,
          askToDecimals: String(answer.swap.toDecimals),
          askInAmountAtomic: answer.swap.inAmountAtomic,
          ...(answer.swap.amountGuard
            ? { askAmountGuard: answer.swap.amountGuard }
            : {}),
        },
      });
    } catch {
      clearRoutineFireForSwap();
      writeAskSourceTextForSwap(null);
      setError('A fresh swap quote is not available yet.');
    } finally {
      setBusyRoutineId(null);
    }
  }

  return (
    <>
      <RoutinesMoneySection
        status={status}
        routines={routines}
        busyRoutineId={busyRoutineId}
        error={error}
        onReview={(routine) => { void openTriggeredRoutine(routine); }}
        onCancel={(routine) => { void cancelListedRoutine(routine); }}
        armingOpen={props.armingOpen}
      />
      <StepUpSheet {...signer.stepUpSheet} />
    </>
  );
}
