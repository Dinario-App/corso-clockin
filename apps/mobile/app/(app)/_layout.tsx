import { useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { colors } from '@/constants/theme';
import { useAiConsentPersistence } from '@/src/features/aiConsent/aiConsentStore';
import {
  FIRST_RUN_ROUTES,
  isFirstRunPending,
} from '@/src/features/onboarding/firstRunOnboarding';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { getSessionDestination } from '@/src/features/session/sessionGate';
import { useThreadsPersistence } from '@/src/features/threads/threadsStore';
import { MaterialBlurSnapshot } from '@/src/ui/glass/BlurSnapshot';
import { TabBar } from '@/src/ui/navigation/TabBar';
import { readLaunchDockBuildFlag } from '@/src/features/navigation/launchDockEnv';
import { resolveTabRoots } from '@/src/ui/navigation/tabBarPresentation';

export default function AppShellLayout() {
  const { phase, session, needsLockSetup, locked, privyRestoreState } =
    useCorsoSession();
  useThreadsPersistence(session?.address ?? null);
  useAiConsentPersistence(session?.address ?? null);
  const tabScreenSnapshot = useRef<View | null>(null);

  const hold = (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.canvas,
      }}
    >
      <ActivityIndicator color={colors.ink} />
    </View>
  );

  if (phase === 'booting') return hold;

  const destination = getSessionDestination({
    hasSession: Boolean(session),
    needsLockSetup,
    locked,
    restoreState: privyRestoreState,
  });
  if (destination === 'restoring') return hold;
  if (destination === 'resume') {
    return (
      <Redirect href={{ pathname: '/(auth)/signin', params: { method: 'resume' } }} />
    );
  }
  if (destination === 'welcome') return <Redirect href="/(auth)/welcome" />;
  if (destination === 'lock-setup') return <Redirect href="/(auth)/lock-setup" />;
  if (destination === 'unlock') return <Redirect href="/(auth)/unlock" />;
  if (isFirstRunPending()) return <Redirect href={FIRST_RUN_ROUTES.name} />;

  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.canvas }}>
      <MaterialBlurSnapshot
        targetRef={tabScreenSnapshot}
        style={{ flex: 1 }}
        testID="tab-screen-snapshot"
      >
        <TabSlot />
      </MaterialBlurSnapshot>
      {/*
        Headless tabs: the router registers roots from the literal
        `<TabTrigger>` elements inside `<TabList>`. `asChild` hands them to
        our own glass bar, which renders them zero-size and draws the real
        items itself. Order here is thumb order.
      */}
      <TabList asChild>
        <TabBar blurTarget={tabScreenSnapshot}>
          {resolveTabRoots({
            launchDock: readLaunchDockBuildFlag(),
          }).map((root) => (
            <TabTrigger key={root.name} name={root.name} href={root.href} />
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}
