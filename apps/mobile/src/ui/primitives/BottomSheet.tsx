import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { copy } from '@/constants/copy';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { Material } from '@/src/ui/glass/Material.js';
import {
  FloatSheetInkProvider,
  useInkContrastEnabled,
} from '@/src/ui/glass/useInkContrast';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import { Grabber } from '@/src/ui/primitives/Grabber.js';
import { Scrim } from '@/src/ui/primitives/Scrim.js';
import { ScrollEdgeFade } from '@/src/ui/primitives/ScrollEdgeFade.js';
import {
  BOTTOM_SHEET_TOP_RADIUS,
  resolveBottomSheetBodyFadeTop,
  resolveBottomSheetPresentation,
  resolveBottomSheetTopEdge,
  type BottomSheetKind,
  type BottomSheetSurface,
} from '@/src/ui/primitives/bottomSheetPresentation.js';
import { resolveKeyboardAvoidanceBehavior } from '@/src/ui/primitives/keyboardAvoidancePresentation.js';
import {
  SHEET_SPRING,
  SHEET_SPRING_OFFSET,
  resolveSheetSpringPresentation,
} from '@/src/ui/motion/sheetSpringPresentation.js';
import { colors } from '@/src/ui/tokens';

export type BottomSheetProps = {
  title: string;
  visible: boolean;
  dismissible: boolean;
  signing: boolean;
  kind?: BottomSheetKind;
  surface?: BottomSheetSurface;
  closeButton?: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
};

function SheetSurface({
  visible,
  opaque,
  liftsQuietInk,
  style,
  testID,
  children,
}: {
  visible: boolean;
  /** An opaque ground draws its own top edge; `frost` leaves it to the weight. */
  opaque: boolean;
  /** The float ground: text under it draws Ethena tertiary one rung up. */
  liftsQuietInk: boolean;
  style: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}) {
  const { reduceMotion } = useAccessibilityPreference();
  /** Increase Contrast lifts the top edge; the root provider owns the read. */
  const increaseContrast = useInkContrastEnabled();
  const spring = resolveSheetSpringPresentation({ visible, reduceMotion });
  const progress = useRef(new Animated.Value(spring.startProgress)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (!spring.animated) {
      progress.setValue(0);
      return;
    }
    progress.setValue(1);
    Animated.spring(progress, {
      toValue: 0,
      ...SHEET_SPRING,
      useNativeDriver: true,
    }).start();
  }, [progress, spring.animated, visible]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SHEET_SPRING_OFFSET],
  });

  return (
    <Animated.View
      testID={testID}
      style={[
        style,
        opaque && increaseContrast ? resolveBottomSheetTopEdge(true) : null,
        { transform: [{ translateY }] },
      ]}
    >
      <FloatSheetInkProvider onFloatSheet={liftsQuietInk}>
        {children}
      </FloatSheetInkProvider>
    </Animated.View>
  );
}

export type SheetBodyProps = {
  wrapStyle: StyleProp<ViewStyle>;
  bodyStyle: StyleProp<ViewStyle>;
  fadeColor: string;
  fadeTestID?: string;
  children: ReactNode;
};

export function renderSheetBody(
  props: SheetBodyProps & {
    fadeTop: number;
    onScrollY: (y: number) => void;
  },
) {
  return (
    <View style={props.wrapStyle}>
      <ScrollView
        style={props.bodyStyle}
        bounces={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => props.onScrollY(event.nativeEvent.contentOffset.y)}
      >
        {props.children}
      </ScrollView>
      <ScrollEdgeFade
        top={props.fadeTop}
        color={props.fadeColor}
        testID={props.fadeTestID}
      />
    </View>
  );
}

function SheetBody(props: SheetBodyProps) {
  const [fadeTop, setFadeTop] = useState(0);
  return renderSheetBody({
    ...props,
    fadeTop,
    onScrollY: (y) => {
      const next = resolveBottomSheetBodyFadeTop(y);
      setFadeTop((prev) => (prev === next ? prev : next));
    },
  });
}

