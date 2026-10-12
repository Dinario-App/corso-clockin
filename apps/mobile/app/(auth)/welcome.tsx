import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Image, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { usePrivy } from '@privy-io/expo';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import {
  DeleteAccountIncompleteNotice,
  readDeleteAccountIncompleteNotice,
} from '@/src/features/account/deleteAccountIncompleteNotice';
import { LiveDeskCard } from '@/src/features/liveDesk/LiveDeskCard';
import { resolveHowItWorksPageFadeBottom } from '@/src/features/howItWorks/howItWorksPresentation';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade';
import { useScrollLinkedFadeTop } from '@/src/ui/primitives/useScrollLinkedFadeTop';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import {
  resolveWelcomeDoorAccessibility,
  resolveWelcomeLegalAccessibility,
} from '@/src/features/session/welcomeAccessibility';
import {
  WELCOME_APPLE_EXIT,
  WELCOME_EMAIL_EXIT,
  WELCOME_GOOGLE_EXIT,
} from '@/src/features/session/welcomeRoutePresentation';
import { isAppleSignInEnabled } from '@/src/features/security/config';
import { shouldAnnounceOnboardingStart } from '@/src/features/session/sessionGate';
import { resolveBuildFlavor, trackEvent } from '@/src/lib/analytics';
import { LEGAL_URLS } from '@/src/lib/legalUrls';
import { AppleSignInButton, GoogleSignInButton } from '@/src/ui/auth/ProviderSignInButtons';
import { TextButton } from '@/src/ui/controls/TextButton';
import { EthenaDoorRow } from '@/src/ui/ethena/EthenaDoorRow';
import { WELCOME_LOCKUP } from '@/src/ui/quiet/launchMarkPresentation';
import { LOCKED_GROUND_PARI_BOX } from '@/src/features/lock/lockedGroundPresentation';
import { PariMark } from '@/src/ui/brand/PariMark';
import { EthenaGround, EthenaTray } from '@/src/ui/ethena/EthenaPrimitives';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { readWealthV1BuildFlag } from '@/src/features/wealth/wealthEnv';

