import { useEffect } from 'react';
import { router } from 'expo-router';
import { useMoonPay } from '@/src/features/ramp/MoonPayProvider';

/** A return is a refresh hint, never proof of a completed purchase. */
export default function RampCallback() {
  const { flow } = useMoonPay();
  useEffect(() => {
    flow.returned();
    // A cold callback has no live checkout; it still only asks for a re-read.
    flow.hintReturn();
    router.replace('/(app)');
  }, [flow]);
  return null;
}
