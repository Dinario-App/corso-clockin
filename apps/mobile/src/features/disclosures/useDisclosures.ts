import { useEffect, useState } from 'react';
import { resolveDisclosures } from './disclosureGate';
import type { DisclosureSet } from '@corso/disclosures';

export type UseDisclosuresState = {
  /** True only for a validated, complete, correctly ordered set of nine. */
  disclosuresReady: boolean;
  /** The set, for screens that render it. `null` whenever not ready. */
  set: DisclosureSet | null;
  /** False once the first resolution settles, either way. */
  loading: boolean;
};

export function useDisclosures(): UseDisclosuresState {
  const [state, setState] = useState<UseDisclosuresState>({
    disclosuresReady: false,
    set: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const readiness = await resolveDisclosures();
      if (cancelled) return;
      setState({
        disclosuresReady: readiness.disclosuresReady,
        set: readiness.disclosuresReady ? readiness.set : null,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
