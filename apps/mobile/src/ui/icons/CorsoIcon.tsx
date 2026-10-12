
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/theme';
import {
  CORSO_ICON_NAMES,
  type CorsoIconName,
} from '@/src/ui/icons/corsoIconNames';
import { PHOSPHOR_REGULAR } from '@/src/ui/icons/phosphorRegular';

export type CorsoIconProps = {
  name: CorsoIconName;
  size?: number;
  /** Tint — ink on light surfaces; canvas/white on the dark tab bar. */
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
  /** Accessibility — prefer labeling the parent control; optional here. */
  accessibilityLabel?: string;
};

/** The Phosphor path for a name, or `null` when the name is not in the set. */
export function corsoIconPath(name: CorsoIconName): string | null {
  const phosphor = CORSO_ICON_NAMES[name];
  return phosphor == null ? null : PHOSPHOR_REGULAR[phosphor];
}

/**
 * Fixed-size monochrome glyph. Layout box is always `size`×`size` so
 * tab/quick-action circles do not jump. An unknown name draws an empty box.
 */
export function CorsoIcon({
  name,
  size = 22,
  color = colors.ink,
  style,
  accessibilityLabel,
}: CorsoIconProps) {
  const d = corsoIconPath(name);
  const boxStyle: ViewStyle = { width: size, height: size };

  return (
    <View
      style={[boxStyle, style]}
      accessibilityElementsHidden={accessibilityLabel == null}
      importantForAccessibility={
        accessibilityLabel == null ? 'no-hide-descendants' : 'yes'
      }
      accessibilityLabel={accessibilityLabel}
    >
      {d == null ? null : (
        <Svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
          <Path d={d} />
        </Svg>
      )}
    </View>
  );
}
