import * as AppleAuthentication from 'expo-apple-authentication';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { CTA_HEIGHT } from '@/src/ui/controls/ctaTonePresentation';

/** The `interFontMap` key for Google Sans Medium. */
export const GOOGLE_LABEL_FACE = 'GoogleSans-Medium';

export const PROVIDER_BUTTON = {
  /** The app's forward-CTA height, so the provider pair sits on the CTA rung. */
  height: CTA_HEIGHT,
  radius: CTA_HEIGHT / 2,
  googleFill: '#131314',
  googleStroke: '#8E918F',
  googleLabel: '#E3E3E3',
  /** The G's 20dp mark sits in a 24dp box of its own ground. */
  googleMark: 24,
} as const;

export function GoogleSignInButton({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
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
      style={({ pressed }) => [
        styles.google,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Image
        source={require('@/assets/brand/vendor/google/google-g-dark.png')}
        style={styles.googleMark}
        accessible={false}
      />
      <Text style={styles.googleLabel}>{label}</Text>
    </Pressable>
  );
}

export function AppleSignInButton({
  onPress,
  testID,
}: {
  onPress: () => void;
  testID?: string;
}) {
  return (
    <AppleAuthentication.AppleAuthenticationButton
      testID={testID}
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={PROVIDER_BUTTON.radius}
      style={styles.apple}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  google: {
    height: PROVIDER_BUTTON.height,
    borderRadius: PROVIDER_BUTTON.radius,
    backgroundColor: PROVIDER_BUTTON.googleFill,
    borderWidth: 1,
    borderColor: PROVIDER_BUTTON.googleStroke,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  googleMark: {
    width: PROVIDER_BUTTON.googleMark,
    height: PROVIDER_BUTTON.googleMark,
  },
  /**
   * Google's custom-button recipe: "The button font is Google Sans Medium",
   * dark theme label `#E3E3E3`
   * (https://developers.google.com/identity/branding-guidelines#font). The face
   * is the UNMODIFIED static `GoogleSans-Medium.ttf` from Google's official
   * release (OFL 1.1; `assets/fonts/GoogleSans-PROVENANCE.txt`), registered as
   * `GoogleSans-Medium` in `interFontMap`. The file IS the medium weight, so no
   * `fontWeight` is set: a numeric weight on a single static face lets the
   * platform synthesise a heavier one. Same face on Android and iOS. The size
   * steps the recipe's 14/20 up to the app's 52 control, as the 20dp G does.
   */
  googleLabel: {
    color: PROVIDER_BUTTON.googleLabel,
    fontSize: 16,
    fontFamily: GOOGLE_LABEL_FACE,
  },
  apple: {
    height: PROVIDER_BUTTON.height,
    width: '100%',
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
