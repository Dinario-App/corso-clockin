import type { Ref } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { Material } from '@/src/ui/glass/Material';
import { CorsoIcon } from '@/src/ui/icons/CorsoIcon';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';
import { elevationSoftViewStyle } from '@/src/ui/tokens';
import { resolveDisabledPaint } from '@/src/ui/controls/disabledPresentation.js';
import {
  resolveIconCircleButtonPresentation,
  type IconCircleButtonBadge,
  type IconCircleButtonFill,
  type IconCircleVariant,
} from '@/src/ui/controls/iconCircleButtonPresentation.js';

export type IconCircleButtonProps = {
  glyph: CorsoIconName;
  onPress: NonNullable<PressableProps['onPress']>;
  accessibilityLabel: string;
  disabled?: boolean;
  fill?: IconCircleButtonFill;
  badge?: IconCircleButtonBadge;
  variant?: IconCircleVariant;
  testID?: string;
  ref?: Ref<View>;
};

export function IconCircleButton({
  glyph,
  onPress,
  accessibilityLabel,
  disabled = false,
  fill = 'canvas',
  badge = 'none',
  variant = 'ground',
  testID,
  ref,
}: IconCircleButtonProps) {
  const presentation = resolveIconCircleButtonPresentation({
    glyph,
    fill,
    badge,
    variant,
    disabled,
    accessibilityLabel,
  });

  if (presentation === null) {
    return null;
  }

  const glyphColor = disabled
    ? resolveDisabledPaint('circle').glyph
    : presentation.glyphColor;

  const contents = (
    <>
      <CorsoIcon
        name={presentation.glyph}
        size={presentation.glyphSize}
        color={glyphColor}
      />
      {presentation.badgeVisible ? (
        <View style={presentation.badgeStyle} accessible={false} />
      ) : null}
    </>
  );

  return (
    <Pressable
      ref={ref}
      testID={testID}
      hitSlop={presentation.hitSlop}
      style={presentation.containerStyle}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={presentation.accessibilityRole}
      accessibilityLabel={presentation.accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      {({ pressed }) =>
        presentation.material !== null ? (
          <Material
            weight="pill"
            state={pressed && !disabled ? 'hi' : presentation.materialState}
            radius={presentation.radius}
            hug
            contentStyle={presentation.circleStyle}
            style={presentation.containerStyle}
            pointerEvents="none"
          >
            {contents}
          </Material>
        ) : (
          <View
            style={[
              presentation.circleStyle,
              {
                backgroundColor: presentation.backgroundColor ?? undefined,
                borderRadius: presentation.radius,
              },
              presentation.elevated ? elevationSoftViewStyle : null,
            ]}
            pointerEvents="none"
          >
            {contents}
          </View>
        )
      }
    </Pressable>
  );
}
