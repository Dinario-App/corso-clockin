import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import type { ReadRingCell } from '@/src/features/tokenVitals/readRingCatalog';
import type { SafetyVerdictLevel } from '@/src/features/tokenVitals/types';
import {
  READ_RING_SIZE,
  resolveCentreDotColor,
  resolveCentreDotRadius,
  resolveReadRingArcs,
  resolveReadRingDrawOn,
  type ReadRingPlacement,
} from './readRingPresentation';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function ReadRing({
  cells,
  verdict,
  placement = 'card',
  drawKey,
  children,
  accessibilityLabel,
  testID,
  style,
}: {
  cells: readonly ReadRingCell[];
  /** The server's verdict — the centre dot, and nothing else. */
  verdict: SafetyVerdictLevel;
  placement?: ReadRingPlacement;
  /** Change it and the ring draws on again — a new answer, a new token. */
  drawKey?: string;
  /** The token's own face or ticker well, centred inside the ring. */
  children?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}) {
  const { reduceMotion } = useAccessibilityPreference();
  const plan = useMemo(
    () => resolveReadRingDrawOn({ reduceMotion }),
    [reduceMotion],
  );
  const geometry = READ_RING_SIZE[placement];
  const arcs = useMemo(
    () =>
      resolveReadRingArcs({
        checks: cells.map((cell) => ({
          answered: cell.answered,
          level: cell.level,
        })),
        size: geometry.size,
        stroke: geometry.stroke,
      }),
    [cells, geometry.size, geometry.stroke],
  );

  const progress = useRef(new Animated.Value(plan.animated ? 0 : 1)).current;
  useEffect(() => {
    if (!plan.animated) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const draw = Animated.timing(progress, {
      toValue: 1,
      duration: plan.durationMs,
      /** A stroke dash is not a transform: the JS driver is the only driver. */
      useNativeDriver: false,
    });
    draw.start();
    return () => draw.stop();
  }, [plan, progress, drawKey]);

  const dotColor = resolveCentreDotColor(verdict);
  const dotRadius = resolveCentreDotRadius(geometry.size);
  const centre = geometry.size / 2;

  return (
    <View
      style={[
        styles.wrap,
        { width: geometry.size, height: geometry.size },
        style,
      ]}
      accessible={accessibilityLabel != null}
      accessibilityRole={accessibilityLabel == null ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Svg
        width={geometry.size}
        height={geometry.size}
        viewBox={`0 0 ${geometry.size} ${geometry.size}`}
        style={styles.svg}
        pointerEvents="none"
      >
        {arcs.map((arc) => (
          <AnimatedPath
            key={arc.index}
            d={arc.d}
            stroke={arc.color}
            strokeWidth={arc.strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={arc.length}
            strokeDashoffset={progress.interpolate({
              inputRange: [arc.startFraction, arc.endFraction],
              outputRange: [arc.length, 0],
              extrapolate: 'clamp',
            })}
          />
        ))}
        {dotColor === null || children != null ? null : (
          <Circle cx={centre} cy={centre} r={dotRadius} fill={dotColor} />
        )}
      </Svg>
      {children == null ? null : (
        <View style={styles.inner} pointerEvents="box-none">
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  svg: { position: 'absolute', top: 0, left: 0 },
  inner: { alignItems: 'center', justifyContent: 'center' },
});