export default function WelcomeScreen() {
  const {
    phase,
    session,
    needsLockSetup,
    locked,
    privyReady,
    privyRestoreState,
  } = useCorsoSession();
  const { user } = usePrivy();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [
    deleteAccountIncompleteNoticeVisible,
    setDeleteAccountIncompleteNoticeVisible,
  ] = useState(readDeleteAccountIncompleteNotice);
  const onboardingAnnounced = useRef(false);
  const scrollFade = useScrollLinkedFadeTop();
  const [overflow, setOverflow] = useState({
    contentHeight: 0,
    viewportHeight: 0,
    scrollY: 0,
  });
  useEffect(() => {
    if (onboardingAnnounced.current) return;
    if (
      !shouldAnnounceOnboardingStart({
        phase,
        gate: {
          hasSession: Boolean(session),
          needsLockSetup,
          locked,
          restoreState: privyRestoreState,
        },
      })
    ) {
      return;
    }
    onboardingAnnounced.current = true;
    trackEvent('onboarding_welcome_viewed', {
      build_flavor: resolveBuildFlavor(),
    });
    trackEvent('onboarding_started');
  }, [phase, session, needsLockSetup, locked, privyRestoreState]);

  useEffect(() => {
    let active = true;
    if (Platform.OS !== 'ios' || !isAppleSignInEnabled()) {
      setAppleAvailable(false);
      return () => {
        active = false;
      };
    }
    void AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => {
        if (active) setAppleAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (phase === 'booting' || privyRestoreState === 'pending') {
    return (
      <View style={styles.boot}>
        <PariMark size={LOCKED_GROUND_PARI_BOX} />
      </View>
    );
  }

  if (session && needsLockSetup) {
    return <Redirect href="/(auth)/lock-setup" />;
  }

  if (session && locked) {
    return <Redirect href="/(auth)/unlock" />;
  }

  if (session) {
    return <Redirect href="/(app)" />;
  }

  if (privyReady && user && !deleteAccountIncompleteNoticeVisible) {
    return (
      <Redirect
        href={{ pathname: '/(auth)/signin', params: { method: 'resume' } }}
      />
    );
  }

  const disabled = !privyReady;
  const wealthV1 = readWealthV1BuildFlag();
  const googleA11y = resolveWelcomeDoorAccessibility({
    disabled,
    primaryLabel: copy.welcome.ctaGoogle,
  });
  const emailA11y = resolveWelcomeDoorAccessibility({
    disabled,
    primaryLabel: copy.v1.continueEmail,
  });
  const legalA11y = resolveWelcomeLegalAccessibility({
    termsLabel: copy.welcome.legalTerms,
    privacyLabel: copy.welcome.legalPrivacy,
  });

  const openProvider = (
    exit: typeof WELCOME_APPLE_EXIT | typeof WELCOME_EMAIL_EXIT | typeof WELCOME_GOOGLE_EXIT,
  ) => {
    if (disabled) return;
    trackEvent('onboarding_door_selected', { door: 'privy' });
    router.push(exit);
  };

  return (
    <EthenaGround>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <DeleteAccountIncompleteNotice
          visible={deleteAccountIncompleteNoticeVisible}
          onDismiss={() => setDeleteAccountIncompleteNoticeVisible(false)}
        />
        <View style={styles.doorBody} testID="welcome-column">
          <View style={styles.scrollRegion} testID="welcome-scroll-region">
            <ScrollView
              testID="welcome-scroller"
              {...scrollFade.scroller}
              // After the spread: it still drives the top fade, and also tracks
              // the offset the bottom fade reads.
              onScroll={(event) => {
                scrollFade.scroller.onScroll(event);
                const scrollY = event.nativeEvent.contentOffset.y;
                setOverflow((prev) =>
                  prev.scrollY === scrollY ? prev : { ...prev, scrollY },
                );
              }}
              onLayout={(event) => {
                const viewportHeight = event.nativeEvent.layout.height;
                setOverflow((prev) =>
                  prev.viewportHeight === viewportHeight
                    ? prev
                    : { ...prev, viewportHeight },
                );
              }}
              onContentSizeChange={(_, contentHeight) => {
                setOverflow((prev) =>
                  prev.contentHeight === contentHeight
                    ? prev
                    : { ...prev, contentHeight },
                );
              }}
              style={styles.scroller}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="never"
            >
              <Image
                testID="welcome-lockup"
                accessible
                accessibilityRole="image"
                accessibilityLabel={copy.welcome.wordmark}
                source={require('@/assets/brand/pari/2-pari-lockup-128h.png')}
                resizeMode="contain"
                style={styles.lockup}
              />
              <View style={styles.liveDesk} testID="welcome-live-desk-slot">
                <LiveDeskCard plane="float" testID="welcome-live-desk" />
              </View>
            </ScrollView>
            <ScrollEdgeFade
              top={scrollFade.top}
              bottom={0}
              color={ethena.groundStops[0][1]}
              testID="welcome-fade-top"
            />
            <ScrollEdgeFade
              top={0}
              bottom={resolveHowItWorksPageFadeBottom(overflow)}
              color={ethena.void}
              testID="welcome-fade-bottom"
            />
          </View>

          {wealthV1 ? (
            <>
              <CorsoText
                accessibilityRole="header"
                style={[styles.title, styles.centred]}
              >
                {copy.wealthV1.welcome.line}
              </CorsoText>
              <CorsoText
                testID="welcome-subline"
                style={[styles.subLine, styles.centred]}
              >
                {`${copy.wealthV1.welcome.sub}\n${copy.wealthV1.welcome.promise}`}
              </CorsoText>
            </>
          ) : (
            <>
              <CorsoText accessibilityRole="header" style={styles.title}>
                {copy.quietMark.line}
              </CorsoText>
              <CorsoText testID="welcome-subline" style={styles.subLine}>
                {copy.quietMark.subLine}
              </CorsoText>
            </>
          )}

          <View style={styles.floor} />

          <View style={styles.signIn} testID="welcome-sign-in">
            <View style={styles.providers} testID="welcome-providers">
              <GoogleSignInButton
                testID="welcome-door-google"
                label={copy.welcome.ctaGoogle}
                onPress={() => openProvider(WELCOME_GOOGLE_EXIT)}
                disabled={disabled}
                accessibilityLabel={googleA11y.primary.accessibilityLabel}
              />
              {appleAvailable && (
                <AppleSignInButton
                  testID="welcome-door-apple"
                  onPress={() => openProvider(WELCOME_APPLE_EXIT)}
                />
              )}
            </View>

            <View style={styles.doors}>
              <EthenaTray testID="welcome-doors" style={styles.doorTray}>
                <EthenaDoorRow
                  first
                  label={copy.v1.continueEmail}
                  onPress={() => openProvider(WELCOME_EMAIL_EXIT)}
                  disabled={disabled}
                  accessibilityLabel={emailA11y.primary.accessibilityLabel}
                  testID="welcome-door-email"
                />
              </EthenaTray>
            </View>
          </View>

          <View style={styles.legalBlock} testID="welcome-legal">
            <CorsoText style={styles.legal}>
              {copy.welcome.legalPrefix}
            </CorsoText>
            <TextButton
              label={copy.welcome.legalTerms}
              tone="ink"
              size="inline"
              accessibilityRole={legalA11y.terms.accessibilityRole}
              accessibilityLabel={legalA11y.terms.accessibilityLabel}
              onPress={() => {
                void Linking.openURL(LEGAL_URLS.terms);
              }}
              style={styles.legalTextButton}
              labelStyle={styles.legalLink}
            />
            <CorsoText style={styles.legal}>{copy.welcome.legalAnd}</CorsoText>
            <View style={styles.legalPrivacyCluster}>
              <TextButton
                label={copy.welcome.legalPrivacy}
                tone="ink"
                size="inline"
                accessibilityRole={legalA11y.privacy.accessibilityRole}
                accessibilityLabel={legalA11y.privacy.accessibilityLabel}
                onPress={() => {
                  void Linking.openURL(LEGAL_URLS.privacy);
                }}
                style={styles.legalTextButton}
                labelStyle={styles.legalLink}
              />
              <CorsoText style={styles.legal}>
                {copy.welcome.legalSuffix}
              </CorsoText>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </EthenaGround>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ethena.void,
  },
  root: { flex: 1, backgroundColor: ethena.void },
  safe: { flex: 1 },
  scrollRegion: { flexShrink: 1, minHeight: 0 },
  scroller: { flexGrow: 0, flexShrink: 1 },
  scrollContent: {},
  /** The open space, between the line and the sign-in group. */
  floor: { flexGrow: 1 },
  doorBody: {
    flex: 1,
    paddingHorizontal: ethenaGeometry.gutter,
    paddingBottom: 8,
  },
  /**
   * The large left-aligned page title, the ladder's `title` rung.
   * Figma sets it 60dp under the status bar and 24dp above the tray.
   */
  lockup: {
    marginTop: 16,
    width: WELCOME_LOCKUP.width,
    height: WELCOME_LOCKUP.height,
  },
  liveDesk: { marginTop: 16 },
  /** The line on the ladder's `title` rung, 24dp under the lockup and above what follows. */
  title: {
    ...ETHENA_TYPE.title,
    marginTop: 24,
    marginBottom: 8,
    color: ethena.ink.primary,
  },
  /**
   * The sub-line: the `sub` rung in the cool secondary ink, then the 24 the
   * title used to keep. That 24 is the least the buttons ever stand off the
   * text: the spacer under it can collapse, the margin cannot.
   */
  subLine: {
    ...ETHENA_TYPE.sub,
    marginBottom: 24,
    color: ethena.ink.secondary,
  },
  centred: { textAlign: 'center' },
  /** The sign-in group: the provider buttons and the email tray, 12 between. */
  signIn: { gap: 12 },
  /** The provider pair: 12 between, the CTA-pair rhythm of the app. */
  providers: { gap: 12 },
  /** The email tray. */
  doors: { gap: 13 },
  /** The rows own their padding and hairlines, so the tray draws edge to edge. */
  doorTray: {
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  legalBlock: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  legal: {
    ...ETHENA_TYPE.keyValueInfo,
    color: ethena.ink.tertiary,
    textAlign: 'center',
  },
  legalTextButton: {
    marginTop: 0,
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  legalLink: { fontSize: ETHENA_TYPE.keyValueInfo.fontSize },
  legalPrivacyCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
});
