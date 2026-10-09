import { Pressable, View } from 'react-native';
import { CorsoText } from '@/src/theme/CorsoText';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';

export const ETHENA_DOOR_ROW_HEIGHT = 56;

export function EthenaDoorRow({
  label,
  onPress,
  disabled = false,
  first = false,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** The first row carries no hairline above it. */
  first?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={{
        minHeight: ETHENA_DOOR_ROW_HEIGHT,
        paddingHorizontal: ethenaGeometry.pad,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        columnGap: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: ethena.hair,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <CorsoText
        style={{ ...ETHENA_TYPE.rowName, color: ethena.ink.primary, flex: 1 }}
      >
        {label}
      </CorsoText>
      <View accessible={false}>
        <CorsoText
          style={{ ...ETHENA_TYPE.quickGlyph, color: ethena.ink.tertiary }}
        >
          ›
        </CorsoText>
      </View>
    </Pressable>
  );
}
