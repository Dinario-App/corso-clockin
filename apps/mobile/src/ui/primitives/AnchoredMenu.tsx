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
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { Material } from '@/src/ui/glass/Material.js';
import { FloatSheetInkProvider } from '@/src/ui/glass/useInkContrast';
import { radii } from '@/src/ui/tokens';
import {
  ANCHORED_MENU_SCALE_FROM,
  resolveAnchoredMenuMotion,
  resolveAnchoredMenuPlacement,
  type AnchorRect,
  type AnchoredMenuAlign,
  type AnchoredMenuSide,
} from '@/src/ui/primitives/anchoredMenuPresentation.js';

export type { AnchorRect };

export type AnchoredMenuProps = {
  visible: boolean;
  /**
   * Window-space rect of the control that opened the menu, from
   * `measureInWindow`. `null` until measured — the menu stays unmounted, which
   * is why it can never flash at the wrong place on first open.
   */
  anchor: AnchorRect | null;
  width: number;
  /** Rough content height; only steers the auto side flip. */
  estimatedHeight?: number;
  side?: AnchoredMenuSide | 'auto';
  align?: AnchoredMenuAlign;
  radius?: number;
  onRequestClose: () => void;
  dismissLabel: string;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
};

export function AnchoredMenu({
  visible,
  anchor,
  width,
  estimatedHeight,
  side = 'auto',
  align = 'start',
  radius = radii.pane,
  onRequestClose,
  dismissLabel,
  contentStyle,
  children,
  testID,
}: AnchoredMenuProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const window = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  /** Kept true through the close animation so the exit is seen, not cut. */
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

    return () => {
      animation.stop();
    };
  }, [progress, reduceMotion, visible]);

  const placement =
    anchor === null
      ? null
      : resolveAnchoredMenuPlacement({
          anchor,
          window: { width: window.width, height: window.height },
          width,
          estimatedHeight,
          side,
          align,
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
          <Material weight="menu" radius={radius} contentStyle={contentStyle}>
            <FloatSheetInkProvider onFloatSheet={false}>
              {children}
            </FloatSheetInkProvider>
          </Material>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  catcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pane: { position: 'absolute' },
});
