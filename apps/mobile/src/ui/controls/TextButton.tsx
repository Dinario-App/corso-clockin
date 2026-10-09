import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export type TextButtonProps = {
  label: string;
  onPress: NonNullable<PressableProps['onPress']>;
  disabled?: boolean;
  /** `muted` = tertiary door; `ink` = Terms/Privacy inline focus target; `action` = inline card CTA without underline. */
  tone?: 'muted' | 'ink' | 'action';
  /**
   * `control` = own row on the canvas, 58 control height (the door grammar).
   * `inline` = a word inside a running sentence (Terms / Privacy), 44 tap floor.
   */
  size?: 'control' | 'inline';
  accessibilityRole?: 'button' | 'link';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
};

export function TextButton({
  label,
  onPress,
  disabled = false,
  tone = 'muted',
  size = 'control',
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  style,
  labelStyle,
  testID,
}: TextButtonProps) {
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.root,
        size === 'inline' ? styles.inlineRoot : styles.controlRoot,
        pressed && styles.pressedRoot,
        style,
      ]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.label,
            tone === 'ink'
              ? styles.ink
              : tone === 'action'
                ? styles.action
                : styles.muted,
            pressed &&
              (tone === 'action' ? styles.pressedActionLabel : styles.pressedLabel),
            labelStyle,
          ]}
          accessible={false}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.xs,
  },
  /** Own-row door — 58 control height, same canvas rhythm as GlassPill / PrimaryCTA. */
  controlRoot: {
    minHeight: typography.control,
  },
  inlineRoot: {
    minHeight: 44,
  },
  pressedRoot: {
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: typography.caption,
    textAlign: 'center',
  },
  muted: {
    color: colors.muted,
  },
  ink: {
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  action: {
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontWeight: '600',
  },
  pressedLabel: {
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  pressedActionLabel: {
    color: colors.ink,
    fontFamily: typography.face('600'),
    fontWeight: '600',
  },
});
