import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { CorsoGlassBlurTarget as BlurTargetView } from './CorsoGlass';
import type { MaterialBlurTargetRef } from './blurTargetContext';

export function MaterialBlurSnapshot({
  targetRef,
  children,
  style,
  testID,
}: {
  targetRef: MaterialBlurTargetRef;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <BlurTargetView ref={targetRef} style={style} testID={testID}>
      {children}
    </BlurTargetView>
  );
}

