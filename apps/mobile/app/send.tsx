import { assertMwaMoneyPathAvailable } from '@/src/features/connect/assertMwaMoneyPathAvailable';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { ETHENA_BODY_MARGIN, ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { useFiatTotal } from '@/src/features/balances/useFiatTotal';
import {
  resolveHomeBalancePhase,
  resolveHomeEmptyPresentation,
  resolveSendGateNotice,
} from '@/src/features/home/homeEmptyPresentation';
import { goBackOr } from '@/src/features/navigation/goBackOr';
import { BACK_FALLBACK } from '@/src/features/navigation/guardedBack';
import { SendSheetContent } from '@/src/features/send/SendSheetContent';
import { SendScreenHeader } from '@/src/features/send/SendScreenChrome';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { resolveSendEnabled } from '@/src/lib/apiConfig';
import { CorsoText } from '@/src/theme/CorsoText';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';

/** Dedicated Send host. Root SessionLockBoundary still owns auth/lock admission.
 * The holdings predicate and nonce admission effect below are extracted verbatim
 * from the Ask-era host at 434fef2be. No signing or transfer logic lives here.
 */
export default function SendScreen() {
  const scrollFade = useScrollLinkedFadeTop();
  const params = useLocalSearchParams<{ send?: string }>();
  // A bare /send is now a screen entry; Profile's explicit nonce still wins.
  const routeParams = { send: params.send ?? 'direct' };
  const handledSendParam = useRef<string | null>(null);
  const { session, connectedStatus } = useCorsoSession();
  const { getAccessToken } = usePrivy();
  const fiat = useFiatTotal(session?.address, { session, getAccessToken });
  const [sendFlagEnabled, setSendFlagEnabled] = useState(true);
  const [sendFlagResolved, setSendFlagResolved] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendSigning, setSendSigning] = useState(false);
  // Retain this setter name so the extracted admission effect is byte-identical.
  const [askToast, setAskToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveSendEnabled()
      .then((send) => {
        if (cancelled) return;
        setSendFlagEnabled(send);
        setSendFlagResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSendFlagEnabled(false);
        setSendFlagResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const balancePhase = resolveHomeBalancePhase(fiat.holdings?.quantityStatus);
  // Optimistic `true` is not admission. Hold the nonce until the flag settles,
  // the same way holdings loading already holds it.
  const stillLoading = balancePhase === 'loading' || !sendFlagResolved;
  const balancesUnreadable = balancePhase === 'unreadable';
  const hasHoldings =
    fiat.holdings?.quantityStatus === 'ready' &&
    fiat.holdings?.lines.some(
      (line) =>
        line.includeInHomeTotal &&
        /^\d+$/.test(line.atomic) &&
        BigInt(line.atomic) > 0n,
    ) === true;
  const chrome = resolveHomeEmptyPresentation({
    hasHoldings,
    balancesKnown: !stillLoading,
    sendFlagEnabled,
    askPhase: 'idle',
    balancesUnreadable,
  });
  useEffect(() => {
    const incoming =
      typeof routeParams.send === 'string' ? routeParams.send : null;
    if (incoming === null || handledSendParam.current === incoming) return;
    if (stillLoading) return;
    handledSendParam.current = incoming;
    if (session) {
      try {
        assertMwaMoneyPathAvailable({
          sessionType: session.type,
          capabilities: session.capabilities,
          connectedStatus,
          readOnly: true,
        });
      }
      catch { setAskToast(copy.send.disabled); return; }
    }
    const refused = resolveSendGateNotice({
      isEmpty: chrome.isEmpty,
      balancesUnreadable,
      sendFlagEnabled,
    });
    if (refused) {
      setAskToast(refused);
      return;
    }
    setSendOpen(true);
  }, [
    routeParams.send,
    stillLoading,
    chrome.isEmpty,
    balancesUnreadable,
    sendFlagEnabled,
    session,
    connectedStatus,
  ]);

  const close = useCallback(() => {
    if (!sendSigning) goBackOr(BACK_FALLBACK.accountTab);
  }, [sendSigning]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (!sendSigning) goBackOr(BACK_FALLBACK.accountTab);
          return true;
        },
      );
      return () => subscription.remove();
    }, [sendSigning]),
  );

  return (
    <EthenaGround>
      <Stack.Screen options={{ gestureEnabled: !sendSigning }} />
      {sendOpen ? (
        <SendSheetContent
          onRequestClose={close}
          onSigningChange={setSendSigning}
        />
      ) : (
        <SafeAreaView style={{ flex: 1 }}>
          <SendScreenHeader
            title={copy.send.title}
            onBack={close}
            testID="send-header"
          />
          <View style={{ flex: 1 }}>
            <ScrollView
              {...scrollFade.scroller}
              contentContainerStyle={{ padding: ETHENA_BODY_MARGIN }}
            >
              <CorsoText
                accessibilityLiveRegion="polite"
                style={{ ...ETHENA_TYPE.sub, color: ethena.ink.secondary }}
              >
                {askToast ?? copy.home.balancePlaceholder}
              </CorsoText>
            </ScrollView>
            <ScrollEdgeFade
              top={scrollFade.top}
              color={ethena.groundStops[0][1]}
            />
          </View>
        </SafeAreaView>
      )}
    </EthenaGround>
  );
}
