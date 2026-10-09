import {
  View,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  PARI_MARK_FILL,
  PARI_MARK_PATHS,
  PARI_MARK_VIEW_BOX,
} from '@/src/ui/brand/pariMarkSource';

export function PariMark({
  size,
  testID,
  style,
  accessible,
  accessibilityRole,
  accessibilityLabel,
  accessibilityElementsHidden,
  importantForAccessibility,
}: {
  size: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'auto' | 'no-hide-descendants' | 'yes' | 'no';
}) {
  return (
    <View
      testID={testID}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={accessibilityElementsHidden}
      importantForAccessibility={importantForAccessibility}
      style={[{ width: size, height: size }, style]}
    >
      <Svg
        width={size}
        height={size}
        viewBox={PARI_MARK_VIEW_BOX}
        accessible={false}
      >
        {PARI_MARK_PATHS.map((d) => (
          <Path key={d} d={d} fill={PARI_MARK_FILL} />
        ))}
      </Svg>
    </View>
  );
}
