import { ReceiptBound } from '@/src/features/activity/ReceiptBound';
import { readReceiptIntent } from '@/src/features/activity/receiptSnapshotStore';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { useLocalSearchParams } from 'expo-router';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import {
  assertActivityFeeLabelIsNetworkOnly,
  assertNoForbiddenActivityLabels,
  resolveActivityCopyToast,
  resolveActivityDetailChrome,
} from '@/src/features/activity/activityRoutePresentation';
import {
  activityExplorerUrl,
  resolveActivityExplorerCta,
  resolveActivityExplorerGate,
} from '@/src/features/activity/activityExplorerLink';
import { resolveActivityRowTitle } from '@/src/features/activity/activityLabels';
import {
  formatActivityAmount,
  formatFeeSol,
} from '@/src/features/activity/formatActivityAmount';
import { formatActivityTime } from '@/src/features/activity/groupByDay';
import { useWalletActivity } from '@/src/features/activity/useWalletActivity';
import { BALANCE_MASK } from '@/src/features/balances/hideBalances';
import { useHideBalances } from '@/src/features/balances/hideBalancesPreference';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { resolveNetworkStatus, type NetworkStatus } from '@/src/lib/apiConfig';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { SecondaryCTA } from '@/src/ui/controls/SecondaryCTA';
import { Toast } from '@/src/ui/feedback/Toast';
import { HeaderRow } from '@/src/ui/navigation/HeaderRow';
import { Surface } from '@/src/ui/primitives/Surface';
import { MetaRow } from '@/src/ui/rows/MetaRow';
import { Skeleton } from '@/src/ui/state/Skeleton';
import { colors, spacing, typography } from '@/src/ui/tokens';

const FEE_LABEL = assertActivityFeeLabelIsNetworkOnly(copy.activity.fee);

assertNoForbiddenActivityLabels(Object.values(copy.activity));

const DETAIL_SKELETON_WIDTH = 353;
const DETAIL_SKELETON_HEIGHT = 38;

type CopyOutcome = 'copied' | 'failed' | null;

