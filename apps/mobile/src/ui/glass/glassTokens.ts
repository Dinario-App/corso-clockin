import { colors, spacing } from '@/src/ui/tokens';
import { ONGLASS, ONGLASS_HI } from './materialTokens';

export const GLASS_RADIUS = 22;
/** Small panes — bot strip, attach popover. */
export const GLASS_RADIUS_NESTED = 18;
/** Phone-edge gutter. Card inset is 20. */
export const GLASS_GUTTER = spacing.xl;
export const GLASS_CARD_INSET = 20;

export const GLASS_TINT = 'rgba(17, 17, 17, 0.5)';
/** Lens on a lens: lifts, never stacks to black. */
export const GLASS_TINT_NESTED = 'rgba(244, 241, 236, 0.05)';
/** 1px edge-lit inner border. */
export const GLASS_EDGE = 'rgba(255, 255, 255, 0.2)';
/** Voice disc while listening. Still an edge, never a glow. */
export const GLASS_EDGE_LIVE = 'rgba(255, 255, 255, 0.4)';
export const GLASS_STATUS_FILL = 'rgba(9, 9, 9, 0.55)';
export const GLASS_STATUS_EDGE = 'rgba(255, 255, 255, 0.1)';
/**
 * Superseded. Blur exists only on the `frost` and `float` weights in
 * `MATERIAL_WEIGHTS`. Kept declared, read by nothing.
 */
export const GLASS_BLUR_INTENSITY = 40;

export const GLASS_MUTE = colors.inkTertiary;
export const GLASS_FAINT = 'rgba(255, 255, 255, 0.26)';
export const GLASS_INK_72 = colors.inkSecondary;
/** `--onglass` — the next rung up for a resting chip. Aliases `materialTokens.ts`. */
export const GLASS_ONGLASS = ONGLASS;
/** `--onglass-hi` — the same rung for a selected / expanded chip. */
export const GLASS_ONGLASS_HI = ONGLASS_HI;

export const GLASS_LIVE_DOT = colors.ink;
export const GLASS_IDLE_DOT = GLASS_FAINT;
