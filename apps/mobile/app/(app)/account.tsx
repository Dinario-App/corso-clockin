import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { usePrivy } from '@privy-io/expo';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import {
  ACCOUNT_SEND_HREF,
  HOME_SEND_PARAM,
  resolveAccountRootCards,
  type AccountRootRow,
} from '@/src/features/account/accountRootPresentation';
import { AccountDangerZone } from '@/src/features/account/ui/AccountDangerZone';
import { resolveDeleteEntryPresentation } from '@/src/features/account/deleteEntryPresentation';
import { maskedSessionEmail } from '@/src/features/account/maskedEmail';
import { AccountIdentityCard } from '@/src/features/account/ui/AccountIdentityCard';
import {
  PROFILE_GUTTER,
  PROFILE_STACK_GAP,
  ProfileRootHeading,
  ProfileRootPane,
  ProfileRootRow,
  profileRootType,
} from '@/src/features/account/ui/ProfileRootEthena';
import {
  SignOutConfirmField,
  SignOutSheetBody,
  SignOutSheetError,
} from '@/src/features/account/ui/AccountSignOutSheetChrome';
import { useLaneGate } from '@/src/features/navigation/laneGates';
import { readGrokbotRoutesFlag } from '@/src/features/navigation/grokbotRoutes';
import { readDeskBuildFlag } from '@/src/features/desk/deskEnv';
import { PortfolioNameRow } from '@/src/features/profile/PortfolioNameRow';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { openBookAddCash } from '@/src/features/home/book/bookDoors';
import { executeSessionTypeAwareSignOut } from '@/src/features/session/sessionSignOut';
import {
  isSignOutConfirmed,
  resolveSignOutSheet,
} from '@/src/features/session/signOutSheetPresentation';
import { PrimaryCTA } from '@/src/ui/controls/PrimaryCTA';
import { TextButton } from '@/src/ui/controls/TextButton';
import { BottomSheet } from '@/src/ui/primitives/BottomSheet';
import { resolveRampEnabled, resolveSendEnabled } from '@/src/lib/apiConfig';
import { truncateAddress } from '@/src/lib/truncateAddress';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';
import { resolveTabBarPresentation } from '@/src/ui/navigation/tabBarPresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import {
  SCROLL_FADE_BOTTOM,
  resolveDockedListEdge,
} from '@/src/ui/primitives/scrollEdgeFadePresentation';

const PROFILE_DELETE_HREF = '/profile/delete';

