import { View } from 'react-native';
import { resolveFocusRingPresentation } from '@/src/ui/controls/focusRingPresentation.js';

export type FocusRingProps = {
  /** The control has focus (`onFocus` fired, `onBlur` has not). */
  focused: boolean;
  pressed?: boolean;
  disabled?: boolean;
  /** The control's own radius; the ring stays concentric two points outside it. */
  radius?: number;
  testID?: string;
};

export function FocusRing({
  focused,
  pressed,
  disabled,
  radius,
  testID,
}: FocusRingProps) {
  const ring = resolveFocusRingPresentation({
    focused,
    pressed,
    disabled,
    radius,
  });
  if (!ring.visible) return null;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={ring.ringStyle}
    />
  );
}
