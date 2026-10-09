import { View } from 'react-native';
import {
  resolveAccountChrome,
  stepDotStyle,
} from './accountChromePresentation';

export type AccountStepDotsProps = {
  /** How many positions the ceremony genuinely has. */
  count: number;
  /** Zero-based index of the step on screen. */
  index: number;
  testID?: string;
};

export function AccountStepDots({
  count,
  index,
  testID,
}: AccountStepDotsProps) {
  const chrome = resolveAccountChrome();
  const total = Number.isInteger(count) && count > 0 ? count : 0;
  /*
    Resolved to `{id, style}` before the render rather than mapped over an index:
    a dot's identity IS its position, so the id is built where the position is
    known and the JSX never keys off a map index.
  */
  const dots = Array.from({ length: total }, (_unused, position) => ({
    id: `step-${position}`,
    style: stepDotStyle(position <= index),
  }));
  return (
    <View
      style={chrome.stepDotsStyle}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {dots.map((dot) => (
        <View key={dot.id} style={dot.style} />
      ))}
    </View>
  );
}
