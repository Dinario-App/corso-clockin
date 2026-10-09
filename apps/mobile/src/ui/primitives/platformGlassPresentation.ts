import { colors } from '@/src/ui/tokens';

export type PlatformGlassImplementation = 'blur' | 'tint';

/** The four reads a glass control has. Closed on purpose — the ladder is pinned. */
export type PlatformGlassState = 'rest' | 'pressed' | 'selected' | 'disabled';

export type PlatformGlassLadder = Readonly<Record<PlatformGlassState, string>>;

export type PlatformGlassRipple = Readonly<{
  color: string;
  foreground: boolean;
}>;

export const ANDROID_GLASS_FILL: PlatformGlassLadder = Object.freeze({
  rest: colors.surface,
  pressed: colors.glassFillPressed,
  selected: colors.surface,
  disabled: colors.surface,
});

export const ANDROID_GLASS_STROKE: PlatformGlassLadder = Object.freeze({
  rest: colors.surfaceStroke,
  pressed: colors.glassStrokePressed,
  selected: colors.glassStrokePressed,
  disabled: colors.glassStrokeDisabled,
});

/**
 * iOS glass answers a touch by refracting. Android has no refraction to offer, so
 * it answers with an ink ripple, which is native to the platform and costs nothing.
 */
export const ANDROID_GLASS_RIPPLE: PlatformGlassRipple = Object.freeze({
  color: 'rgba(244, 241, 236, 0.12)',
  foreground: true,
});

const IOS_GLASS_FILL: PlatformGlassLadder = Object.freeze({
  rest: colors.surface,
  pressed: colors.glassFillPressed,
  selected: colors.surface,
  disabled: colors.surface,
});

const IOS_GLASS_STROKE: PlatformGlassLadder = Object.freeze({
  rest: colors.glassStroke,
  pressed: colors.glassStrokePressed,
  /** iOS has no selected-stroke token; pressed stands in until one ships. */
  selected: colors.glassStrokePressed,
  disabled: colors.glassStrokeDisabled,
});

export const ANDROID_BLUR_MIN_API = 31;
export const ANDROID_BLUR_METHOD = 'dimezisBlurViewSdk31Plus' as const;

export function resolveGlassBackdrop(input: {
  platformOS: unknown;
  /** `Platform.Version` on Android. Ignored elsewhere. */
  apiLevel?: number;
  /** A `MaterialBlurTarget` is mounted above this surface. */
  hasBlurTarget?: boolean;
  reduceTransparency?: boolean;
}): PlatformGlassImplementation {
  if (input.reduceTransparency === true) return 'tint';
  if (input.platformOS === 'ios') return 'blur';
  if (input.platformOS !== 'android') return 'tint';
  if (input.hasBlurTarget !== true) return 'tint';
  return (input.apiLevel ?? 0) >= ANDROID_BLUR_MIN_API ? 'blur' : 'tint';
}

export type PlatformGlassPresentation = {
  implementation: PlatformGlassImplementation;
  backgroundColor: string;
  fill: PlatformGlassLadder;
  stroke: PlatformGlassLadder;
  ripple: PlatformGlassRipple | null;
};

export function resolvePlatformGlassPresentation(
  platformOS: unknown,
): PlatformGlassPresentation {
  return {
    implementation: 'tint',
    backgroundColor: colors.surface,
    fill: platformOS === 'ios' ? IOS_GLASS_FILL : ANDROID_GLASS_FILL,
    stroke: platformOS === 'ios' ? IOS_GLASS_STROKE : ANDROID_GLASS_STROKE,
    ripple: platformOS === 'ios' ? null : ANDROID_GLASS_RIPPLE,
  };
}
