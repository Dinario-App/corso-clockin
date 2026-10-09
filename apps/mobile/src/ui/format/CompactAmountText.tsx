import { useState } from 'react';
import {
  Pressable,
  type LayoutChangeEvent,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { copy } from '@/constants/copy';
import { CorsoText } from '@/src/theme/CorsoText';

export function CompactAmountText({
  compactText,
  fullText,
  style,
  accessibilityLabel,
  onLayout,
  numberOfLines = 1,
}: {
  compactText: string;
  fullText: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  numberOfLines?: TextProps['numberOfLines'];
}) {
  const [showFull, setShowFull] = useState(false);
  const canExpand = compactText !== fullText;

  function togglePrecision() {
    if (canExpand) setShowFull((current) => !current);
  }

  if (!canExpand) {
    return (
      <CorsoText
        style={style}
        accessibilityLabel={accessibilityLabel}
        onLayout={onLayout}
        numberOfLines={numberOfLines}
      >
        {compactText}
      </CorsoText>
    );
  }

  return (
    <Pressable
      onPress={togglePrecision}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? fullText}
      accessibilityHint={showFull ? copy.numberCraft.showCompact : copy.numberCraft.showFull}
    >
      <CorsoText style={style} onLayout={onLayout} numberOfLines={numberOfLines}>
        {showFull ? fullText : compactText}
      </CorsoText>
    </Pressable>
  );
}
