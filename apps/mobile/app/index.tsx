import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';
import { TextButton } from '@/src/ui/controls/TextButton';
import { BOOT_SPLASH_TIMEOUT_MS } from '@/src/features/session/sessionGate';
import { colors } from '@/constants/theme';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { getSessionDestination } from '@/src/features/session/sessionGate';

/** Root redirect — Welcome when unsigned; lock-setup or Home when signed. */
export default function RootIndex() {
  const { phase, session, needsLockSetup, locked, privyRestoreState, retrySessionRestore } =
    useCorsoSession();

  const destination =
    phase === 'booting'
      ? null
      : getSessionDestination({
          hasSession: Boolean(session),
          needsLockSetup,
          locked,
          restoreState: privyRestoreState,
        });
  const holding = phase === 'booting' || destination === 'restoring';
  const [holdExpired, setHoldExpired] = useState(false);
  useEffect(() => {
    if (!holding) { setHoldExpired(false); return; }
    const timer = setTimeout(() => setHoldExpired(true), BOOT_SPLASH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [holding]);

  useEffect(() => {
    if (holding && !holdExpired) return;
    SplashScreen.hideAsync().catch(() => {
      /* non-fatal */
    });
  }, [holding, holdExpired]);

  if (holding || destination === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: 'center', padding: 24 }}>
        {holdExpired ? <>
          <CorsoText style={{ textAlign: 'center' }}>{copy.provision.takingLong}</CorsoText>
          <TextButton label={copy.signin.errorRetry} onPress={retrySessionRestore} tone="action" />
        </> : null}
      </View>
    );
  }
  if (destination === 'resume') {
    return (
      <Redirect href={{ pathname: '/(auth)/signin', params: { method: 'resume' } }} />
    );
  }
  if (destination === 'lock-setup') return <Redirect href="/(auth)/lock-setup" />;
  if (destination === 'unlock') return <Redirect href="/(auth)/unlock" />;
  if (destination === 'home') return <Redirect href="/(app)" />;
  return <Redirect href="/(auth)/start" />;
}
