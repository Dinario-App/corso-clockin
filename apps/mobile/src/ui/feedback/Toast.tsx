import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { MOTION_DURATION_MS } from '@/src/motion/motionTokens.js';
import {
  resolveToastPresentation,
  scheduleToastDismiss,
  type ToastTone,
} from '@/src/ui/feedback/toastPresentation.js';

export type ToastProps = {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
  testID?: string;
};

export function Toast({
  message,
  tone = 'neutral',
  onDismiss,
  testID,
}: ToastProps) {
  const presentation = resolveToastPresentation(message, tone);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const normalizedMessage = presentation?.displayMessage ?? null;

  useEffect(() => {
    if (normalizedMessage === null) {
      return;
    }
    return scheduleToastDismiss(MOTION_DURATION_MS.toastHold, () => {
      onDismissRef.current();
    });
  }, [normalizedMessage]);

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
      <Text
        importantForAccessibility="no"
        style={presentation.textStyle}
        numberOfLines={presentation.textLayout.numberOfLines}
        ellipsizeMode={presentation.textLayout.ellipsizeMode}
      >
        {presentation.displayMessage}
      </Text>
    </View>
  );
}
