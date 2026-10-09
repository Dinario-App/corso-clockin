import { PriceAlertTapListener } from '@/src/features/priceAlerts/PriceAlertTapListener';
import { retryPriceAlertPushRevocations } from '@/src/features/priceAlerts/pushRuntime';
import { RevokeSessionNotice } from '@/src/features/bots/RevokeSessionNotice';
import { MoonPayProvider } from '@/src/features/ramp/MoonPayProvider';
import { useEffect } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { PrivyProvider } from '@privy-io/expo';
import { colors } from '@/constants/theme';
import {
  optionalMfaRelyingParty,
  requirePrivyEnv,
} from '@/src/features/security/config';
import { RootErrorBoundary } from '@/src/features/reliability/RootErrorBoundary';
import { PrivyMfaRootListener } from '@/src/features/security/PrivyMfaRootListener';
import { CorsoPrivyStorage } from '@/src/features/security/privyStorage';
import { useAiConsentPersistence } from '@/src/features/aiConsent/aiConsentStore';
import {
  SessionProvider,
  useCorsoSession,
} from '@/src/features/session/SessionContext';
import { BOOT_SPLASH_TIMEOUT_MS } from '@/src/features/session/sessionGate';
import { eraseDormantAiSignInsAtLaunch } from '@/src/features/session/localClearRegistry';
import { InkContrastProvider } from '@/src/ui/glass/useInkContrast';
import { SessionLockBoundary } from '@/src/features/session/SessionLockBoundary';
import { resolveSessionRouteGuard } from '@/src/features/session/sessionRouteGuard';
import { useLaneGatesHost } from '@/src/features/navigation/laneGates';
import { readGrokbotRoutesFlag } from '@/src/features/navigation/grokbotRoutes';
import { interFontMap } from '@/src/theme/interFontMap';
import { installDefaultFont } from '@/src/theme/installDefaultFont';
import { installFeeTelemetry } from '@/src/lib/feeTelemetry';
import { installJurisdictionGateTelemetry } from '@/src/lib/jurisdictionGateTelemetry';
import { installMoneyDoorTelemetry } from '@/src/lib/moneyDoorTelemetry';
import { installNetworkTelemetry } from '@/src/lib/networkTelemetry';
import { MaterialBlurTarget } from '@/src/ui/glass/BlurTarget';

// Module scope, not an effect: `buy.tsx` resolves the gate in its own mount
// effect, and an effect here would race it. The first unknown must not report
// into an empty slot.
installJurisdictionGateTelemetry();
// Same reasoning, and tighter: Home resolves `resolveSendEnabled` in its own
// mount effect, so an effect here would lose the very first report.
installMoneyDoorTelemetry();
// Same reasoning again, and tightest of the three: the balance hooks resolve
// the network on Home's first mount, which is the earliest money-shaped read in
// the app. An effect here would lose exactly the report that matters most.
installNetworkTelemetry();
// Same reasoning once more: `swap.tsx` resolves the fee in its own mount
// effect, so an effect here would lose the first report — and for this one the
// first report is the whole signal, because an unknown fee is silent by
// construction. It renders a placeholder, not an error.
installFeeTelemetry();

export { RootErrorBoundary as ErrorBoundary } from '@/src/features/reliability/RootErrorBoundary';

const { appId, clientId } = requirePrivyEnv();
const mfaRelyingParty = optionalMfaRelyingParty();

// Hold splash until bundled Inter is ready (local assets — no network fetch).
SplashScreen.preventAutoHideAsync().catch(() => {
  /* non-fatal if splash API is unavailable in a given host */
});

function AiConsentSessionBinding() {
  const { session } = useCorsoSession();
  useAiConsentPersistence(session?.address ?? null);
  return null;
}

