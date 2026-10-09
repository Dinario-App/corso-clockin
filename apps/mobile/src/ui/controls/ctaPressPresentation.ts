import type { TextStyle, ViewStyle } from 'react-native';
import { resolveCtaPressMotion } from '@/src/motion/resolveMotion.js';
import { colors, typography } from '@/src/ui/tokens';

export type CtaPressVariant =
  | 'primary'
  | 'secondarySurface'
  /**
   * The transactional CTA — verdict and money doors. Both tones paint
   * CorsoGlass `icy-cta`; this variant survives for the one-point press drop,
   * not for a colour.
   */
  | 'transactional';

export const CTA_PRESS_TRANSLATE_Y = 1;

/**
 * Reduce-motion press on CorsoGlass `icy-cta`. The material (`CorsoGlassFill`)
 * is the fill, so a colour under it never shows. Opacity keeps the press
 * visible without a second paint. 0.82 is the strength the ink pill used for
 * its pressed fill, applied to the whole icy control.
 */
export const ICY_CTA_REDUCE_MOTION_PRESS_OPACITY = 0.82;

export type CtaPressPresentation = {
  containerStyle: ViewStyle;
  labelStyle: TextStyle;
};

const NON_MOTION_PRESSED: Record<
  CtaPressVariant,
  { container: ViewStyle; label: TextStyle }
> = {
  /**
   * Ink-pill reduce-motion press (`StickyActionPair`'s primary). That control
   * has no `CorsoGlassFill`, so the fill is the carrier: white at 82%.
   * An icy `PrimaryCTA` does not read this — see `icy` on the resolver.
   */
  primary: {
    container: { backgroundColor: colors.primaryPressed },
    label: {},
  },
  /**
   * ⚠️ The container carrier is vestigial for this variant: `SecondaryCTA` is
   * glass now, and a glass door's non-motion pressed read is the material
   * lifted to `--mat-fill-hi`, never a flat fill painted behind it. Only
   * `labelStyle` is read at that call site.
   */
  secondarySurface: {
    container: { backgroundColor: colors.line },
    label: {
      fontFamily: typography.face('600'),
      fontWeight: '600',
    },
  },
  /**
   * CorsoGlass `icy-cta` has no pressed fill. Reduce-motion press is opacity
   * on the control that holds `CorsoGlassFill`. Motion press stays the 1px
   * drop (`CTA_PRESS_TRANSLATE_Y`). The label is not restyled.
   */
  transactional: {
    container: { opacity: ICY_CTA_REDUCE_MOTION_PRESS_OPACITY },
    label: {},
  },
};

export function resolveCtaPressPresentation(input: {
  variant: CtaPressVariant;
  reduceMotion: boolean;
  pressed: boolean;
  /**
   * True when the control's armed paint is CorsoGlass `icy-cta`. Reduce-motion
   * press then must not assign a fill: `CorsoGlassFill` covers it.
   */
  icy?: boolean;
}): CtaPressPresentation {
  const motion = resolveCtaPressMotion({ reduceMotion: input.reduceMotion });

  if (!input.pressed) {
    return {
      containerStyle: {},
      labelStyle: {},
    };
  }

  if (motion.pressedStateCarrier === 'motion' && motion.scale !== undefined) {
    return {
      containerStyle:
        input.variant === 'transactional'
          ? { transform: [{ translateY: CTA_PRESS_TRANSLATE_Y }] }
          : { transform: [{ scale: motion.scale }] },
      labelStyle: {},
    };
  }

  if (input.icy === true && input.variant !== 'secondarySurface') {
    return {
      containerStyle: { opacity: ICY_CTA_REDUCE_MOTION_PRESS_OPACITY },
      labelStyle: {},
    };
  }

  const carrier = NON_MOTION_PRESSED[input.variant];
  return {
    containerStyle: { ...carrier.container },
    labelStyle: { ...carrier.label },
  };
}
