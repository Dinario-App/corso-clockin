import { useCallback, useEffect, useState } from 'react';
import { resolveNetworkStatus, type NetworkStatus } from '@/src/lib/apiConfig';
import type { ActivityRowLabelEvidence } from './activityLabels';
import { readReceiptIntents } from './receiptSnapshotStore';
import type { ActivityItem } from './types';

type SwapEvidence = NonNullable<ActivityRowLabelEvidence['swap']>;

export async function loadActivityRowSwaps(
  signatures: readonly string[],
  owner: string | null | undefined,
  deps: {
    resolveNetwork: () => Promise<NetworkStatus>;
    readIntents: typeof readReceiptIntents;
  } = { resolveNetwork: resolveNetworkStatus, readIntents: readReceiptIntents },
): Promise<ReadonlyMap<string, SwapEvidence>> {
  if (!owner || signatures.length === 0) return new Map();
  const network = await deps.resolveNetwork();
  if (network.state !== 'known') return new Map();
  const intents = await deps.readIntents(signatures, owner, network.cluster);
  return new Map(
    [...intents].map(([signature, intent]) => [
      signature,
      { pay: intent.pay, receive: intent.receive },
    ]),
  );
}

export function useActivityRowLabels(
  items: readonly ActivityItem[],
  owner: string | null | undefined,
): (signature: string) => ActivityRowLabelEvidence | undefined {
  const [loaded, setLoaded] = useState<{
    owner: string | null;
    swaps: ReadonlyMap<string, SwapEvidence>;
  }>(() => ({ owner: null, swaps: new Map() }));

  // Keyed on the signatures, not the array: a refetch of the same rows (or a
  // fresh empty list each render) must not re-read storage or re-render.
  const signatures = JSON.stringify(items.map((item) => item.signature));

  useEffect(() => {
    let cancelled = false;
    const list: string[] = JSON.parse(signatures);
    void loadActivityRowSwaps(list, owner)
      .catch(() => new Map<string, SwapEvidence>())
      .then((swaps) => {
        if (cancelled) return;
        setLoaded((previous) =>
          previous.swaps.size === 0 && swaps.size === 0
            ? previous
            : { owner: owner ?? null, swaps },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [signatures, owner]);

  return useCallback(
    (signature: string) => {
      if (!owner || loaded.owner !== owner) return undefined;
      const swap = loaded.swaps.get(signature);
      return swap ? { swap } : undefined;
    },
    [loaded, owner],
  );
}
