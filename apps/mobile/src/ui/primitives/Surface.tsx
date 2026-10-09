import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  resolveSurfacePresentation,
  type SurfaceFill,
  type SurfaceRadius,
} from '@/src/ui/primitives/surfacePresentation.js';
import { colors } from '@/src/ui/tokens';

export type SurfaceProps = {
  fill?: SurfaceFill;
  /** Corner radius token — `sm` · `md` · `lg` · `pill`. */
  radius?: SurfaceRadius;
  elevated?: false;
  testID?: string;
  children?: ReactNode;
};

export function Surface({
  fill,
  radius,
  elevated = false,
  testID,
  children,
}: SurfaceProps) {
  const presentation = resolveSurfacePresentation({ fill, radius, elevated });

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: presentation.backgroundColor,
        borderRadius: presentation.borderRadius,
        borderWidth: presentation.borderWidth,
        borderColor: presentation.borderColor,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 1,
          left: 1,
          right: 1,
          height: 1,
          backgroundColor: colors.surfaceTopLight,
        }}
      />
      {children}
    </View>
  );
}
