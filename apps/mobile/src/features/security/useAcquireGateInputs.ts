import { useEffect, useState } from 'react';
import {
  loadJurisdictionGateInputs,
  type JurisdictionGateInputs,
} from '@/src/features/security/jurisdictionGateInputs';

export function useAcquireGateInputs(
  enabled = true,
): JurisdictionGateInputs | null {
  const [inputs, setInputs] = useState<JurisdictionGateInputs | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadJurisdictionGateInputs().then(
      (next) => {
        if (!cancelled) setInputs(next);
      },
      () => {
        // Unreadable stays `null` → unknown. The confirm refuses on its own.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return inputs;
}
