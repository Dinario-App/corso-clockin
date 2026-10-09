import { useEffect, type ReactNode } from 'react';
import { Redirect, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LockedGround } from '@/src/features/lock/LockedGround';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { getSensitiveRouteLockAction } from '@/src/features/session/sessionGate';

/** Conceals flat money/detail routes before redirecting a locked session. */
export function SessionLockBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const segments = useSegments();
  const { phase, locked, needsLockSetup } = useCorsoSession();
  const action = getSensitiveRouteLockAction({
    pathname,
    segments,
    phase,
    locked,
    needsLockSetup,
  });

  useEffect(() => {
    if (phase === 'booting' && action === 'render') return;
    SplashScreen.hideAsync().catch(() => {
      /* non-fatal */
    });
  }, [phase, action]);

  if (action === 'conceal') {
    return <LockedGround testID="session-lock-conceal" />;
  }
  if (action === 'lock-setup') {
    return <Redirect href="/(auth)/lock-setup" />;
  }
  if (action === 'unlock') {
    return <Redirect href="/(auth)/unlock" />;
  }
  return children;
}
