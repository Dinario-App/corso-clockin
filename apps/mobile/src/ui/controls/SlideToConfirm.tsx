import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { typography } from '@/src/ui/tokens';
import {
  SLIDE_KNOB_SIZE,
  SLIDE_SNAP_MS,
  SLIDE_TRACK_HEIGHT,
  SLIDE_TRACK_INSET,
  clampSlideOffset,
  resolveSlideToConfirmPresentation,
  resolveSlideTravel,
  slideConfirms,
} from './slideToConfirmPresentation';

export type SlideToConfirmProps = {
  /** The hint inside the track and the accessible name. */
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SlideToConfirm({
  label,
  onConfirm,
  disabled = false,
  busy = false,
  accessibilityLabel,
  style,
  testID,
}: SlideToConfirmProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const presentation = resolveSlideToConfirmPresentation({ disabled, busy });
  const [trackWidth, setTrackWidth] = useState(0);
  const travel = resolveSlideTravel(trackWidth);
  const offset = useRef(new Animated.Value(0)).current;

  // Refs so the responder (created once) always reads the live values.
  const travelRef = useRef(travel);
  travelRef.current = travel;
  const interactiveRef = useRef(presentation.interactive);
  interactiveRef.current = presentation.interactive;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  function snapTo(value: number) {
    offset.stopAnimation();
    if (reduceMotionRef.current) {
      offset.setValue(value);
      return;
    }
    Animated.timing(offset, {
      toValue: value,
      duration: SLIDE_SNAP_MS,
      useNativeDriver: true,
    }).start();
  }

  const snapToRef = useRef(snapTo);
  snapToRef.current = snapTo;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactiveRef.current,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          interactiveRef.current && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => {
          if (!interactiveRef.current) return;
          offset.setValue(clampSlideOffset(gesture.dx, travelRef.current));
        },
        onPanResponderRelease: (_event, gesture) => {
          if (!interactiveRef.current) {
            snapToRef.current(0);
            return;
          }
          const max = travelRef.current;
          if (slideConfirms(gesture.dx, max)) {
            snapToRef.current(max);
            onConfirmRef.current();
            return;
          }
          snapToRef.current(0);
        },
        onPanResponderTerminate: () => snapToRef.current(0),
      }),
    [offset],
  );

  // Busy parks the knob at the end; leaving busy with the control still
  // mounted brings it home for the next attempt.
  useEffect(() => {
    if (busy) {
      snapToRef.current(travelRef.current);
      return;
    }
    snapToRef.current(0);
  }, [busy, travel]);

  function measure(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.width;
    setTrackWidth((current) =>
      Math.abs(current - next) < 1 ? current : next,
    );
  }

  const trailWidth = Animated.add(offset, SLIDE_KNOB_SIZE + SLIDE_TRACK_INSET * 2);
  const isDisabled = !presentation.interactive;

  return (
    <View
      testID={testID}
      style={[
        styles.track,
        {
          backgroundColor: presentation.trackFill,
          borderColor: presentation.trackEdge,
          borderRadius: presentation.radius,
          opacity: presentation.opacity,
        },
        style,
      ]}
      onLayout={measure}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy }}
      accessibilityActions={[{ name: 'activate', label }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName !== 'activate') return;
        if (!interactiveRef.current) return;
        snapToRef.current(travelRef.current);
        onConfirmRef.current();
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.trail,
          {
            backgroundColor: presentation.trailFill,
            borderRadius: presentation.radius,
            width: trailWidth,
          },
        ]}
      />
      <View pointerEvents="none" style={styles.hintBox}>
        <Text
          style={[styles.hint, { color: presentation.hintColor }]}
          numberOfLines={1}
          accessible={false}
        >
          {label}
        </Text>
      </View>
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.knob,
          {
            backgroundColor: presentation.knobFill,
            shadowColor: presentation.knobShadowColor,
            shadowOpacity: presentation.knobShadowOpacity,
            transform: [{ translateX: offset }],
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={presentation.knobGlyph} />
        ) : (
          <Text
            style={[styles.knobGlyph, { color: presentation.knobGlyph }]}
            accessible={false}
          >
            →
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    minHeight: typography.control,
    height: SLIDE_TRACK_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  trail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  hintBox: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: SLIDE_KNOB_SIZE,
  },
  hint: {
    fontSize: 15,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  knob: {
    position: 'absolute',
    top: SLIDE_TRACK_INSET,
    left: SLIDE_TRACK_INSET,
    width: SLIDE_KNOB_SIZE,
    height: SLIDE_KNOB_SIZE,
    borderRadius: SLIDE_KNOB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowRadius: 12,
    shadowOffset: { width: 0, height: SLIDE_TRACK_INSET },
    elevation: 4,
  },
  knobGlyph: {
    fontSize: 20,
    fontFamily: typography.face('600'),
    fontWeight: '600',
  },
});
