/** `translateY(±8px)` — the pane starts this far TOWARD its anchor. */
export const ANCHORED_MENU_TRAVEL = 8;
/** `scale(.96)` at rest-before-open. */
export const ANCHORED_MENU_SCALE_FROM = 0.96;
/** Open `.22s`. */
export const ANCHORED_MENU_OPEN_MS = 220;
/** Close `.25s`. */
export const ANCHORED_MENU_CLOSE_MS = 250;
export const ANCHORED_MENU_EASING = [0.3, 0.8, 0.3, 1] as const;

/** Gap between the anchor's edge and the pane. */
export const ANCHORED_MENU_GAP = 8;
export const ANCHORED_MENU_SCREEN_MARGIN = 14;

/** Window-space rect of the control that opened the menu. */
export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnchoredMenuSide = 'above' | 'below';
/** Pin the pane to the anchor's leading (`start`) or trailing (`end`) edge. */
export type AnchoredMenuAlign = 'start' | 'end';

export type AnchoredMenuPlacementInput = {
  anchor: AnchorRect;
  /** Live window size — `useWindowDimensions()`, not a design-canvas constant. */
  window: { width: number; height: number };
  width: number;
  /**
   * What the pane is expected to measure vertically. Only used to choose a side
   * when `side` is `auto`, and to cap `maxHeight`; a wrong guess costs a flip,
   * never a clipped menu.
   */
  estimatedHeight?: number;
  /** `auto` puts the pane wherever it fits, preferring below. */
  side?: AnchoredMenuSide | 'auto';
  align?: AnchoredMenuAlign;
  gap?: number;
  margin?: number;
};

export type AnchoredMenuPlacement = {
  side: AnchoredMenuSide;
  /** Set when the pane hangs below the anchor. */
  top: number | null;
  /** Set when the pane sits above the anchor. */
  bottom: number | null;
  left: number;
  width: number;
  /** The tallest the pane may grow before it would run off screen. */
  maxHeight: number;
  transformOrigin: [string, string, number];
  /** The pane's starting `translateY`: toward the anchor, `±ANCHORED_MENU_TRAVEL`. */
  translateFrom: number;
};

/**
 * Place the pane against its control, inside the screen, on the side with room.
 *
 * Clamping is deliberate and total: a menu that runs off the edge is worse than
 * a menu that is not flush with its control, and on a 375pt device the 296pt
 * account card plus two 14pt margins leaves 51pt of slack — one rotation or one
 * large-text layout eats that.
 */
export function resolveAnchoredMenuPlacement(
  input: AnchoredMenuPlacementInput,
): AnchoredMenuPlacement {
  const margin = finite(input.margin, ANCHORED_MENU_SCREEN_MARGIN);
  const gap = finite(input.gap, ANCHORED_MENU_GAP);
  const align: AnchoredMenuAlign = input.align ?? 'start';

  const windowWidth = Math.max(0, input.window.width);
  const windowHeight = Math.max(0, input.window.height);

  /** Never wider than the screen minus both margins. */
  const width = Math.max(
    0,
    Math.min(input.width, windowWidth - margin * 2),
  );

  const anchorLeft = input.anchor.x;
  const anchorRight = input.anchor.x + input.anchor.width;
  const anchorTop = input.anchor.y;
  const anchorBottom = input.anchor.y + input.anchor.height;

  const preferredLeft =
    align === 'end' ? anchorRight - width : anchorLeft;
  const left = clamp(
    preferredLeft,
    margin,
    Math.max(margin, windowWidth - margin - width),
  );

  const roomBelow = windowHeight - anchorBottom - gap - margin;
  const roomAbove = anchorTop - gap - margin;
  const side = resolveSide({
    requested: input.side ?? 'auto',
    estimatedHeight: input.estimatedHeight,
    roomAbove,
    roomBelow,
  });

  const maxHeight = Math.max(0, side === 'below' ? roomBelow : roomAbove);

  /**
   * The pane grows out of the point on its own edge nearest the control's
   * centre, so a menu pinned to a right-hand control opens from the right.
   */
  const originX =
    width <= 0
      ? 0.5
      : clamp((input.anchor.x + input.anchor.width / 2 - left) / width, 0, 1);

  return {
    side,
    top: side === 'below' ? anchorBottom + gap : null,
    bottom: side === 'above' ? windowHeight - anchorTop + gap : null,
    left,
    width,
    maxHeight,
    transformOrigin: [
      `${round2(originX * 100)}%`,
      side === 'below' ? '0%' : '100%',
      0,
    ],
    translateFrom:
      side === 'below' ? -ANCHORED_MENU_TRAVEL : ANCHORED_MENU_TRAVEL,
  };
}

function resolveSide(input: {
  requested: AnchoredMenuSide | 'auto';
  estimatedHeight?: number;
  roomAbove: number;
  roomBelow: number;
}): AnchoredMenuSide {
  if (input.requested !== 'auto') return input.requested;

  const needed = finite(input.estimatedHeight, 0);
  if (input.roomBelow >= needed) return 'below';
  /** Neither side fits: take the roomier one rather than guessing. */
  return input.roomAbove > input.roomBelow ? 'above' : 'below';
}

/* ─── Motion resolution ───────────────────────────────────────────────────── */

export type AnchoredMenuMotion = {
  /** Whether to run a timing at all. Reduce Motion cuts straight to the state. */
  animated: boolean;
  /** Target progress: 1 open, 0 closed. */
  toValue: 0 | 1;
  durationMs: number;
  easing: readonly [number, number, number, number];
};

export function resolveAnchoredMenuMotion(input: {
  visible: boolean;
  reduceMotion: boolean;
}): AnchoredMenuMotion {
  return {
    animated: !input.reduceMotion,
    toValue: input.visible ? 1 : 0,
    durationMs: input.visible
      ? ANCHORED_MENU_OPEN_MS
      : ANCHORED_MENU_CLOSE_MS,
    easing: ANCHORED_MENU_EASING,
  };
}

function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(Math.max(value, low), Math.max(low, high));
}

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
