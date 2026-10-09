import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { usePrivy } from '@privy-io/expo';
import { copy } from '@/constants/copy';
import { ethena } from '@/constants/theme.ethena';
import { useCorsoSession } from '@/src/features/session/SessionContext';
import { RETURNING_DINARIO_NOTE_HREF } from '@/src/features/session/returningDinarioNote';
import { useReturningDinarioNoteGate } from '@/src/features/session/useReturningDinarioNote';
import { LOCKED_GROUND_PARI_BOX } from '@/src/features/lock/lockedGroundPresentation';
import { PariMark } from '@/src/ui/brand/PariMark';

/** The launch frame holds this long before Welcome; a tap skips it. */
const START_SPLASH_HOLD_MS = 1200;

export default function StartScreen() {
  const { phase, session, privyRestoreState, privyReady } = useCorsoSession();
  const { user } = usePrivy();
  const [stage, setStage] = useState<'splash' | 'start'>('splash');

  useEffect(() => {
    if (stage !== 'splash') return;
    const timer = setTimeout(() => setStage('start'), START_SPLASH_HOLD_MS);
    return () => clearTimeout(timer);
  }, [stage]);

  const booting = phase === 'booting' || privyRestoreState === 'pending';
  const signedIn = Boolean(session || (privyReady && user));
  const returningNote = useReturningDinarioNoteGate({ booting, signedIn });

  // After the hold, or at once for a session or a resumable Privy user, the one
  // Welcome screen takes over. It owns every signed-in and resumable branch.
  if (!booting && (stage === 'start' || signedIn)) {
    if (!signedIn && returningNote === 'show') {
      return <Redirect href={RETURNING_DINARIO_NOTE_HREF} />;
    }
    if (signedIn || returningNote === 'skip') {
      return <Redirect href="/(auth)/welcome" />;
    }
  }

  return (
    <Pressable
      testID="start-splash"
      style={styles.launch}
      onPress={booting ? undefined : () => setStage('start')}
      accessibilityRole="image"
      accessibilityLabel={copy.welcome.wordmark}
    >
      <StatusBar style="light" />
      <PariMark testID="start-mark" size={LOCKED_GROUND_PARI_BOX} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** The native splash's ground and centre. Flat: no well, no bloom. */
  launch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ethena.void,
  },
});
