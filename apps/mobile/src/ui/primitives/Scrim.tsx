import { View } from 'react-native';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { resolveScrimPresentation } from '@/src/ui/primitives/scrimPresentation.js';

export type ScrimProps = {
  testID?: string;
};

export function Scrim({ testID }: ScrimProps) {
  const { reduceTransparency } = useAccessibilityPreference();
  const presentation = resolveScrimPresentation({ reduceTransparency });

  return (
    <View
      testID={testID}
      pointerEvents={presentation.pointerEvents}
      accessibilityElementsHidden={presentation.accessibilityElementsHidden}
      importantForAccessibility={presentation.importantForAccessibility}
      style={{
        position: presentation.position,
        top: presentation.top,
        left: presentation.left,
        right: presentation.right,
        bottom: presentation.bottom,
        backgroundColor: presentation.backgroundColor,
        opacity: presentation.opacity,
      }}
    />
  );
}
