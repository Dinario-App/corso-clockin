import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference';
import {
  resolveCountUpFrame,
  resolveCountUpPresentation,
} from '@/src/ui/motion/countUpPresentation';

export function CountUpMoneyText({
  amount,
  fallbackText,
  style,
  ...textProps
}: {
  amount: string | null;
  fallbackText: string;
  style?: StyleProp<TextStyle>;
} & Omit<TextProps, 'children' | 'style' | 'accessibilityLabel'>) {
  const { reduceMotion } = useAccessibilityPreference();
  const progress = useRef(new Animated.Value(1)).current;
  const resolved = resolveCountUpPresentation({ amount, reduceMotion });
  const finalText = resolved.finalText ?? fallbackText;
  const [frameText, setFrameText] = useState(finalText);

  useEffect(() => {
    progress.stopAnimation();
    if (!resolved.animated) {
      progress.setValue(1);
      setFrameText(finalText);
      return undefined;
    }
    progress.setValue(0);
    setFrameText(resolveCountUpFrame(amount, 0) ?? finalText);
    const listener = progress.addListener(({ value }) => {
      setFrameText(resolveCountUpFrame(amount, value) ?? finalText);
    });
    Animated.timing(progress, {
      toValue: 1,
      duration: resolved.durationMs,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setFrameText(finalText);
    });
    return () => progress.removeListener(listener);
  }, [amount, finalText, progress, resolved.animated, resolved.durationMs]);

  return (
    <CorsoText {...textProps} style={style} accessibilityLabel={finalText}>
      {frameText}
    </CorsoText>
  );
}
