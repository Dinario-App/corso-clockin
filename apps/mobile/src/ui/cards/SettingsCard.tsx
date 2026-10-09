import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import {
  ACCESSIBLE_RIM,
  type MaterialState,
} from '@/src/ui/glass/materialTokens';
import { useInkContrastEnabled } from '@/src/ui/glass/useInkContrast';

/** The pressed read on the ground plane — the dim `MajorDetailCircle` uses. */
const LIFTED_OPACITY = 0.7;

export type SettingsCardProps = {
  children?: ReactNode;
  /** Outer box: margins and width. Radius and clipping belong to the material. */
  style?: StyleProp<ViewStyle>;
  /** Inner box: the padding and gap the old hand-rolled card carried. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Pane-radius override for a card that is deliberately a different band. */
  radius?: number;
  state?: MaterialState;
  testID?: string;
};

export function SettingsCard({
  children,
  style,
  contentStyle,
  radius,
  state,
  testID,
}: SettingsCardProps) {
  const tray = resolveEthenaMaterial('ground');
  const increaseContrast = useInkContrastEnabled();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: tray.fill as string,
          borderWidth: increaseContrast
            ? Math.max(1, tray.borderWidth)
            : tray.borderWidth,
          borderColor: increaseContrast
            ? ACCESSIBLE_RIM
            : (tray.borderColor ?? undefined),
          borderRadius: radius ?? ethenaGeometry.radiusBox,
          overflow: 'hidden',
          opacity: state === 'hi' ? LIFTED_OPACITY : 1,
        },
        style,
      ]}
    >
      <View style={contentStyle}>{children}</View>
    </View>
  );
}
