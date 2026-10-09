import { SymbolView } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { colors } from '@/constants/theme';
import {
  CORSO_ICON_NAMES,
  type CorsoIconName,
} from '@/src/ui/icons/corsoIconNames';

export type CorsoIconProps = {
  name: CorsoIconName;
  size?: number;
  /** Tint — ink on light surfaces; canvas/white on the dark tab bar. */
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
  /** Accessibility — prefer labeling the parent control; optional here. */
  accessibilityLabel?: string;
};

/**
 * Fixed-size monochrome symbol. Layout box is always `size`×`size` so
 * tab/quick-action circles do not jump while fonts load on Android.
 */
export function CorsoIcon({
  name,
  size = 22,
  color = colors.ink,
  style,
  accessibilityLabel,
}: CorsoIconProps) {
  const platformNames = CORSO_ICON_NAMES[name];
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
      <SymbolView
        name={{
          ios: platformNames.ios as never,
          android: platformNames.android as never,
          web: platformNames.web as never,
        }}
        size={size}
        tintColor={color}
        type="monochrome"
        weight="regular"
        style={boxStyle}
        fallback={<View style={boxStyle} />}
      />
    </View>
  );
}