function RootNavigator({
  fullChartRouteEnabled,
  skillsDirectoryEnabled,
  botsRouteEnabled,
}: {
  fullChartRouteEnabled: boolean;
  skillsDirectoryEnabled: boolean;
  botsRouteEnabled: boolean;
}) {
  const { phase, session } = useCorsoSession();
  const sessionRoutesEnabled = resolveSessionRouteGuard({ phase, session });
  const grokbotRoutesEnabled = readGrokbotRoutesFlag();

  return (
    <>
      {sessionRoutesEnabled ? (
        <RevokeSessionNotice walletAddress={session?.address ?? null} />
      ) : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Protected guard={sessionRoutesEnabled}>
          {/*
            Session-bearing screens are denied by the router before their
            modules mount. `profile` is a nested layout, so this one registration
            covers every current and future `/profile/*` route.
          */}
          <Stack.Screen name="(app)" />
          <Stack.Screen name="ask" options={ASK_SHEET_OPTIONS} />
          <Stack.Protected guard={grokbotRoutesEnabled}>
            <Stack.Screen name="send" />
          </Stack.Protected>
          <Stack.Screen name="activity/[signature]" />
          <Stack.Screen name="asset/[mint]" />
          <Stack.Screen name="sleeve" />
          <Stack.Screen name="buy" />
          <Stack.Screen name="add-cash" />
          <Stack.Screen name="export" />
          <Stack.Protected guard={grokbotRoutesEnabled}>
            <Stack.Screen name="money" />
          </Stack.Protected>
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="ramp/callback" />
          <Stack.Protected guard={grokbotRoutesEnabled}>
            <Stack.Screen name="paper" />
          </Stack.Protected>
          <Stack.Screen name="receive" />
          <Stack.Screen name="swap" />
          <Stack.Screen name="desk-utilities" />
          {/*
            Every other route stays file-registered as before. Only the Vela
            WebView escalation has the additional feature gate, so with
            FLAG_SIGNALS off the route does not exist.
          */}
          <Stack.Protected guard={grokbotRoutesEnabled}>
            <Stack.Protected guard={fullChartRouteEnabled}>
              <Stack.Screen name="chart/[mint]" />
            </Stack.Protected>
          </Stack.Protected>
          <Stack.Protected guard={grokbotRoutesEnabled}>
            <Stack.Protected guard={skillsDirectoryEnabled}>
              <Stack.Screen name="skills/index" />
              <Stack.Screen name="skills/[skillId]" />
              <Stack.Screen name="skills/configure/[skillId]" />
            </Stack.Protected>
          </Stack.Protected>
          <Stack.Screen name="bots/revoke" />
          <Stack.Protected guard={grokbotRoutesEnabled}>
            <Stack.Screen name="bots/[botId]" />
          </Stack.Protected>
          <Stack.Protected guard={grokbotRoutesEnabled}>
            <Stack.Protected guard={botsRouteEnabled}>
              <Stack.Screen name="bots/index" />
            </Stack.Protected>
          </Stack.Protected>
        </Stack.Protected>
      </Stack>
    </>
  );
}

const ASK_SHEET_OPTIONS = {
  presentation: 'transparentModal',
  animation: 'fade',
  contentStyle: { backgroundColor: 'transparent' },
} as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(interFontMap);
  useEffect(() => {
    void retryPriceAlertPushRevocations().catch(() => {});
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active')
        void retryPriceAlertPushRevocations().catch(() => {});
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    eraseDormantAiSignInsAtLaunch();
  }, []);
  const laneGates = useLaneGatesHost();
  const fullChartRouteEnabled = laneGates.gates.fullChart;
  const skillsDirectoryEnabled = laneGates.gates.skills;
  const botsRouteEnabled = laneGates.gates.bots;

  useEffect(() => {
    if (fontsLoaded) {
      installDefaultFont();
    }
    if (fontError) {
      SplashScreen.hideAsync().catch(() => {
        /* non-fatal */
      });
      return;
    }
    if (!fontsLoaded) return;
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {
        /* non-fatal */
      });
    }, BOOT_SPLASH_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [fontsLoaded, fontError]);

  // Block first paint until fonts resolve so UI never flashes system type mid-load.
  // On load failure, continue with platform default rather than hard-crashing.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (fontsLoaded) {
    installDefaultFont();
  }

  return (
    <>
      {/*
        One root StatusBar. Boot spinner, unlock, OTP, buy, receive, import,
        export, the profile children and the ramp callback set none of their
        own, and a void window with Android's default would paint dark glyphs
        that disappear. Destinations that set style="light" themselves still win.
      */}
      <StatusBar style="light" />
      <InkContrastProvider>
        <PrivyProvider
          appId={appId}
          clientId={clientId}
          storage={CorsoPrivyStorage}
          config={{
            embedded: {
              solana: { createOnLogin: 'users-without-wallets' },
            },
            ...(mfaRelyingParty
              ? { mfa: { relyingParty: mfaRelyingParty } }
              : {}),
          }}
        >
          <SessionProvider>
            {/* MFA required listener must stay mounted for wallet-paused step-up. */}
            <PrivyMfaRootListener />
            <AiConsentSessionBinding />
            <PriceAlertTapListener />
            <MaterialBlurTarget
              style={styles.root}
              backdrop={<View style={styles.canvas} />}
            >
              <RootErrorBoundary>
                <MoonPayProvider>
                  <SessionLockBoundary>
                    <RootNavigator
                      fullChartRouteEnabled={fullChartRouteEnabled}
                      skillsDirectoryEnabled={skillsDirectoryEnabled}
                      botsRouteEnabled={botsRouteEnabled}
                    />
                  </SessionLockBoundary>
                </MoonPayProvider>
              </RootErrorBoundary>
            </MaterialBlurTarget>
          </SessionProvider>
        </PrivyProvider>
      </InkContrastProvider>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  canvas: { flex: 1, backgroundColor: colors.canvas },
});
