import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type SwitchProps as NativeSwitchProps,
} from 'react-native';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import {
  SWITCH_HIT_SLOP,
  SWITCH_PAD,
  SWITCH_RIM_WIDTH,
  SWITCH_THUMB,
  SWITCH_THUMB_DURATION_MS,
  SWITCH_THUMB_RADIUS,
  SWITCH_TRACK,
  SWITCH_TRACK_RADIUS,
  resolveSwitchPresentation,
  type SwitchPresentation,
} from '@/src/ui/controls/switchPresentation.js';

export type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onValueChange: NonNullable<NativeSwitchProps['onValueChange']>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

type SwitchBodyProps = Omit<SwitchProps, 'checked' | 'disabled'> & {
  presentation: SwitchPresentation;
};

/**
 * The desk switch, drawn the same on both platforms: RN's native Switch
 * paints a Material thumb on Android, and the capsule is ours.
 */
export function Switch({
  checked,
  disabled = false,
  onValueChange,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: SwitchProps) {
  const presentation = resolveSwitchPresentation({ checked, disabled });

  if (presentation === null) {
    return null;
  }

  return (
    <SwitchBody
      testID={testID}
      presentation={presentation}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    />
  );
}

function SwitchBody({
  presentation,
  onValueChange,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: SwitchBodyProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const offset = useRef(new Animated.Value(presentation.thumbOffset)).current;

  useEffect(() => {
    // Under Reduce Motion the thumb jumps to its side.
    if (reduceMotion) {
      offset.setValue(presentation.thumbOffset);
      return;
    }
    const animation = Animated.timing(offset, {
      toValue: presentation.thumbOffset,
      duration: SWITCH_THUMB_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [offset, presentation.thumbOffset, reduceMotion]);

  return (
    <Pressable
      testID={testID}
      disabled={presentation.disabled}
      onPress={() => {
        void onValueChange(!presentation.value);
      }}
      hitSlop={SWITCH_HIT_SLOP}
      accessibilityRole={presentation.accessibilityRole}
      accessibilityState={presentation.accessibilityState}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[
        styles.track,
        {
          backgroundColor: presentation.trackColor,
          borderColor: presentation.trackRimColor,
          opacity: presentation.opacity,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: presentation.thumbColor,
            boxShadow: [...presentation.thumbShadow],
            transform: [{ translateX: offset }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: SWITCH_TRACK.width,
    height: SWITCH_TRACK.height,
    borderRadius: SWITCH_TRACK_RADIUS,
    // The rim sits inside the inset: rim + padding is the same 2pt.
    borderWidth: SWITCH_RIM_WIDTH,
    padding: SWITCH_PAD - SWITCH_RIM_WIDTH,
    justifyContent: 'center',
  },
  thumb: {
    width: SWITCH_THUMB.width,
    height: SWITCH_THUMB.height,
    borderRadius: SWITCH_THUMB_RADIUS,
  },
});
