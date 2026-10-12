import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import {
  holdingsHaveFunds,
  resolveAccountBalanceHead,
  type AccountBalanceHead,
} from '@/src/features/account/accountRootPresentation';
import {
  readWaitAlertsArmed,
  resolveProfileFeeRow,
  resolveProfileWaitAlerts,
  type ProfileStaticRow,
  type ProfileWaitAlertsRow,
} from '@/src/features/account/profileCalmControlPresentation';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import { resolveHomeBalancePhase } from '@/src/features/home/homeEmptyPresentation';
import { readAlertPresets } from '@/src/features/priceAlerts/alertPresetStore';
import { readPushFlags } from '@/src/features/priceAlerts/pushClient';
import { pushArmed } from '@/src/features/priceAlerts/pushRegistration';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import {
  feeBpsOrNullFromStatus,
  resolveFeeBpsStatus,
} from '@/src/lib/apiConfig';

export type ProfileCalmReads = {
  head: AccountBalanceHead;
  waitAlerts: ProfileWaitAlertsRow;
  feeRow: ProfileStaticRow | null;
};

export function useProfileCalmReads(): ProfileCalmReads {
  const { session } = useCorsoSession();
  const { getAccessToken } = usePrivy();
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const [armed, setArmed] = useState<boolean | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveFeeBpsStatus()
      .then((status) => {
        if (!cancelled) setFeeBps(feeBpsOrNullFromStatus(status));
      })
      .catch(() => {
        if (!cancelled) setFeeBps(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const owner = session?.address ?? null;
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void readWaitAlertsArmed(readPushFlags, pushArmed).then(async (on) => {
        if (cancelled || on === null) return;
        setArmed(on);
        if (!on) {
          setSaved(null);
          return;
        }
        if (!owner) {
          setSaved(0);
          return;
        }
        const presets = await readAlertPresets(owner).catch(() => null);
        if (!cancelled)
          setSaved(presets ? Object.keys(presets).length : null);
      });
      return () => {
        cancelled = true;
      };
    }, [owner]),
  );

  return {
    head: resolveAccountBalanceHead({
      balancePhase: resolveHomeBalancePhase(fiat.holdings?.quantityStatus),
      hasFunds: holdingsHaveFunds(fiat.holdings),
      fiatStatus: fiat.status,
      fiatDisplay: fiat.display,
      totalFiat: fiat.totalFiat,
      stale: fiat.stale,
      staleAsOfMs: fiat.staleAsOfMs,
    }),
    waitAlerts: resolveProfileWaitAlerts({ armed, savedOnPhone: saved }),
    feeRow: resolveProfileFeeRow(feeBps),
  };
}
