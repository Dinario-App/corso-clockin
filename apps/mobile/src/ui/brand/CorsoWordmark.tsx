import { useEffect, useRef } from 'react';
import { Animated, Image, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  CORSO_WORDMARK_BRACKET_PATH,
  CORSO_WORDMARK_BRACKET_STROKE_WIDTH,
  CORSO_WORDMARK_BRACKET_VIEW_BOX,
} from '@/src/ui/brand/corsoMarkSource.js';
import {
  resolveCorsoWordmarkPresentation,
  resolveCursorBlink,
} from '@/src/ui/brand/corsoBrandLockupPresentation.js';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import {
  PARI_NAV_HEIGHT,
  PARI_NAV_WIDTH,
  pariNavLockupSource,
  readBrandPariFlag,
} from '@/src/ui/brand/pariBrandChrome';

export type CorsoWordmarkProps = {
  testID?: string;
  /** Blink the trailing cursor. Reduce Motion always wins. */
  blink?: boolean;
};

export function CorsoWordmark({ testID, blink = false }: CorsoWordmarkProps) {
  if (readBrandPariFlag()) {
    const presentation = resolveCorsoWordmarkPresentation();
    return (
      <Image
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={presentation.accessibilityLabel}
        source={pariNavLockupSource()}
        resizeMode="contain"
        style={{ width: PARI_NAV_WIDTH, height: PARI_NAV_HEIGHT }}
      />
    );
  }
  return <CorsoPromptWordmark testID={testID} blink={blink} />;
}

function CorsoPromptWordmark({ testID, blink = false }: CorsoWordmarkProps) {
  const presentation = resolveCorsoWordmarkPresentation();
  const { reduceMotion } = useAccessibilityPreference();
  const opacity = useRef(new Animated.Value(1)).current;
  const animate = resolveCursorBlink({ blink, reduceMotion });

  useEffect(() => {
    if (!animate.enabled) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: animate.dimOpacity,
          duration: animate.durationMs,
          delay: animate.holdMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: animate.durationMs,
          delay: animate.holdMs,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [
    animate.enabled,
    animate.dimOpacity,
    animate.durationMs,
    animate.holdMs,
    opacity,
  ]);

  return (
    <View
      testID={testID}
      style={presentation.containerStyle}
      accessible
      accessibilityRole="image"
      accessibilityLabel={presentation.accessibilityLabel}
    >
      <Svg
        width={presentation.bracketWidth}
        height={presentation.bracketHeight}
        viewBox={CORSO_WORDMARK_BRACKET_VIEW_BOX}
        accessible={false}
      >
        <Path
          d={CORSO_WORDMARK_BRACKET_PATH}
          fill="none"
          stroke={presentation.inkColor}
          strokeWidth={CORSO_WORDMARK_BRACKET_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={presentation.gapSpacerStyle} accessible={false} />
      <Text
        style={presentation.wordStyle}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {presentation.wordText}
      </Text>
      <Animated.Text
        style={[presentation.cursorStyle, { opacity }]}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {presentation.cursorText}
      </Animated.Text>
    </View>
  );
}
