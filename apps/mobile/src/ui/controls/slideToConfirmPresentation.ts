import { accent, colors, radii, typography } from '@/src/ui/tokens';
import { ACCESSIBLE_RIM } from '@/src/ui/glass/materialTokens';

/** Track height is the 58 control token — the tap floor for a money door. */
export const SLIDE_TRACK_HEIGHT = typography.control;
/** Knob inset from the track edge on every side. */
export const SLIDE_TRACK_INSET = 4;
/** Knob diameter: the track less the inset on both sides. */
export const SLIDE_KNOB_SIZE = SLIDE_TRACK_HEIGHT - SLIDE_TRACK_INSET * 2;
/** Fraction of the travel a drag must cross before release confirms. */
export const SLIDE_CONFIRM_THRESHOLD = 0.8;
/** Snap-back / snap-home duration when motion is allowed. */
export const SLIDE_SNAP_MS = 300;

export type SlideToConfirmState = 'rest' | 'disabled' | 'busy';

export type SlideToConfirmPresentation = {
  state: SlideToConfirmState;
  trackFill: string;
  trackEdge: string;
  trailFill: string;
  knobFill: string;
  knobGlyph: string;
  knobShadowColor: string;
  knobShadowOpacity: number;
  hintColor: string;
  /** Whole-control opacity: inert controls recede. */
  opacity: number;
  /** The drag responder is only granted while the control is live. */
  interactive: boolean;
  radius: number;
};

export function resolveSlideToConfirmPresentation(input: {
  disabled: boolean;
  busy: boolean;
}): SlideToConfirmPresentation {
  const base = {
    trackFill: colors.glassFill,
    trackEdge: ACCESSIBLE_RIM,
    radius: radii.pill,
  };
  if (input.busy) {
    return {
      ...base,
      state: 'busy',
      trailFill: accent.signArmedTrail,
      knobFill: accent.signArmed,
      knobGlyph: accent.onSignArmed,
      knobShadowColor: accent.signArmed,
      knobShadowOpacity: 0.35,
      hintColor: colors.ink,
      opacity: 1,
      interactive: false,
    };
  }
  if (input.disabled) {
    return {
      ...base,
      state: 'disabled',
      trailFill: 'transparent',
      knobFill: colors.glassFillDisabled,
      knobGlyph: colors.inkTertiary,
      knobShadowColor: colors.scrim,
      knobShadowOpacity: 0,
      hintColor: colors.inkTertiary,
      opacity: 0.45,
      interactive: false,
    };
  }
  return {
    ...base,
    state: 'rest',
    trailFill: accent.signArmedTrail,
    knobFill: accent.signArmed,
    knobGlyph: accent.onSignArmed,
    knobShadowColor: accent.signArmed,
    knobShadowOpacity: 0.35,
    hintColor: GLASS_HINT,
    opacity: 1,
    interactive: true,
  };
}

const GLASS_HINT = colors.inkTertiary;

/** How far the knob may travel inside a track of `trackWidth`. */
export function resolveSlideTravel(trackWidth: number): number {
  if (!Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  return Math.max(0, trackWidth - SLIDE_TRACK_INSET * 2 - SLIDE_KNOB_SIZE);
}

/** Clamp a raw drag distance to the track. */
export function clampSlideOffset(dx: number, travel: number): number {
  if (!Number.isFinite(dx) || travel <= 0) return 0;
  return Math.min(travel, Math.max(0, dx));
}

/** Release verdict: past the threshold seals; anything short snaps home. */
export function slideConfirms(offset: number, travel: number): boolean {
  if (travel <= 0) return false;
  return clampSlideOffset(offset, travel) / travel >= SLIDE_CONFIRM_THRESHOLD;
}
