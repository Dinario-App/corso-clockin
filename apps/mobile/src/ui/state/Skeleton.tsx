import { View } from 'react-native';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import {
  resolveSkeletonPresentation,
  type SkeletonPreset,
} from '@/src/ui/state/skeletonPresentation.js';

export type SkeletonProps = {
  what: string;
  preset?: SkeletonPreset;
  width?: number;
  height?: number;
  testID?: string;
};

export function Skeleton({
  what,
  preset,
  width,
  height,
  testID,
}: SkeletonProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const presentation = resolveSkeletonPresentation({
    what,
    preset,
    width,
    height,
    reduceMotion,
  });

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={presentation.accessibilityLabel}
      accessibilityState={presentation.accessibilityState}
      style={{
        width: presentation.width,
        height: presentation.height,
        borderRadius: presentation.borderRadius,
        backgroundColor: presentation.backgroundColor,
      }}
    />
  );
}
