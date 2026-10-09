import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CorsoGlassFill, corsoGlassDrop } from '@/src/ui/glass/CorsoGlass';
import { typography } from '@/src/ui/tokens';
import {
  ICY_CTA,
  QUIET_MUTE,
  QUIET_ON_ICY,
  QUIET_SECONDARY,
  type IcyCtaSize,
} from './quietMarkPresentation';

type QuietButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function IcyCta({
  label,
  onPress,
  disabled = false,
  size = 'step',
  accessibilityLabel,
  testID,
  style,
}: QuietButtonProps & { size?: IcyCtaSize }) {
  const cta = ICY_CTA[size];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          height: cta.height,
          borderRadius: cta.radius,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: corsoGlassDrop('icy-cta'),
        },
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <CorsoGlassFill material="icy-cta" radius={cta.radius} />
      <Text style={[styles.icyLabel, { fontSize: cta.labelSize }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QuietSecondary({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: QuietButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.secondary,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icyLabel: {
    color: QUIET_ON_ICY,
    fontFamily: typography.face('600'),
    fontWeight: '600',
    textAlign: 'center',
  },
  secondary: {
    height: QUIET_SECONDARY.height,
    borderRadius: QUIET_SECONDARY.radius,
    backgroundColor: QUIET_SECONDARY.fill,
    borderWidth: 1,
    borderColor: QUIET_SECONDARY.edge,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 1,
        color: 'rgba(255, 255, 255, 0.05)',
        inset: true,
      },
    ],
  },
  secondaryLabel: {
    color: QUIET_MUTE,
    fontSize: QUIET_SECONDARY.labelSize,
    fontFamily: typography.face('500'),
    fontWeight: '500',
    textAlign: 'center',
  },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.58 },
});
