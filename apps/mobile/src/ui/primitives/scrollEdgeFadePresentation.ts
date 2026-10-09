import { colors } from '@/src/ui/tokens';

export const SCROLL_FADE_TOP = 44;
export const SCROLL_FADE_BOTTOM = 30;

export const SCROLL_FADE_MOVERS_STOP = 0.9;
export const SCROLL_FADE_CHIPS_STOP = 0.88;

/**
 * A top fade depth that follows a scroller, held OUTSIDE React state
 * (`useScrollLinkedFadeTop`). `ScrollEdgeFade` takes one as its `top`: it draws
 * the fade at `max`, scales it to `current`, and listens here to rescale it
 * natively when the scroller moves, so no screen renders for a scroll event.
 */
export type ScrollLinkedFadeDepth = {
  /** The depth now, in dp: 0 at rest, up to `max`. */
  current: number;
  /** The fade's full depth. */
  max: number;
  subscribe: (listener: (depth: number) => void) => () => void;
};

export function isScrollLinkedFadeDepth(
  value: unknown,
): value is ScrollLinkedFadeDepth {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ScrollLinkedFadeDepth).subscribe === 'function'
  );
}

export type ScrollEdgeFadePresentation = {
  color: string;
  top: number;
  /** The bottom ramp: transparent at its head, full canvas at its foot. */
  bottom: number;
  /**
   * The band below the ramp that stays FULLY covered — the chrome the list
   * scrolls under (a docked composer, the floating tab bar). `0` on a scroller
   * whose bottom edge is the screen's own edge, which is every screen that has
   * no dock: there the 30px ramp alone is the whole mask.
   */
  bottomCover: number;
  /** The drawn box at the bottom edge: the ramp plus the covered band. */
  bottomTotal: number;
  /** Where the ramp reaches full colour, as the SVG gradient offset. */
  bottomStop: string;
};

export type HorizontalEdgeFadePresentation = {
  color: string;
  /** Where the fade begins, as a 0–1 fraction of the row's width. */
  stop: number;
  /** The same, as the percentage string an SVG gradient offset takes. */
  offset: string;
};

export function resolveScrollEdgeFadePresentation(input: {
  top?: number;
  bottom?: number;
  bottomCover?: number;
  color?: string;
}): ScrollEdgeFadePresentation {
  const top = sanitize(input.top, SCROLL_FADE_TOP);
  const bottom = sanitize(input.bottom, SCROLL_FADE_BOTTOM);
  const bottomCover = sanitize(input.bottomCover, 0);
  const bottomTotal = bottom + bottomCover;
  return {
    color: input.color ?? colors.canvas,
    top,
    bottom,
    bottomCover,
    bottomTotal,
    /* No box, no ramp — the stop is only ever read when something is drawn. */
    bottomStop:
      bottomTotal === 0
        ? '100%'
        : `${Math.round((bottom / bottomTotal) * 10000) / 100}%`,
  };
}

export function resolveHorizontalEdgeFadePresentation(input: {
  stop?: number;
  color?: string;
}): HorizontalEdgeFadePresentation {
  const stop = clampFraction(input.stop, SCROLL_FADE_MOVERS_STOP);
  return {
    color: input.color ?? colors.canvas,
    stop,
    offset: `${Math.round(stop * 10000) / 100}%`,
  };
}

function clampFraction(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0, value));
}

function sanitize(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

/* ─── A docked scroller's bottom edge ──────────────────────────────────────── */

export type DockedListEdge = {
  /** Content inset so the last row scrolls clear of the dock AND its ramp. */
  paddingBottom: number;
  /** The ramp depth handed to `ScrollEdgeFade`, at the phone's bottom edge. */
  fadeBottom: number;
};

export function resolveDockedListEdge(input: {
  bottomReserve: number;
  fadeBottom: number;
  clearance: number;
}): DockedListEdge {
  const dock = Math.max(0, input.bottomReserve);
  const fadeBottom = Math.max(0, input.fadeBottom);
  return {
    paddingBottom: dock + fadeBottom + Math.max(0, input.clearance),
    fadeBottom,
  };
}
