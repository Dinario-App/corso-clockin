import { useCallback } from 'react';
import { usePriceAlertProofSigner } from './usePriceAlertProofSigner';
import { registerPushToken } from './pushClient';
import { priceAlertPush } from './pushRuntime';
export function usePriceAlertPushRegistration() {
  const proof = usePriceAlertProofSigner();
  const fromUserSetAlert = useCallback(async () => {
    if (!proof.session || proof.locked) return 'off' as const;
    const args = {
      walletAddress: proof.session.address,
      signMessage: proof.signMessage,
      assertCurrent: proof.assertCurrent,
    };
    return priceAlertPush.fromUserSetAlert(
      proof.session.address,
      (token, prepared) => registerPushToken(args, token, prepared),
    );
  }, [proof.session, proof.locked, proof.signMessage, proof.assertCurrent]);
  return { fromUserSetAlert };
}
