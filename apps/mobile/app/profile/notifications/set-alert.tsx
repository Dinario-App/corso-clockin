import { useCallback, useEffect, useState } from 'react';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { usePriceAlertProofSigner } from '@/src/features/priceAlerts/usePriceAlertProofSigner';
import { usePriceAlertPushRegistration } from '@/src/features/priceAlerts/usePriceAlertPushRegistration';
import {
  readWaitAlertEntry,
  clearWaitAlertEntry,
} from '@/src/features/priceAlerts/waitEntry';
import {
  createAlert,
  readAlertPrice,
} from '@/src/features/priceAlerts/alertClient';
import { saveAlertPreset } from '@/src/features/priceAlerts/alertPresetStore';
import { SetAlertSheet } from '@/src/features/priceAlerts/SetAlertSheet';
import { readPushFlags } from '@/src/features/priceAlerts/pushClient';
import { pushArmed } from '@/src/features/priceAlerts/pushRegistration';
export default function PriceAlertRoute() {
  const proof = usePriceAlertProofSigner();
  const push = usePriceAlertPushRegistration();
  const [entry] = useState(readWaitAlertEntry);
  const [armed, setArmed] = useState(false);
  const close = useCallback(() => {
    clearWaitAlertEntry();
    goBackOr(BACK_FALLBACK.shell);
  }, []);
  useEffect(() => {
    let current = true;
    void readPushFlags()
      .then((flags) => {
        if (current) {
          if (pushArmed(flags)) setArmed(true);
          else close();
        }
      })
      .catch(() => {
        if (current) close();
      });
    return () => {
      current = false;
    };
  }, [close]);
  useEffect(() => () => clearWaitAlertEntry(), []);
  useEffect(() => {
    if (!entry || proof.session !== entry.owner || proof.locked) close();
  }, [entry, proof.session, proof.locked, close]);
  const readPrice = useCallback(
    () => (entry ? readAlertPrice(entry.mint) : Promise.resolve(null)),
    [entry],
  );
  if (!armed || !entry || proof.session !== entry.owner || proof.locked)
    return null;
  return (
    <>
      <SetAlertSheet
        symbol={entry.symbol}
        visible
        onClose={close}
        readPrice={readPrice}
        registerPush={push.fromUserSetAlert}
        save={async (direction, thresholdPrice) => {
          proof.assertCurrent();
          const alert = await createAlert(
            {
              walletAddress: entry.owner.address,
              signMessage: proof.signMessage,
              assertCurrent: proof.assertCurrent,
            },
            { mint: entry.mint, direction, thresholdPrice },
          );
          proof.assertCurrent();
          await saveAlertPreset(alert.id, entry, proof.assertCurrent).catch(
            () => {},
          );
          proof.assertCurrent();
        }}
      />
    </>
  );
}
