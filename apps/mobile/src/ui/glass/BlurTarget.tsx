import { useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CorsoGlassBlurTarget as BlurTargetView } from './CorsoGlass';
import { BlurTargetContext } from './blurTargetContext';
import {
  hasMaterialBackdrop,
  resolveBlurTargetLayers,
} from './blurTargetPresentation';

export {
  useMaterialBlurTarget,
  type MaterialBlurTargetRef,
} from './blurTargetContext';

export type MaterialBlurTargetProps = {
  backdrop?: ReactNode;
  /** The panes. Drawn over `backdrop`; a `Material` here blurs for real. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Wrap a screen root in this to give every `Material` in `children` a real
 * backdrop blur on Android API >= 31, sampled from `backdrop`.
 */
export function MaterialBlurTarget({
  backdrop,
  children,
  style,
  testID,
}: MaterialBlurTargetProps) {
  const ref = useRef<View | null>(null);
  const layers = resolveBlurTargetLayers({
    hasBackdrop: hasMaterialBackdrop(backdrop),
  });

  /**
   * No snapshot layer means no blur to claim, so no `BlurView` is ever created
   * and there is no target to mount either. `children` keep the caller's box
   * exactly as they had it.
   */
  if (!layers.mountsTarget) {
    return (
      <View style={style} testID={testID}>
        <BlurTargetContext.Provider value={null}>
          {children}
        </BlurTargetContext.Provider>
      </View>
    );
  }

  return (
    <View style={style} testID={testID}>
      {/* The snapshot. Nothing in here may target it — hence the null provider. */}
      <BlurTargetContext.Provider
        value={layers.backdropGetsTarget ? ref : null}
      >
        <BlurTargetView ref={ref} style={styles.snapshot}>
          {backdrop}
        </BlurTargetView>
      </BlurTargetContext.Provider>

      {/* The panes: siblings drawn after the target, never inside it. */}
      <BlurTargetContext.Provider value={layers.panesGetTarget ? ref : null}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {children}
        </View>
      </BlurTargetContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The snapshot layer takes the flow box, not `absoluteFill`. `BlurTarget`
   * clips its recording to `renderNode.setPosition(0, 0, getWidth(), getHeight())`
   * and `RenderNodeBlurController` sizes `blurNode` to the same box, so a target
   * that resolves to its content height silently crops the blur source — which
   * is what an absolutely-positioned `ExpoBlurTargetView` measured to on the
   * Seeker. A flow child of a sized host is always the full host box; the panes
   * take the absolute layer instead.
   */
  snapshot: {
    flexGrow: 1,
  },
});