export default function ActivityDetailScreen() {
  const { signature: rawSig } = useLocalSearchParams<{ signature: string }>();
  const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig;
  const { session } = useCorsoSession();
  const activity = useWalletActivity(session?.address);
  const hideBalances = useHideBalances();
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(
    null,
  );
  const [copyOutcome, setCopyOutcome] = useState<CopyOutcome>(null);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    async function resolveReceiptNetwork() {
      const next = await resolveNetworkStatus();
      if (cancelled) return;
      setNetworkStatus(next);
      if (next.state === 'unknown') retry = setTimeout(() => { void resolveReceiptNetwork(); }, 4000);
    }
    void resolveReceiptNetwork();
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, []);

  const item = useMemo(
    () => activity.items.find((row) => row.signature === signature) ?? null,
    [activity.items, signature],
  );

  const chrome = resolveActivityDetailChrome({
    status: activity.status,
    item,
    hasAddress: Boolean(session?.address),
  });

  const toast = resolveActivityCopyToast(copyOutcome);

  const explorerGate = resolveActivityExplorerGate(networkStatus);
  const explorerCta = resolveActivityExplorerCta(explorerGate);

  async function onCopy() {
    if (!signature) return;
    try {
      await Clipboard.setStringAsync(signature);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopyOutcome('copied');
    } catch {
      setCopyOutcome('failed');
    }
  }

  async function onExplorer() {
    const url = activityExplorerUrl({ gate: explorerGate, signature });
    if (!url) return;
    await WebBrowser.openBrowserAsync(url);
  }

  const amount = item ? formatActivityAmount(item) : null;

  const signedIntent = session?.address && networkStatus?.state === 'known'
    ? readReceiptIntent(signature, session.address, networkStatus.cluster) : null;
  if (session?.address && signature && (signedIntent || item?.kind === 'swap' || !item)) {
    return <ReceiptBound key={`${session.address}:${signature}:${networkStatus?.state === 'known' ? networkStatus.cluster : 'unknown'}`} signature={signature} owner={session.address} network={networkStatus} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <HeaderRow
        left="back-chevron"
        onBackPress={() => goBackOr(BACK_FALLBACK.activityTab)}
        backAccessibilityLabel={copy.v1.back}
        title={copy.activity.detailTitle}
        right="none"
      />

      {/*
        `position: relative` + `flex: 1` — the box `ScrollEdgeFade` pins itself
        to. Without the wrapper the fade would size to the scrolled content.
      */}
      <View style={styles.scrollWrap}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={activity.refreshing}
              onRefresh={() => {
                void activity.refresh();
              }}
              tintColor={colors.ink}
              colors={[colors.ink]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {chrome.state === 'loading' ? (
            <View style={styles.center}>
              <Skeleton
                what={copy.activity.detailTitle}
                width={DETAIL_SKELETON_WIDTH}
                height={DETAIL_SKELETON_HEIGHT}
              />
              <CorsoText style={styles.muted}>
                {copy.activity.loading}
              </CorsoText>
            </View>
          ) : null}

          {chrome.showDetail === false && chrome.state !== 'loading' ? (
            <CorsoText style={styles.muted}>{chrome.message}</CorsoText>
          ) : null}

          {chrome.showDetail && item ? (
            <>
              <CorsoText style={styles.title} accessibilityRole="header">
                {resolveActivityRowTitle(item)}
              </CorsoText>
              {amount ? (
                <CorsoText
                  style={styles.amount}
                  accessibilityLabel={
                    hideBalances
                      ? copy.profile.preferencesBalanceHidden
                      : undefined
                  }
                >
                  {hideBalances ? BALANCE_MASK : amount}
                </CorsoText>
              ) : null}
              {item.blockTimeMs != null ? (
                <CorsoText style={styles.muted}>
                  {formatActivityTime(item.blockTimeMs)}
                </CorsoText>
              ) : null}

              <View style={styles.card}>
                <Surface fill="surface" radius="md">
                  <View style={styles.cardRows}>
                    <MetaRow
                      label={copy.activity.status}
                      value={
                        chrome.statusLabel ?? copy.activity.statusConfirmed
                      }
                      hasInfo={false}
                      emphasis={chrome.statusEmphasis}
                    />
                    <MetaRow
                      label={FEE_LABEL}
                      value={formatFeeSol(item.feeLamports)}
                      hasInfo={false}
                      emphasis="default"
                    />
                    {item.ataRentLamports !== 0 ? (
                      <>
                        <MetaRow label={copy.activity.accountRentLabel} value={formatFeeSol(item.ataRentLamports ?? null)} hasInfo={false} emphasis="default" />
                        <CorsoText>{copy.activity.rentRecovery}</CorsoText>
                      </>
                    ) : null}
                    {item.walletCostLamports !== 0 ? (
                      <MetaRow label={copy.activity.totalCostLabel} value={formatFeeSol(item.walletCostLamports ?? null)} hasInfo={false} emphasis="default" />
                    ) : null}
                    <MetaRow
                      label={copy.activity.signature}
                      value={truncateAddress(item.signature)}
                      hasInfo={false}
                      emphasis="default"
                    />
                    {item.counterparty ? (
                      <MetaRow
                        label={copy.activity.counterparty}
                        value={truncateAddress(item.counterparty)}
                        hasInfo={false}
                        emphasis="default"
                      />
                    ) : null}
                  </View>
                </Surface>
              </View>

              <PrimaryCTA
                label={copy.activity.copySignature}
                onPress={() => {
                  void onCopy();
                }}
                style={styles.primaryCta}
              />
              <SecondaryCTA
                label={copy.activity.explorer}
                onPress={() => {
                  void onExplorer();
                }}
                disabled={!explorerCta.enabled}
                style={styles.secondaryCta}
              />
              {explorerCta.showNetworkUnknownNotice ? (
                <CorsoText style={styles.muted}>
                  {copy.activity.explorerNetworkUnknown}
                </CorsoText>
              ) : null}
            </>
          ) : null}
        </ScrollView>
        <ScrollEdgeFade color={colors.canvas} />
      </View>

      {toast ? (
        <View style={styles.toastSlot} pointerEvents="box-none">
          <Toast
            message={toast.message}
            tone={copyOutcome === 'failed' ? 'error' : 'neutral'}
            onDismiss={() => setCopyOutcome(null)}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollWrap: { flex: 1, position: 'relative' },
  content: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xl * 2,
  },
  center: {
    paddingTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    marginTop: spacing.md,
    fontSize: typography.title,
    fontWeight: '600',
    color: colors.ink,
  },
  amount: {
    marginTop: spacing.sm,
    fontSize: typography.hero,
    fontWeight: '600',
    color: colors.ink,
  },
  muted: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.body,
  },
  card: {
    marginTop: spacing.xl,
  },
  cardRows: {
    padding: spacing.md,
    gap: spacing.md,
  },
  primaryCta: {
    marginTop: spacing.xl,
  },
  secondaryCta: {
    marginTop: spacing.sm,
  },
  toastSlot: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    alignItems: 'center',
  },
});
