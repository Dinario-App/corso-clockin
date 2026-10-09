import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radii } from '@/src/ui/tokens';
import { FocusRing } from '@/src/ui/controls/FocusRing.js';
import { resolveDisabledPaint } from '@/src/ui/controls/disabledPresentation.js';
import {
  PILL_GAP,
  PILL_HEIGHTS,
  PILL_PAD_H,
  resolvePillPresentation,
  type PillSize,
} from '@/src/ui/controls/pillPresentation.js';
import { Material } from '@/src/ui/glass/Material.js';
import { resolvePlatformGlassPresentation } from '@/src/ui/primitives/platformGlassPresentation';

/** Resolved once at module load — the platform does not change under the app. */
const glass = resolvePlatformGlassPresentation(Platform.OS);

export type GlassPillProps = {
  label: string;
  onPress: NonNullable<PressableProps['onPress']>;
  disabled?: boolean;
  size?: PillSize;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function GlassPill({
  label,
  onPress,
  disabled = false,
  size = 'md',
  accessibilityLabel,
  style,
  testID,
}: GlassPillProps) {
  const [focused, setFocused] = useState(false);
  const presentation = resolvePillPresentation({
    variant: 'quickAction',
    size,
    disabled,
  });
  const labelColor = disabled
    ? resolveDisabledPaint('pill').label
    : presentation.labelStyle.color;

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      hitSlop={presentation.hitSlop}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      android_ripple={disabled ? undefined : glass.ripple}
      style={[
        styles.root,
        {
          height: PILL_HEIGHTS[size],
          paddingHorizontal: PILL_PAD_H[size],
          gap: PILL_GAP,
        },
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          <Material
            weight="pill"
            state={pressed && !disabled ? 'hi' : presentation.state}
            radius={radii.pill}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Text
            style={[presentation.labelStyle, { color: labelColor }]}
            accessible={false}
          >
            {label}
          </Text>
          <FocusRing
            focused={focused}
            pressed={pressed}
            disabled={disabled}
            radius={radii.pill}
            testID={testID ? `${testID}-focus-ring` : undefined}
          />
        </>
      )}
    </Pressable>
  );
}

export const glassControlStyle = {
  backgroundColor: colors.surface,
  borderWidth: 0.5,
  borderColor: glass.stroke.rest,
} as const;

const styles = StyleSheet.create({
  root: {
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
