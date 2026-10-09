import type { BoxShadowValue, ViewStyle } from 'react-native';

/** Soft shadow colour: canvas `#0C0B0A` @ 8%. */
export const ELEVATION_SOFT_COLOR = '#0C0B0A14' as const;

export const ELEVATION_SOFT_OFFSET_X = 0 as const;
export const ELEVATION_SOFT_OFFSET_Y = 8 as const;
export const ELEVATION_SOFT_BLUR_RADIUS = 24 as const;
export const ELEVATION_SOFT_SPREAD_DISTANCE = -8 as const;

const ELEVATION_SOFT_SHADOW_ENTRY = Object.freeze({
  offsetX: ELEVATION_SOFT_OFFSET_X,
  offsetY: ELEVATION_SOFT_OFFSET_Y,
  color: ELEVATION_SOFT_COLOR,
  blurRadius: ELEVATION_SOFT_BLUR_RADIUS,
  spreadDistance: ELEVATION_SOFT_SPREAD_DISTANCE,
} satisfies BoxShadowValue);

export const ELEVATION_SOFT_BOX_SHADOW = Object.freeze([
  ELEVATION_SOFT_SHADOW_ENTRY,
]) as ReadonlyArray<BoxShadowValue>;

/** ViewStyle fragment carrying the locked single-effect `boxShadow` token. */
export const elevationSoftViewStyle = Object.freeze({
  boxShadow: ELEVATION_SOFT_BOX_SHADOW,
} satisfies Pick<ViewStyle, 'boxShadow'>);

export const ELEVATION_SOFT_CONSUMER_CLASSES = Object.freeze([
  'ActionPill',
  'AssetRow(state=promoted)',
  'FlipControl',
  'BottomSheet',
  'BottomNav',
] as const);

export type ElevationSoftConsumerClass =
  (typeof ELEVATION_SOFT_CONSUMER_CLASSES)[number];
