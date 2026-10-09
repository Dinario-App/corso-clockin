import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { CorsoGlassBackdrop, useFloatGlassEngine } from './CorsoGlass';
import { useIncreaseContrast } from './useIncreaseContrast';
import {
  MATERIAL_RIM_WIDTH,
  ONGLASS,
  gradientVector,
  resolveMaterialPresentation,
  type MaterialState,
  type MaterialWeightName,
} from './materialTokens';

export type MaterialProps = {
  /** Which of the eight weights. `materialTokens.ts` carries the surface map. */
  weight: MaterialWeightName;
  /** `hi` is the lifted read: the user's bubble, the pressed/current card. */
  state?: MaterialState;
  radius?: number;
  interactive?: boolean;
  essentialBoundary?: boolean;
  /**
   * An element nested inside a surface — icon well, control on a surface.
   * It NEVER re-blurs: a flat `ONGLASS` rung only.
   */
  nested?: boolean;
  /** Override the nested wash (`ONGLASS_MID`, `ONGLASS_HI`, a state micro-wash). */
  washColor?: string;
  rimColor?: string;
  /** Hug the children instead of filling the caller's box. */
  hug?: boolean;
  /** Outer style: margins, flex, size. Radius and clipping are the material's. */
  style?: StyleProp<ViewStyle>;
  /** Inner style: padding and layout of the children. */
  contentStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

export function Material({
  weight,
  state = 'rest',
  radius,
  essentialBoundary = false,
  nested = false,
  washColor,
  rimColor,
  hug = false,
  style,
  contentStyle,
  children,
  testID,
  pointerEvents,
}: MaterialProps) {
  const { reduceTransparency } = useAccessibilityPreference();
  const increaseContrast = useIncreaseContrast();
  const { engine, blurTarget } = useFloatGlassEngine();

  const material = resolveMaterialPresentation({
    weight,
    state,
    radius,
    essentialBoundary,
    increaseContrast,
    reduceTransparency,
    hug,
    /** A nested element re-blurring is the first mistake the material names. */
    canBlur: (engine === 'blur' || engine === 'liquid-glass') && !nested,
  });

  /** Increase Contrast outranks a caller's rim; nothing else does. */
  const rim =
    increaseContrast || rimColor === undefined ? material.rimColor : rimColor;

  /**
   * A nested element is a flat rung on the surface that already painted — no
   * second backdrop, no second shadow. Only the rim survives, because an
   * essential boundary still owes 1.4.11 its 3:1.
   */
  if (nested) {
    return (
      <View
        testID={testID}
        pointerEvents={pointerEvents}
        style={[
          styles.clip,
          material.layoutStyle,
          {
            borderRadius: material.borderRadius,
            borderWidth:
              essentialBoundary || increaseContrast || rimColor !== undefined
                ? 1
                : 0,
            borderColor: rim,
            backgroundColor: washColor ?? ONGLASS,
          },
          style,
        ]}
      >
        <View style={[material.layoutStyle, contentStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      pointerEvents={pointerEvents}
      style={[
        { borderRadius: material.borderRadius, boxShadow: material.boxShadow },
        style,
      ]}
    >
      <View
        style={[
          styles.clip,
          material.layoutStyle,
          { borderRadius: material.borderRadius },
          material.opaqueFill === null
            ? null
            : { backgroundColor: material.opaqueFill },
        ]}
      >
        {material.blur ? (
          <CorsoGlassBackdrop
            engine={engine}
            blurTarget={blurTarget}
            tintColor={material.fillColor ?? undefined}
          />
        ) : null}

        {/* Liquid Glass carries the tint natively; a painted fill would hide it. */}
        {material.fillColor === null ||
        (material.blur && engine === 'liquid-glass') ? null : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: material.fillColor },
            ]}
            pointerEvents="none"
          />
        )}

        {material.fillStops.map((layer) => {
          const vector = gradientVector(layer.angle);
          return (
            <LinearGradient
              key={`${layer.angle}-${layer.colors[0]}`}
              colors={layer.colors as [string, string, ...string[]]}
              locations={layer.locations as [number, number, ...number[]]}
              start={vector.start}
              end={vector.end}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          );
        })}

        {material.innerWashColor === null ? null : (
          <LinearGradient
            colors={[material.innerWashColor, 'rgba(255,255,255,0)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.wash, { height: material.innerWashHeight }]}
            pointerEvents="none"
          />
        )}

        {material.edgeTopColor === 'transparent' ? null : (
          <View
            style={[styles.specular, { backgroundColor: material.edgeTopColor }]}
            pointerEvents="none"
          />
        )}

        <View style={[material.layoutStyle, contentStyle]}>{children}</View>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: material.borderRadius,
              borderWidth: MATERIAL_RIM_WIDTH,
              borderColor: rim,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  /** The inner luminosity wash: a soft band down from the top edge. */
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  /** The 1px top edge — `inset 0 1px 0 …`. */
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
});
