import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Material } from './Material';
import { resolveLensPresentation } from './lensPresentation';

export type LensProps = {
  children?: ReactNode;
  /** Outer style: margins, flex, size. Radius and clipping are the lens's. */
  style?: StyleProp<ViewStyle>;
  /** Inner style: padding and layout of the children. */
  contentStyle?: StyleProp<ViewStyle>;
  /** A lens inside a lens — a flat on-glass wash, no second blur. */
  nested?: boolean;
  /**
   * Hug the children (content-height) instead of filling the caller's box.
   * Chat items in a scrolling thread must hug — see `lensPresentation.ts`.
   */
  hug?: boolean;
  radius?: number;
  /** Override the nested wash. Ignored on a full pane, which is the material. */
  tintColor?: string;
  /**
   * Explicit rim, for a control whose edge carries a live state (the voice disc
   * while listening, an invalid import card). Increase Contrast still wins.
   */
  edgeColor?: string;
  testID?: string;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
};

export function Lens({
  children,
  style,
  contentStyle,
  nested = false,
  hug = false,
  radius,
  tintColor,
  edgeColor,
  testID,
  pointerEvents,
}: LensProps) {
  const lens = resolveLensPresentation({ nested, radius, hug });

  return (
    <Material
      weight={lens.weight}
      radius={lens.borderRadius}
      nested={lens.nested}
      washColor={tintColor}
      rimColor={edgeColor}
      hug={lens.hug}
      style={style}
      contentStyle={contentStyle}
      testID={testID}
      pointerEvents={pointerEvents}
    >
      {children}
    </Material>
  );
}
