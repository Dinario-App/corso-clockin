import { useEffect, useState } from 'react';
import {
  readDelegationMarkers,
  subscribeDelegationMarkers,
} from './delegationMarkers';
export function useDelegationMarker(wallet: string | null) {
  const [value, setValue] = useState<{
    wallet: string;
    present: boolean;
  } | null>(null);
  useEffect(() => {
    let canceled = false;
    const read = () => {
      if (!wallet) return;
      void readDelegationMarkers(wallet)
        .then((ids) => {
          if (!canceled) setValue({ wallet, present: ids.length > 0 });
        })
        .catch(() => {
          if (!canceled) setValue(null);
        });
    };
    read();
    const unsubscribe = subscribeDelegationMarkers(read);
    return () => {
      canceled = true;
      unsubscribe();
    };
  }, [wallet]);
  return wallet !== null && value?.wallet === wallet && value.present;
}
