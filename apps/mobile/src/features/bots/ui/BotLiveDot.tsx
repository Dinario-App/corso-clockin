import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import { colors } from '@/src/ui/tokens';
import { resolveLiveDot, type BotDotTone } from '../liveDotPresentation';

type Props = {
  tone: BotDotTone;
  testID?: string;
};

const DOT_COLOR = colors.inkTertiary;

export function BotLiveDot({ tone, testID }: Props) {
  const { reduceMotion } = useAccessibilityPreference();
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = resolveLiveDot({ tone, reduceMotion });

  useEffect(() => {
    if (!pulse.enabled) {
      opacity.setValue(pulse.restOpacity);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: pulse.dimOpacity,
          duration: pulse.halfCycleMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: pulse.halfCycleMs,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(pulse.restOpacity);
    };
  }, [
    pulse.enabled,
    pulse.dimOpacity,
    pulse.halfCycleMs,
    pulse.restOpacity,
    opacity,
  ]);

  return (
    <Animated.View
      style={[styles.dot, { backgroundColor: DOT_COLOR, opacity }]}
      accessible={false}
      importantForAccessibility="no"
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: 5, height: 5, borderRadius: 2.5, flexGrow: 0, flexShrink: 0 },
});
