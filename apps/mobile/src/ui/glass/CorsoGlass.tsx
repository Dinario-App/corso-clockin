import { createContext, useContext, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { ETHENA_ACCESSIBLE_RIM, ethena } from '@/constants/theme.ethena';
import { useAccessibilityPreference } from '@/src/motion/useAccessibilityPreference.js';
import { ANDROID_BLUR_METHOD } from '@/src/ui/primitives/platformGlassPresentation';
import {
  type MaterialBlurTargetRef,
  useMaterialBlurTarget,
} from './blurTargetContext';
import {
  FLOAT_GLASS_BLUR,
  resolveCorsoGlass,
  resolveCorsoGlassEngine,
  resolveIcyDisc,
  type CorsoGlassEngine,
  type CorsoGlassMaterial,
  type FloatGlassTint,
  type IcyCtaForm,
} from './corsoGlassRecipe';
import { useInkContrastEnabled } from './useInkContrast';

export type {
  CorsoGlassMaterial,
  FloatGlassTint,
} from './corsoGlassRecipe';

/** True inside any refracting CorsoGlass — a nested glass paints solid. */
const InsideGlass = createContext(false);

/** The Android blur target view. Re-exported so no other file imports `expo-blur`. */
export const CorsoGlassBlurTarget = BlurTargetView;

function liquidGlassAvailable(): boolean {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

function useCorsoGlassEngine(material: CorsoGlassMaterial): {
  engine: CorsoGlassEngine;
  blurTarget: MaterialBlurTargetRef | null;
  nested: boolean;
} {
  const { reduceTransparency } = useAccessibilityPreference();
  const blurTarget = useMaterialBlurTarget();
  const nested = useContext(InsideGlass);
  const engine = resolveCorsoGlassEngine({
    material,
    platformOS: Platform.OS,
    platformVersion: Platform.Version,
    liquidGlassAvailable: liquidGlassAvailable(),
    hasBlurTarget: blurTarget !== null,
    reduceTransparency,
    nested,
  });
  return { engine, blurTarget, nested };
}

/**
 * The backdrop alone — for `Material`, which paints its own fill and rim over
 * it. Absolute-fill; draws nothing when the engine is not a refracting one.
 */
export function CorsoGlassBackdrop({
  engine,
  blurTarget,
  tintColor,
}: {
  engine: CorsoGlassEngine;
  blurTarget?: MaterialBlurTargetRef | null;
  /** Liquid Glass takes the float's tint natively. */
  tintColor?: string;
}) {
  if (engine === 'liquid-glass') {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={tintColor}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    );
  }
  if (engine === 'blur') {
    return (
      <BlurView
        intensity={FLOAT_GLASS_BLUR}
        tint="dark"
        blurMethod={ANDROID_BLUR_METHOD}
        blurTarget={blurTarget ?? undefined}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    );
  }
  return null;
}

/**
 * `Material` asks for the engine the same way a CorsoGlass surface does, so
 * the two can never disagree about Liquid Glass or Reduce Transparency.
 */
export function useFloatGlassEngine(): {
  engine: CorsoGlassEngine;
  blurTarget: MaterialBlurTargetRef | null;
} {
  const { engine, blurTarget } = useCorsoGlassEngine('float-glass');
  return { engine, blurTarget };
}

export type CorsoGlassProps = {
  material: CorsoGlassMaterial;
  /** Which measured float fill sits under the blur. Glass materials only. */
  tint?: FloatGlassTint;
  radius: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

/**
 * A surface in one of the four materials. Outer box carries the drop; an inner
 * clip carries the paint; children sit on top. Anything rendered inside a
 * refracting CorsoGlass is told so, and a nested glass paints solid.
 */
export function CorsoGlass({
  material,
  tint,
  radius,
  style,
  children,
  testID,
  pointerEvents,
}: CorsoGlassProps) {
  const recipe = resolveCorsoGlass(material, tint);
  const { engine, blurTarget, nested } = useCorsoGlassEngine(material);
  return (
    <View
      testID={testID}
      pointerEvents={pointerEvents}
      style={[
        {
          borderRadius: radius,
          boxShadow: nested ? undefined : [...recipe.drop],
        },
        style,
      ]}
    >
      <CorsoGlassPaint
        material={material}
        tint={tint}
        radius={radius}
        engine={engine}
        blurTarget={blurTarget}
        nested={nested}
      />
      <InsideGlass.Provider value={nested || recipe.blur > 0}>
        {children}
      </InsideGlass.Provider>
    </View>
  );
}

/**
 * The paint alone, absolute-filling its parent — for a control whose parent is
 * a `Pressable` (a pill, a disc). Same recipe, same engine, same rim.
 */
export function CorsoGlassFill({
  material,
  tint,
  radius,
  form,
  pressed = false,
}: {
  material: CorsoGlassMaterial;
  tint?: FloatGlassTint;
  radius: number;
  /** `'disc'` paints `icy-cta` as the Home icy disc (`resolveIcyDisc`). */
  form?: IcyCtaForm;
  /** The disc form only: lays the pressed veil over the fill. */
  pressed?: boolean;
}) {
  const { engine, blurTarget, nested } = useCorsoGlassEngine(material);
  if (material === 'icy-cta' && form === 'disc')
    return <IcyDiscPaint radius={radius} pressed={pressed} />;
  return (
    <CorsoGlassPaint
      material={material}
      tint={tint}
      radius={radius}
      engine={engine}
      blurTarget={blurTarget}
      nested={nested}
    />
  );
}

/** The drop a `Pressable` host wears when it holds a `CorsoGlassFill`. */
export function corsoGlassDrop(
  material: CorsoGlassMaterial,
): ViewStyle['boxShadow'] {
  const drop = resolveCorsoGlass(material).drop;
  return drop.length > 0 ? [...drop] : undefined;
}

/**
 * The Home icy disc: an opaque underlay, the icy glass over it, the pressed
 * veil when held, and one rim. No gradient and no blur. The rim does not swap
 * under Increase Contrast (see `IcyDiscRecipe.rimColor`).
 */
function IcyDiscPaint({
  radius,
  pressed,
}: {
  radius: number;
  pressed: boolean;
}) {
  const recipe = resolveIcyDisc();
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: [...recipe.inner],
      }}
    >
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: recipe.underlay }]}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: recipe.fill }]}
      />
      {pressed ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: recipe.pressedVeil },
          ]}
        />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: recipe.rimWidth,
            borderColor: recipe.rimColor,
          },
        ]}
      />
    </View>
  );
}