export function BottomSheet(props: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const presentation = resolveBottomSheetPresentation({
    ...props,
    safeAreaBottomInset: insets.bottom,
  });

  function requestClose() {
    if (presentation.effectiveDismissible) {
      props.onRequestClose();
    }
  }

  const title = (
    <Text
      accessibilityRole="header"
      accessibilityLabel={presentation.accessibleName}
      style={presentation.titleStyle}
    >
      {presentation.title}
    </Text>
  );

  return (
    <Modal
      visible={presentation.visible}
      transparent={presentation.modalTransparent}
      animationType={presentation.modalAnimationType}
      presentationStyle={presentation.modalPresentationStyle}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <KeyboardAvoidingView
        testID={props.testID}
        style={presentation.backdropStyle}
        behavior={resolveKeyboardAvoidanceBehavior(Platform.OS)}
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        <SheetSurface
          visible={presentation.visible}
          opaque={presentation.backgroundColor !== null}
          liftsQuietInk={presentation.liftsQuietInk}
          testID={props.testID ? `${props.testID}-sheet` : undefined}
          style={presentation.sheetStyle}
        >
          {presentation.material === 'frost' ? (
            <Material
              weight="frost"
              radius={BOTTOM_SHEET_TOP_RADIUS}
              pointerEvents="none"
              style={presentation.frostBackdropStyle}
              testID={props.testID ? `${props.testID}-frost` : undefined}
            />
          ) : (
            <View pointerEvents="none" style={styles.innerTopLight} />
          )}
          <View style={presentation.headerStyle}>
            <Grabber testID={props.testID ? `${props.testID}-grabber` : undefined} />
            {presentation.closeButton ? (
              <View style={presentation.closeButton.rowStyle}>
                {title}
                <Pressable
                  testID={props.testID ? `${props.testID}-close` : undefined}
                  onPress={requestClose}
                  disabled={!presentation.effectiveDismissible}
                  accessibilityRole="button"
                  accessibilityLabel={presentation.closeButton.accessibilityLabel}
                  accessibilityState={{
                    disabled: !presentation.effectiveDismissible,
                  }}
                  style={({ pressed }) => [
                    presentation.closeButton?.circleStyle,
                    pressed
                      ? { backgroundColor: presentation.closeButton?.pressedFill }
                      : null,
                    presentation.effectiveDismissible ? null : { opacity: 0.4 },
                  ]}
                >
                  <CorsoIcon
                    name="close"
                    size={presentation.closeButton.glyphSize}
                    color={presentation.closeButton.glyphColor}
                  />
                </Pressable>
              </View>
            ) : (
              title
            )}
          </View>
          <SheetBody
            wrapStyle={presentation.bodyWrapStyle}
            bodyStyle={presentation.bodyStyle}
            fadeColor={presentation.bodyFadeColor}
            fadeTestID={
              props.testID ? `${props.testID}-scroll-fade` : undefined
            }
          >
            {props.children}
          </SheetBody>
          {props.footer ?? null}
        </SheetSurface>
        <Pressable
          testID={props.testID ? `${props.testID}-scrim-dismiss` : undefined}
          accessibilityElementsHidden={!presentation.effectiveDismissible}
          accessibilityLabel={
            presentation.effectiveDismissible
              ? copy.v1.dismissSheet(presentation.title)
              : undefined
          }
          accessibilityRole={presentation.effectiveDismissible ? 'button' : undefined}
          importantForAccessibility={
            presentation.effectiveDismissible ? 'yes' : 'no-hide-descendants'
          }
          disabled={!presentation.effectiveDismissible}
          onPress={requestClose}
          style={presentation.scrimDismissStyle}
        >
          {presentation.showsScrim ? (
            <Scrim testID={props.testID ? `${props.testID}-scrim` : undefined} />
          ) : null}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = {
  innerTopLight: {
    position: 'absolute' as const,
    top: 1,
    left: 1,
    right: 1,
    height: 1,
    backgroundColor: colors.surfaceTopLight,
  },
};
