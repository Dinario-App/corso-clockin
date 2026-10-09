import {
  Pressable,
  Text,
  type PressableProps,
} from 'react-native';
import type { PublicAppConfig } from '@/src/lib/apiConfig';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import {
  resolveClusterChipPresentation,
} from '@/src/ui/controls/clusterChipPresentation.js';

export type ClusterChipProps = {
  cluster: PublicAppConfig['cluster'];
  onPress: NonNullable<PressableProps['onPress']>;
  testID?: string;
};

export function ClusterChip({
  cluster,
  onPress,
  testID,
}: ClusterChipProps) {
  const presentation = resolveClusterChipPresentation({ cluster });

  if (presentation === null) {
    return null;
  }

  return (
    <Pressable
      testID={testID}
      hitSlop={presentation.hitSlop}
      style={presentation.containerStyle}
      onPress={onPress}
      accessibilityRole={presentation.accessibilityRole}
      accessibilityLabel={presentation.accessibilityLabel}
    >
      <Text style={presentation.labelStyle} accessible={false}>
        {presentation.displayLabel}
      </Text>
      <CorsoIcon
        name={presentation.chevronGlyph}
        size={presentation.chevronSize}
        color={presentation.chevronColor}
      />
    </Pressable>
  );
}
