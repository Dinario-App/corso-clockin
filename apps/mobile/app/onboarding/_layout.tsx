import { ActivityIndicator, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { colors } from '@/constants/theme';
import {
  isFirstRunPending,
  resolveFirstRunGate,
} from '@/src/features/onboarding/firstRunOnboarding';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { getSessionDestination } from '@/src/features/session/sessionGate';

export default function FirstRunLayout() {
  const { phase, session, needsLockSetup, locked, privyRestoreState } =
    useCorsoSession();

  const gate = resolveFirstRunGate({
    phase,
    destination: getSessionDestination({
      hasSession: Boolean(session),
      needsLockSetup,
      locked,
      restoreState: privyRestoreState,
    }),
    pending: isFirstRunPending(),
  });

  if (gate === 'hold') {
    return (
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
  }
  if (gate === 'welcome') return <Redirect href="/(auth)/welcome" />;
  if (gate === 'resume') {
    return (
      <Redirect
        href={{ pathname: '/(auth)/signin', params: { method: 'resume' } }}
      />
    );
  }
  if (gate === 'lock-setup') return <Redirect href="/(auth)/lock-setup" />;
  if (gate === 'unlock') return <Redirect href="/(auth)/unlock" />;
  if (gate === 'home') return <Redirect href="/(app)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.canvas },
        animation: 'fade',
      }}
    />
  );
}
