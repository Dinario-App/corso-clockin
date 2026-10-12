import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { useEthenaMaterial } from '@/src/ui/ethena/useEthenaMaterial';
import { CorsoGlass } from '@/src/ui/glass/CorsoGlass';
import { FloatSheetInkProvider } from '@/src/ui/glass/useInkContrast';
import {
  ANCHORED_MENU_SCALE_FROM,
  resolveAnchoredMenuMotion,
  resolveAnchoredMenuPlacement,
  type AnchorRect,
} from '@/src/ui/primitives/anchoredMenuPresentation.js';

export type { AnchorRect };

export function EthenaAnchoredMenu({
  visible,
  anchor,
  width,
  estimatedHeight,
  onRequestClose,
  dismissLabel,
  contentStyle,
  children,
  testID,
}: {
  visible: boolean;
  anchor: AnchorRect | null;
  width: number;
  estimatedHeight?: number;
  onRequestClose: () => void;
  dismissLabel: string;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
}) {
  const { reduceMotion } = useAccessibilityPreference();
  const window = useWindowDimensions();
  const float = useEthenaMaterial('float');
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    const motion = resolveAnchoredMenuMotion({ visible, reduceMotion });
    progress.stopAnimation();
    if (!motion.animated) {
      progress.setValue(motion.toValue);
      setMounted(visible);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: motion.toValue,
      duration: motion.durationMs,
      easing: Easing.bezier(...motion.easing),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [progress, reduceMotion, visible]);

  const placement =
    anchor === null
      ? null
      : resolveAnchoredMenuPlacement({
          anchor,
          window: { width: window.width, height: window.height },
          width,
          estimatedHeight,
          side: 'auto',
          align: 'start',
        });

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [placement?.translateFrom ?? 0, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [ANCHORED_MENU_SCALE_FROM, 1],
  });

  return (
    <Modal
      visible={mounted && placement !== null}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onRequestClose}
    >
      <Pressable
        style={styles.catcher}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel={dismissLabel}
        testID={testID ? `${testID}-catcher` : undefined}
      />
      {placement === null ? null : (
        <Animated.View
          accessibilityViewIsModal
          testID={testID}
          style={[
            styles.pane,
            {
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
              opacity: progress,
              transformOrigin: placement.transformOrigin,
              transform: [{ translateY }, { scale }],
            },
            placement.top === null ? null : { top: placement.top },
            placement.bottom === null ? null : { bottom: placement.bottom },
          ]}
        >
          <CorsoGlass
            material={float.material}
            tint={float.tint ?? undefined}
            radius={ethenaGeometry.radiusBox}
            style={contentStyle}
          >
            <FloatSheetInkProvider onFloatSheet={false}>
              {children}
            </FloatSheetInkProvider>
          </CorsoGlass>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  catcher: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  pane: {
    position: 'absolute',
    backgroundColor: ethena.void,
    borderRadius: ethenaGeometry.radiusBox,
  },
});
