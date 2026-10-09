import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  ONE_SECOND_VISIBLE_AFTER_MS,
  oneSecondHeadline,
  shouldShowOneSecond,
} from '@/src/features/onboarding/provisioningVisibility';
import { colors, spacing, typography } from '@/src/ui/tokens';

export function OneSecond() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.body}>
        <Text style={styles.headline} accessibilityRole="header">
          {oneSecondHeadline()}
        </Text>
      </View>
    </SafeAreaView>
  );
}

/**
 * Same screen, own clock. Mount it for the whole wait: it holds the void for
 * the first ~600ms and paints the line only if the wait outlives that.
 */
export function OneSecondWhenSlow() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const tick = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(tick);
  }, []);

  if (!shouldShowOneSecond({ working: true, elapsedMs })) {
    return <View style={styles.safe} accessible={false} />;
  }
  return <OneSecond />;
}

export { ONE_SECOND_VISIBLE_AFTER_MS };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  headline: {
    color: colors.ink,
    fontSize: typography.screenTitle,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: -0.6,
  },
});
