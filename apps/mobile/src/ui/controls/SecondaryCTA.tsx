import {
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GlassPill } from '@/src/ui/controls/GlassPill.js';
import { spacing } from '@/src/ui/tokens';

export type SecondaryCTAProps = {
  label: string;
  onPress: NonNullable<PressableProps['onPress']>;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SecondaryCTA({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: SecondaryCTAProps) {
  return (
    <GlassPill
      size="lg"
      label={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      style={[styles.root, style]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  // Single-sided spacing: previous sibling owns the gap (avoids 8+16 stack).
  root: { marginBottom: spacing.sm },
});
