import { Text, View } from 'react-native';
import {
  resolveBannerPresentation,
  type BannerTone,
} from '@/src/ui/feedback/bannerPresentation.js';

export type BannerProps = {
  message: string;
  tone?: BannerTone;
  testID?: string;
};

export function Banner({ message, tone = 'info', testID }: BannerProps) {
  const presentation = resolveBannerPresentation(message, tone);

  if (presentation === null) {
    return null;
  }

  return (
    <View
      testID={testID}
      accessible={presentation.accessible}
      role={presentation.role}
      accessibilityLiveRegion={presentation.accessibilityLiveRegion}
      accessibilityLabel={presentation.accessibilityLabel}
      focusable={presentation.focusable}
      style={presentation.containerStyle}
    >
      <Text importantForAccessibility="no" style={presentation.textStyle}>
        {presentation.displayMessage}
      </Text>
    </View>
  );
}
