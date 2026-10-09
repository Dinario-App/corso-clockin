import { View } from 'react-native';
import { resolveGrabberPresentation } from '@/src/ui/primitives/grabberPresentation.js';

export type GrabberProps = {
  testID?: string;
};

export function Grabber({ testID }: GrabberProps) {
  const presentation = resolveGrabberPresentation();

  return (
    <View
      testID={testID}
      accessibilityElementsHidden={presentation.accessibilityElementsHidden}
      importantForAccessibility={presentation.importantForAccessibility}
      style={{
        width: presentation.width,
        height: presentation.height,
        borderRadius: presentation.borderRadius,
        backgroundColor: presentation.backgroundColor,
      }}
    />
  );
}
