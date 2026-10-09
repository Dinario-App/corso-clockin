import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveBuildFlavor } from '@/src/lib/analytics';
import { shouldShowReturningDinarioNote } from './returningDinarioNote';

export type ReturningDinarioNoteGate = 'pending' | 'show' | 'skip';

export function useReturningDinarioNoteGate(input: {
  booting: boolean;
  signedIn: boolean;
}): ReturningDinarioNoteGate {
  const flavor = resolveBuildFlavor();
  const [gate, setGate] = useState<ReturningDinarioNoteGate>(
    flavor === 'seeker' ? 'pending' : 'skip',
  );
  const { booting, signedIn } = input;

  useEffect(() => {
    if (gate !== 'pending' || booting) return;
    let active = true;
    void shouldShowReturningDinarioNote({ flavor, signedIn }, AsyncStorage)
      .then((show) => {
        if (active) setGate(show ? 'show' : 'skip');
      })
      .catch(() => {
        if (active) setGate('skip');
      });
    return () => {
      active = false;
    };
  }, [gate, booting, signedIn, flavor]);

  return gate;
}
