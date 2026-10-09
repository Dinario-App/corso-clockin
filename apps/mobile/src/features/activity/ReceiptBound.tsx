import { openSolanaConnectionOnKnownNetwork } from '@/src/features/send/solanaConnection';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Receipt } from '@/src/ui/ethena/screens/Receipt';
import { CorsoText } from '@/src/theme/CorsoText';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import {
  activityExplorerUrl,
  resolveActivityExplorerGate,
} from './activityExplorerLink';
import type { NetworkStatus } from '@/src/lib/apiConfig';
import { fetchReceiptChain, type ReceiptChainRecord } from './receiptChain';
import {
  readReceiptSnapshot,
  readReceiptIntent,
  type ReceiptSnapshot,
} from './receiptSnapshotStore';
import { presentReceipt } from './receiptPresentation';
import { useHideBalances } from '@/src/features/balances/hideBalancesPreference';
import { DetailsSeenBlock } from '@/src/features/why/WhyViews';
import { presentDetailsSeen } from '@/src/features/why/whyPresentation';

/** Bound receipt: chain polling and disk are read-only; it has no signing capability. */
export function ReceiptBound({
  signature,
  owner,
  network,
}: {
  signature: string;
  owner: string;
  network: NetworkStatus | null;
}) {
  const [chain, setChain] = useState<ReceiptChainRecord | null>(null);
  const [snapshot, setSnapshot] = useState<ReceiptSnapshot | null>(null);
  const [error, setError] = useState(false);
  const hideBalances = useHideBalances();
  const cluster = network?.state === 'known' ? network.cluster : null;
  const intent = cluster
    ? readReceiptIntent(signature, owner, cluster, snapshot)
    : null;
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    void readReceiptSnapshot(signature).then((value) => {
      if (!cancelled) setSnapshot(value);
    });
    return () => {
      cancelled = true;
    };
  }, [signature, owner]);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setChain(null);
    setError(false);
    const pinnedNetwork = network;
    if (!pinnedNetwork || pinnedNetwork.state !== 'known') return;
    const establishedNetwork = pinnedNetwork;
    async function poll() {
      try {
        const record = await fetchReceiptChain(signature, owner, {
          openConnection: () =>
            openSolanaConnectionOnKnownNetwork({
              resolveNetwork: async () => establishedNetwork,
            }),
        });
        if (cancelled) return;
        setChain(record);
        setError(false);
        if (
          (record.status === 'finalised' || record.status === 'failed') &&
          record.networkFeeLamports !== null
        )
          return;
      } catch {
        if (cancelled) return;
        setError(true);
      }
      timer = setTimeout(() => {
        void poll();
      }, 4000);
    }
    if (cluster) void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [signature, owner, cluster]);
  const chainUnavailable = error || network?.state === 'unknown';
  const model = presentReceipt({
    signature,
    intent,
    snapshot,
    chain,
    chainUnavailable,
    hideBalances,
  });
  const url = activityExplorerUrl({
    gate: resolveActivityExplorerGate(network),
    signature,
  });
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: ethena.void }}
      edges={['top', 'bottom']}
    >
      {chainUnavailable ? (
        <View testID="receipt-load-error">
          <CorsoText style={{ color: ethena.ink.secondary }}>
            {copy.receipt.chainUnavailable}
          </CorsoText>
        </View>
      ) : null}
      <Receipt
        model={model}
        seen={
          <DetailsSeenBlock
            view={presentDetailsSeen(snapshot?.details ?? null)}
          />
        }
        onBack={() => goBackOr(BACK_FALLBACK.activityTab)}
        onDone={() => router.replace('/(app)')}
        onViewOnChain={
          url
            ? () => {
                void WebBrowser.openBrowserAsync(url);
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}