function CorsoGlassPaint({
  material,
  tint,
  radius,
  engine,
  blurTarget,
  nested,
}: {
  material: CorsoGlassMaterial;
  tint?: FloatGlassTint;
  radius: number;
  engine: CorsoGlassEngine;
  blurTarget: MaterialBlurTargetRef | null;
  nested: boolean;
}) {
  const recipe = resolveCorsoGlass(material, tint);
  const increaseContrast = useInkContrastEnabled();
  const rimColor = increaseContrast ? ETHENA_ACCESSIBLE_RIM : recipe.rimColor;
  const rimWidth = increaseContrast
    ? Math.max(1, recipe.rimWidth)
    : recipe.rimWidth;
  const rim =
    rimColor === null ? null : (
      <View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: rimWidth, borderColor: rimColor },
        ]}
      />
    );
  const clip: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius,
    overflow: 'hidden',
    boxShadow: recipe.inner.length > 0 ? [...recipe.inner] : undefined,
  };

  if (Array.isArray(recipe.fill)) {
    const [top, bottom] = recipe.fill as readonly [string, string];
    return (
      <View style={clip} pointerEvents="none">
        <LinearGradient
          colors={[top, bottom]}
          style={StyleSheet.absoluteFill}
        />
        {increaseContrast ? rim : null}
      </View>
    );
  }

  const fill = recipe.fill as string;
  return (
    <View style={clip} pointerEvents="none">
      {/* Solid: the tint over the void is opaque, whatever sits behind. A
          nested glass already has its parent glass behind it. */}
      {engine === 'solid' && !nested ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: ethena.void }]}
        />
      ) : null}
      <CorsoGlassBackdrop
        engine={engine}
        blurTarget={blurTarget}
        tintColor={fill}
      />
      {engine === 'liquid-glass' ? null : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      )}
      {rim}
    </View>
  );
}
