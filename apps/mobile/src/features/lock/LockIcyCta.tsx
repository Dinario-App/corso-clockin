import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { resolveCtaAccessibility } from '@/src/ui/controls/ctaAccessibilityPresentation';
import { CorsoGlassFill, corsoGlassDrop } from '@/src/ui/glass/CorsoGlass';

export function LockIcyCta({
  label,
  onPress,
  disabled = false,
  busy = false,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const isDisabled = disabled || busy;
  const a11y = resolveCtaAccessibility({
    label,
    accessibilityLabel,
    disabled: isDisabled,
    busy,
  });
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      {...a11y}
      style={({ pressed }) => ({
        height: ethenaGeometry.pillHeight,
        borderRadius: ethenaGeometry.radiusBox,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: corsoGlassDrop('icy-cta'),
        opacity: isDisabled ? 0.58 : pressed ? 0.82 : 1,
      })}
    >
      <CorsoGlassFill material="icy-cta" radius={ethenaGeometry.radiusBox} />
      <View pointerEvents="none">
        {busy ? (
          <ActivityIndicator color={ethena.onIcy} />
        ) : (
          <Text
            accessible={false}
            style={{
              ...ETHENA_TYPE.keyValueTotal,
              color: ethena.onIcy,
              textAlign: 'center',
            }}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
