export const MOTION_DURATION_MS = {
  instant: 90,
  quick: 120,
  base: 180,
  tick: 240,
  dismiss: 240,
  enter: 300,
  push: 280,
  flipRotate: 220,
  flipFade: 120,
  shimmerLoop: 1200,
  toastHold: 1600,
  scrimFade: 200,
} as const;

export type MotionDurationName = keyof typeof MOTION_DURATION_MS;

export const MOTION_EASING = {
  out: 'ease-out',
  in: 'ease-in',
  inOut: 'ease-in-out',
  linear: 'linear',
  platformDefault: 'platform-default',
} as const;

export type MotionEasingName = keyof typeof MOTION_EASING;

/**
 * Alphas for `colors.scrim` (black), re-derived when the fill flipped off ink.
 *
 * 65% is the lowest alpha at which the brightest thing behind a sheet — ink
 * @100% type — falls to 3.01:1 against the scrimmed canvas, i.e. to the WCAG
 * 1.4.11 non-text floor and no further. Below it the backdrop still reads as
 * operable, which is why Home's Fund and Send showed through the shipped ink
 * scrim — measured 6.00:1 on the emulator, with the ink type surviving at a
 * full `#F4F1EC`. Reduce Transparency takes the backdrop to 1.17:1 — gone.
 */
export const SCRIM_OPACITY = {
  default: 0.65,
  reduceTransparency: 0.9,
} as const;

export const HOME_ZONE_WASH_OPACITY = 0.5;

export const STALE_VALUE_OPACITY = 0.6;

export const GENERIC_MOTION_TRANSITION = {
  sheetPresent: 'sheetPresent',
  sheetDismiss: 'sheetDismiss',
  scrimFade: 'scrimFade',
  stackPushPop: 'stackPushPop',
  tabSwitch: 'tabSwitch',
  segmentChange: 'segmentChange',
  toastIn: 'toastIn',
  toastHold: 'toastHold',
  toastOut: 'toastOut',
} as const;

export type GenericMotionTransitionId =
  (typeof GENERIC_MOTION_TRANSITION)[keyof typeof GENERIC_MOTION_TRANSITION];

/** Transitions with their own resolvers; resolveTransitionMotion does not handle them. */
export const DEDICATED_MOTION_TRANSITION = {
  flipPayReceive: 'flipPayReceive',
  skeletonShimmer: 'skeletonShimmer',
  balanceTick: 'balanceTick',
  ctaPress: 'ctaPress',
} as const;

export type DedicatedMotionTransitionId =
  (typeof DEDICATED_MOTION_TRANSITION)[keyof typeof DEDICATED_MOTION_TRANSITION];

export const MOTION_TRANSITION = {
  ...GENERIC_MOTION_TRANSITION,
  ...DEDICATED_MOTION_TRANSITION,
} as const;

export type MotionTransitionId =
  (typeof MOTION_TRANSITION)[keyof typeof MOTION_TRANSITION];

export const PROHIBITED_MOTION = {
  errorShake: 'errorShake',
  successCelebration: 'successCelebration',
} as const;

export type ProhibitedMotionId =
  (typeof PROHIBITED_MOTION)[keyof typeof PROHIBITED_MOTION];
