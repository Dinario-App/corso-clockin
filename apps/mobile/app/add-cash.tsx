import { loadRampQuote } from '@/src/features/ramp/rampQuote';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddCashScreen } from '@/src/ui/ethena/screens/AddCash';
import { useMoonPay } from '@/src/features/ramp/MoonPayProvider';
import type { RampAvailability } from '@/src/features/ramp/moonPayFlow';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';

export default function AddCashRoute() {
  const { flow, active } = useMoonPay();
  const { session, locked } = useCorsoSession();
  const insets = useSafeAreaInsets();
  const [availability, setAvailability] = useState<
    RampAvailability | { status: 'loading' }
  >({ status: 'loading' });
  useFocusEffect(
    // biome-ignore lint/correctness/useExhaustiveDependencies: refresh the flow-owned preview when wallet identity or lock changes.
    useCallback(() => {
      let current = true;
      let revision = 0;
      const refresh = async () => {
        const request = ++revision;
        setAvailability({ status: 'loading' });
        const next = await flow.availability('USDC');
        if (current && request === revision) setAvailability(next);
      };
      void refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void refresh();
      });
      return () => {
        current = false;
        setAvailability({ status: 'loading' });
        subscription.remove();
      };
    }, [flow, session, locked]),
  );
  return (
    <AddCashScreen
      loadQuote={loadRampQuote}
      availability={availability}
      busy={active !== null}
      topInset={insets.top}
      bottomInset={insets.bottom}
      onClose={() => goBackOr(BACK_FALLBACK.shell)}
      onReview={(baseCurrencyAmount) =>
        flow.open('USDC', { baseCurrencyAmount })
      }
    />
  );
}
