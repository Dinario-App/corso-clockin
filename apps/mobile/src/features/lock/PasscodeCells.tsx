import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { copy } from '@/constants/copy';
import {
  PASSCODE_CELL,
  PASSCODE_LENGTH,
  PASSCODE_SHAKE_STEP_MS,
  resolvePasscodeCellState,
  resolvePasscodeShake,
} from '@/src/features/lock/passcodePadPresentation';
import { resolvePasscodeCellPaint } from '@/src/features/lock/passcodeCellPaint';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import {
  useInkContrastEnabled,
  useOnFloatSheet,
} from '@/src/ui/glass/useInkContrast';

/**
 * Six cells (`passcodePadPresentation.ts`). One accessibility element that
 * reads "2 of 6", never six unlabelled boxes.
 *
 * `shakeToken` is the host saying "that entry was wrong": each change after
 * mount runs one 8pt horizontal shake, or nothing under Reduce Motion. The
 * clearing itself is the host's — this component only draws `filled`.
 */
export function PasscodeCells({
  filled,
  shakeToken = 0,
  testID,
}: {
  filled: number;
  shakeToken?: number;
  testID?: string;
}) {
  const { reduceMotion } = useAccessibilityPreference();
  // Where the cells stand decides their paint, read at render.
  const paint = resolvePasscodeCellPaint({
    onFloatSheet: useOnFloatSheet(),
    increaseContrast: useInkContrastEnabled(),
  });
  const offset = useRef(new Animated.Value(0)).current;
  const seenShake = useRef(shakeToken);

  useEffect(() => {
    if (seenShake.current === shakeToken) return;
    seenShake.current = shakeToken;
    const frames = resolvePasscodeShake(reduceMotion);
    offset.stopAnimation();
    offset.setValue(0);
    if (frames.length === 0) return;
    Animated.sequence(
      frames.map((toValue) =>
        Animated.timing(offset, {
          toValue,
          duration: PASSCODE_SHAKE_STEP_MS,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [offset, reduceMotion, shakeToken]);

  return (
    <Animated.View
      testID={testID}
      style={[styles.row, { transform: [{ translateX: offset }] }]}
      accessible
      accessibilityLabel={copy.v1Onboarding.passcodeCounter(
        filled,
        PASSCODE_LENGTH,
      )}
    >
      {Array.from({ length: PASSCODE_LENGTH }, (_, index) => {
        const state = resolvePasscodeCellState(index, filled);
        return (
          <View
            key={index}
            accessible={false}
            style={[
              styles.cell,
              {
                backgroundColor: paint.fill,
                borderWidth: paint.rimWidth,
                borderColor: paint.rimColor ?? undefined,
              },
              state === 'next'
                ? [styles.cellNext, { borderColor: paint.nextRingColor }]
                : null,
            ]}
          >
            {state === 'filled' ? <View style={styles.dot} /> : null}
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: PASSCODE_CELL.gap,
  },
  cell: {
    width: PASSCODE_CELL.width,
    height: PASSCODE_CELL.height,
    borderRadius: PASSCODE_CELL.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Inset: a border is drawn inside the box, so the cell does not grow. */
  cellNext: {
    borderWidth: PASSCODE_CELL.nextRingWidth,
  },
  dot: {
    width: PASSCODE_CELL.dotSize,
    height: PASSCODE_CELL.dotSize,
    borderRadius: PASSCODE_CELL.dotSize / 2,
    backgroundColor: PASSCODE_CELL.dotColor,
  },
});
