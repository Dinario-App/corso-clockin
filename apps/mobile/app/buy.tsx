import { useEffect } from 'react';
import { router } from 'expo-router';
import { useMoonPay } from '@/src/features/ramp/MoonPayProvider';

/** Legacy deep links open the same sheet; app Buy buttons never push this route. */
export default function BuyDeepLink() {
  const { flow } = useMoonPay();
  useEffect(() => {
    router.replace('/(app)');
    flow.open();
  }, [flow]);
  return null;
}