export default function AccountRoot() {
  const scrollFade = useScrollLinkedFadeTop();
  const {
    session,
    clearConnectedSession,
    resetSessionLocalState,
    hasImportedWalletOnPhone,
    connectedStatus,
  } = useCorsoSession();
  const { logout, user, isReady } = usePrivy();
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useAccessibilityPreference();
  const [sendEnabled, setSendEnabled] = useState(false);
  const botsEnabled = useLaneGate('bots');
  const [buyEnabled, setBuyEnabled] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutTyped, setSignOutTyped] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const signOutInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      resolveSendEnabled().catch(() => false),
      resolveRampEnabled().catch(() => false),
    ]).then(([send, ramp]) => {
      if (cancelled) return;
      setSendEnabled(send === true);
      setBuyEnabled(ramp === true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reserve = resolveTabBarPresentation({
    hidden: false,
    safeAreaBottom: insets.bottom,
    reduceMotion,
  }).reserve;
  const edge = resolveDockedListEdge({
    bottomReserve: reserve,
    fadeBottom: SCROLL_FADE_BOTTOM,
    clearance: DOCK_CLEARANCE,
  });

  const cards = resolveAccountRootCards({
    sendEnabled,
    botsEnabled,
    buyEnabled,
    sessionType: session?.type,
    grokbotRoutesEnabled: readGrokbotRoutesFlag(),
    deskV1: readDeskBuildFlag(),
  });
  const address = session?.address ?? null;
  const signOutSheet = resolveSignOutSheet(session?.type);
  const deleteEntry = resolveDeleteEntryPresentation({
    hasCorsoServerAccount: isReady ? Boolean(user) : null,
    hasImportedWalletOnPhone,
    hasConnectedWalletOnPhone: connectedStatus !== 'none',
  });

  function activate(row: AccountRootRow) {
    if (row.action.kind === 'sign-out') {
      setSignOutTyped('');
      setSignOutError(null);
      setSignOutOpen(true);
      return;
    }
    if (row.action.kind === 'buy') { openBookAddCash(router); return; }
    if (row.action.kind === 'push') {
      router.push(row.action.href as never);
      return;
    }
    router.navigate({
      pathname: ACCOUNT_SEND_HREF,
      params: { [HOME_SEND_PARAM]: String(Date.now()) },
    } as never);
  }

  async function signOut() {
    if (signOutInFlight.current) return;
    // The one gate. The import path signs out only with the words typed.
    if (
      !isSignOutConfirmed({ sessionType: session?.type, typed: signOutTyped })
    ) {
      return;
    }
    signOutInFlight.current = true;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await executeSessionTypeAwareSignOut(session?.type, {
        clearConnectedSession,
        resetSessionLocalState,
        logoutPrivy: logout,
      });
      setSignOutOpen(false);
      setSignOutTyped('');
    } catch {
      setSignOutError(copy.profile.errorSignOut);
    } finally {
      signOutInFlight.current = false;
      setSigningOut(false);
    }
  }

  return (
    <EthenaGround>
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/*
        `position: relative` + `flex: 1` — the box `ScrollEdgeFade` pins itself
        to. Without the wrapper the fade would size to the scrolled content.
      */}
      <View style={styles.scrollWrap}>
        <ScrollView
          {...scrollFade.scroller}
          style={styles.flex}
          contentContainerStyle={[
            styles.canvas,
            { paddingBottom: edge.paddingBottom },
          ]}
          contentInsetAdjustmentBehavior="never"
        >
          <CorsoText style={styles.title} accessibilityRole="header">
            {copy.roots.accountTitle}
          </CorsoText>

          <AccountIdentityCard
            name={copy.request.accountName}
            maskedEmail={maskedSessionEmail(user, isReady)}
            address={address}
            addressShort={address ? truncateAddress(address) : null}
            copyAccessibilityLabel={copy.account.copyAddress}
            copiedLabel={copy.account.addressCopied}
            copyFailedLabel={copy.account.addressCopyFailed}
            testID="account-identity-card"
          />

          <ProfileRootPane testID="account-card-name" style={styles.stacked}>
            <PortfolioNameRow />
          </ProfileRootPane>

          {cards.map((card) => (
            <View key={card.id} style={styles.section}>
              <ProfileRootHeading label={card.heading} />
              <ProfileRootPane testID={`account-card-${card.id}`}>
                {card.rows.map((row, index) =>
                  row.accessory === 'none' ? (
                    <ProfileRootRow
                      key={row.id}
                      glyph={row.glyph}
                      label={
                        row.id === 'sign-out' && signingOut
                          ? copy.profile.signingOut
                          : row.label
                      }
                      sub={row.sub}
                      accessory="none"
                      disabled={row.id === 'sign-out' && signingOut}
                      last={index === card.rows.length - 1}
                      onPress={() => activate(row)}
                      testID={`account-row-${row.id}`}
                    />
                  ) : (
                    <ProfileRootRow
                      key={row.id}
                      glyph={row.glyph}
                      label={row.label}
                      sub={row.sub}
                      accessory="chevron"
                      last={index === card.rows.length - 1}
                      onPress={() => activate(row)}
                      testID={`account-row-${row.id}`}
                    />
                  ),
                )}
              </ProfileRootPane>
            </View>
          ))}

          <AccountDangerZone
            label={deleteEntry.label}
            note={deleteEntry.dangerNote}
            accessibilityLabel={deleteEntry.accessibilityLabel}
            onPress={() => router.push(PROFILE_DELETE_HREF as never)}
            testID="account-danger"
          />
        </ScrollView>
        {/* Two fades, as Home draws them: the top dissolves into the ground's
            crest, the bottom into the void it has decayed to under the dock. */}
        <ScrollEdgeFade
          top={scrollFade.top}
          bottom={0}
          color={ethena.groundStops[0][1]}
        />
        <ScrollEdgeFade
          top={0}
          bottom={edge.fadeBottom}
          color={ethena.void}
          testID="account-scroll-fade"
        />
      </View>

      {/*
        Sign out — a sign-in session and an imported session read differently,
        and the import path cannot pass without typing the phrase.
      */}
      <BottomSheet
        kind="destructive"
        title={signOutSheet.title}
        visible={signOutOpen}
        dismissible={!signingOut}
        signing={signingOut}
        onRequestClose={() => setSignOutOpen(false)}
        testID="account-sign-out-sheet"
      >
        <SignOutSheetBody body={signOutSheet.body} />
        {signOutSheet.requiresTypedConfirm ? (
          <SignOutConfirmField
            value={signOutTyped}
            onChangeText={setSignOutTyped}
            placeholder={signOutSheet.confirmPlaceholder ?? ''}
            editable={!signingOut}
          />
        ) : null}
        <PrimaryCTA
          label={signOutSheet.ctaLabel}
          busy={signingOut}
          disabled={
            !isSignOutConfirmed({
              sessionType: session?.type,
              typed: signOutTyped,
            })
          }
          onPress={() => {
            void signOut();
          }}
        />
        <TextButton
          label={signOutSheet.cancelLabel}
          disabled={signingOut}
          onPress={() => setSignOutOpen(false)}
        />
        {signOutError ? (
          <SignOutSheetError message={signOutError} />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
    </EthenaGround>
  );
}

const DOCK_CLEARANCE = 24;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollWrap: { flex: 1, position: 'relative' },
  flex: { flex: 1 },
  canvas: {
    paddingHorizontal: PROFILE_GUTTER,
    paddingTop: 20,
  },
  title: {
    ...profileRootType.title,
    marginBottom: PROFILE_STACK_GAP,
  },
  stacked: { marginTop: PROFILE_STACK_GAP },
  section: { marginTop: PROFILE_STACK_GAP, gap: PROFILE_STACK_GAP },
});
