import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { colors, radii } from '@/src/ui/tokens';
import { Lens } from './Lens';
import {
  VOICE_BAR_GAP,
  VOICE_BAR_WIDTH,
  resolveVoiceDiscPresentation,
} from './voiceDiscPresentation';

export type VoiceDiscProps = {
  listening: boolean;
  /** Absent = decorative (the Talk 3 ghost floor). */
  onPress?: () => void;
  testID?: string;
};

const BREATH_MS = 420;

/**
 * Voice disc — five ink bars in a Dark lens, right of Ask. Voice transcribes
 * into Ask and sends; it never signs and never skips Review. The bars breathe
 * while listening unless Reduce Motion asks them not to.
 */
export function VoiceDisc({ listening, onPress, testID }: VoiceDiscProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const disc = resolveVoiceDiscPresentation({ listening, reduceMotion });
  const breath = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    breath.stopAnimation();
    if (!disc.animate) {
      breath.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 0.55,
          duration: BREATH_MS,
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATH_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, disc.animate]);

  const bars = (
    <View style={styles.bars} pointerEvents="none">
      {disc.barHeights.map((height, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height,
              transform: [{ scaleY: index % 2 === 0 ? breath : Animated.subtract(1.55, breath) }],
            },
          ]}
        />
      ))}
    </View>
  );

  const lens = (
    <Lens
      radius={radii.pill}
      edgeColor={disc.edgeColor}
      style={{ width: disc.size, height: disc.size }}
      contentStyle={styles.center}
      pointerEvents="none"
    >
      {bars}
    </Lens>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessible={false}>
        {lens}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={disc.accessibilityLabel}
      accessibilityState={disc.accessibilityState}
      hitSlop={4}
    >
      {lens}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VOICE_BAR_GAP,
  },
  bar: {
    width: VOICE_BAR_WIDTH,
    borderRadius: 2,
    backgroundColor: colors.ink,
  },
});
