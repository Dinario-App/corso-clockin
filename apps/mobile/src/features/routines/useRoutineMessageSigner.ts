import { useCallback } from 'react';
import { useActiveSigner } from '@/src/features/security/getActiveSigner';
import { useStepUpConfirm } from '@/src/features/security/useStepUpConfirm';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { performRoutineMessageSignature } from './routineSigning';

export function useRoutineMessageSigner() {
  const { session } = useCorsoSession();
  const { getActiveSigner, liveSessionCell } = useActiveSigner();
  const stepUp = useStepUpConfirm();

  const signMessage = useCallback(async (message: Uint8Array) => {
    if (!session) throw new Error('No wallet session.');
    return performRoutineMessageSignature({
      session,
      message,
      prepareStepUp: stepUp.prepareStepUp,
      getActiveSigner,
    });
  }, [getActiveSigner, session, stepUp.prepareStepUp]);
  const currentWalletAddress = useCallback(
    () => liveSessionCell.current?.address ?? null,
    [liveSessionCell],
  );

  return {
    signMessage,
    currentWalletAddress,
    stepUpSheet: stepUp.sheet,
  };
}
