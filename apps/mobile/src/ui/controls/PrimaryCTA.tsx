import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { FocusRing } from '@/src/ui/controls/FocusRing.js';
import { CorsoGlassFill, corsoGlassDrop } from '@/src/ui/glass/CorsoGlass';
import {
  CTA_HEIGHT,
  CTA_LABEL_SIZE,
  CTA_LABEL_WEIGHT,
  resolveCtaTonePresentation,
  type CtaTone,
} from '@/src/ui/controls/ctaTonePresentation.js';
import {
  resolveCtaAccessibility,
  type CtaAccessibilityProps,
} from '@/src/ui/controls/ctaAccessibilityPresentation.js';
import { resolveCtaPressPresentation } from '@/src/ui/controls/ctaPressPresentation.js';
import { radii, spacing, typography } from '@/src/ui/tokens';

export type { CtaTone, CtaAccessibilityProps };

export type PrimaryCTAProps = {
  label: string;
  onPress: NonNullable<PressableProps['onPress']>;
  disabled?: boolean;
  busy?: boolean;
  tone?: CtaTone;
  accessibilityLabel?: string;
  accessibility?: CtaAccessibilityProps;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PrimaryCTA({
  label,
  onPress,
  disabled = false,
  busy = false,
  tone = 'neutral',
  accessibilityLabel,
  accessibility,
  style,
  testID,
}: PrimaryCTAProps) {
  const { reduceMotion } = useAccessibilityPreference();
  const [focused, setFocused] = useState(false);
  const isDisabled = disabled || busy;
  const toneStyle = resolveCtaTonePresentation({ tone, disabled: isDisabled });
  const a11y = resolveCtaAccessibility({
    label,
    accessibilityLabel,
    accessibility,
    disabled: isDisabled,
    busy,
  });

  function press(pressed: boolean) {
    return resolveCtaPressPresentation({
      variant: toneStyle.pressVariant,
      reduceMotion,
      pressed: pressed && !isDisabled,
      icy: toneStyle.material !== null,
    });
  }

  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [
        styles.root,
        toneStyle.containerStyle,
        toneStyle.material === null
          ? null
          : { boxShadow: corsoGlassDrop(toneStyle.material) },
        press(pressed).containerStyle,
        style,
      ]}
      disabled={isDisabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...a11y}
    >
      {({ pressed }) => (
        <>
          {toneStyle.material === null ? null : (
            <CorsoGlassFill material={toneStyle.material} radius={radii.cta} />
          )}
          {busy ? (
            <ActivityIndicator color={toneStyle.labelColor} />
          ) : (
            <Text
              style={[
                styles.label,
                { color: toneStyle.labelColor },
                press(pressed).labelStyle,
              ]}
              accessible={false}
            >
              {label}
            </Text>
          )}
          <FocusRing
            focused={focused}
            pressed={pressed}
            disabled={isDisabled}
            radius={radii.cta}
            testID={testID ? `${testID}-focus-ring` : undefined}
          />
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radii.cta,
    height: CTA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: CTA_LABEL_SIZE,
    fontFamily: typography.face(CTA_LABEL_WEIGHT),
    fontWeight: CTA_LABEL_WEIGHT as TextStyle['fontWeight'],
    letterSpacing: -0.15,
  },
});
