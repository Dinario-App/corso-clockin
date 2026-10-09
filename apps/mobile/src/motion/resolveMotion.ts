import {
  HOME_ZONE_WASH_OPACITY,
  MOTION_DURATION_MS,
  MOTION_EASING,
  type GenericMotionTransitionId,
  type ProhibitedMotionId,
  PROHIBITED_MOTION,
  SCRIM_OPACITY,
  STALE_VALUE_OPACITY,
} from './motionTokens.js';

export type MotionKind =
  | 'crossFade'
  | 'slide'
  | 'scale'
  | 'rotateCrossFade'
  | 'opacityLoop'
  | 'staticBar'
  | 'hold'
  | 'instant'
  | 'none';

export type ResolvedMotion = {
  durationMs: number;
  easing: (typeof MOTION_EASING)[keyof typeof MOTION_EASING];
  kind: MotionKind;
  fadeDurationMs?: number;
  rotateDegrees?: number;
  scale?: number;
  loop?: boolean;
  pressedStateCarrier?: 'motion' | 'nonMotion';
};

export type TransparencyTreatment =
  | 'sheetScrim'
  | 'homeZoneWash'
  | 'staleValueOpacity';

const REDUCED_CROSS_FADE: ResolvedMotion = {
  durationMs: MOTION_DURATION_MS.quick,
  easing: MOTION_EASING.out,
  kind: 'crossFade',
};

const BASELINE_TRANSITIONS: Record<
  GenericMotionTransitionId,
  ResolvedMotion
> = {
  sheetPresent: {
    durationMs: MOTION_DURATION_MS.enter,
    easing: MOTION_EASING.out,
    kind: 'crossFade',
  },
  sheetDismiss: {
    durationMs: MOTION_DURATION_MS.dismiss,
    easing: MOTION_EASING.in,
    kind: 'crossFade',
  },
  scrimFade: {
    durationMs: MOTION_DURATION_MS.scrimFade,
    easing: MOTION_EASING.linear,
    kind: 'crossFade',
  },
  stackPushPop: {
    durationMs: MOTION_DURATION_MS.push,
    easing: MOTION_EASING.platformDefault,
    kind: 'slide',
  },
  tabSwitch: {
    durationMs: MOTION_DURATION_MS.base,
    easing: MOTION_EASING.out,
    kind: 'crossFade',
  },
  segmentChange: {
    durationMs: MOTION_DURATION_MS.base,
    easing: MOTION_EASING.out,
    kind: 'crossFade',
  },
  toastIn: {
    durationMs: MOTION_DURATION_MS.base,
    easing: MOTION_EASING.out,
    kind: 'crossFade',
  },
  toastHold: {
    durationMs: MOTION_DURATION_MS.toastHold,
    easing: MOTION_EASING.out,
    kind: 'hold',
  },
  toastOut: {
    durationMs: MOTION_DURATION_MS.base,
    easing: MOTION_EASING.out,
    kind: 'crossFade',
  },
};

export function resolveTransitionMotion(input: {
  transition: GenericMotionTransitionId;
  reduceMotion: boolean;
}): ResolvedMotion {
  const baseline = BASELINE_TRANSITIONS[input.transition];
  if (baseline === undefined) {
    throw new Error(
      `Unknown motion transition: ${String(input.transition)}`,
    );
  }

  if (input.reduceMotion) {
    return { ...REDUCED_CROSS_FADE };
  }

  return { ...baseline };
}

export function resolveScrimFadeMotion(input: {
  reduceMotion: boolean;
}): ResolvedMotion {
  return resolveTransitionMotion({
    transition: 'scrimFade',
    reduceMotion: input.reduceMotion,
  });
}

export function resolveFlipMotion(input: {
  reduceMotion: boolean;
}): ResolvedMotion {
  if (input.reduceMotion) {
    return {
      durationMs: 0,
      easing: MOTION_EASING.linear,
      kind: 'instant',
    };
  }

  return {
    durationMs: MOTION_DURATION_MS.flipRotate,
    fadeDurationMs: MOTION_DURATION_MS.flipFade,
    easing: MOTION_EASING.inOut,
    kind: 'rotateCrossFade',
    rotateDegrees: 180,
  };
}

export function resolveSkeletonMotion(input: {
  reduceMotion: boolean;
}): ResolvedMotion {
  if (input.reduceMotion) {
    return {
      durationMs: 0,
      easing: MOTION_EASING.linear,
      kind: 'staticBar',
      loop: false,
    };
  }

  return {
    durationMs: MOTION_DURATION_MS.shimmerLoop,
    easing: MOTION_EASING.linear,
    kind: 'opacityLoop',
    loop: true,
  };
}

export function resolveBalanceTickMotion(input: {
  reduceMotion: boolean;
  valueChanged: boolean;
}): ResolvedMotion {
  if (!input.valueChanged) {
    return {
      durationMs: 0,
      easing: MOTION_EASING.out,
      kind: 'none',
    };
  }

  if (input.reduceMotion) {
    return { ...REDUCED_CROSS_FADE };
  }

  return {
    durationMs: MOTION_DURATION_MS.tick,
    easing: MOTION_EASING.out,
    kind: 'crossFade',
  };
}

export function resolveCtaPressMotion(input: {
  reduceMotion: boolean;
}): ResolvedMotion {
  if (input.reduceMotion) {
    return {
      ...REDUCED_CROSS_FADE,
      pressedStateCarrier: 'nonMotion',
    };
  }

  return {
    durationMs: MOTION_DURATION_MS.instant,
    easing: MOTION_EASING.out,
    kind: 'scale',
    scale: 0.98,
    pressedStateCarrier: 'motion',
  };
}

export function resolveScrimOpacity(input: {
  reduceTransparency: boolean;
}): number {
  return input.reduceTransparency
    ? SCRIM_OPACITY.reduceTransparency
    : SCRIM_OPACITY.default;
}

export function resolveTransparencyTreatment(input: {
  treatment: TransparencyTreatment;
  reduceTransparency: boolean;
}): { opacity: number; affected: boolean } {
  switch (input.treatment) {
    case 'sheetScrim':
      return {
        opacity: resolveScrimOpacity({
          reduceTransparency: input.reduceTransparency,
        }),
        affected: input.reduceTransparency,
      };
    case 'homeZoneWash':
      return {
        opacity: HOME_ZONE_WASH_OPACITY,
        affected: false,
      };
    case 'staleValueOpacity':
      return {
        opacity: STALE_VALUE_OPACITY,
        affected: false,
      };
    default: {
      const _exhaustive: never = input.treatment;
      throw new Error(
        `Unknown transparency treatment: ${String(_exhaustive)}`,
      );
    }
  }
}

const PROHIBITED_SET = new Set<ProhibitedMotionId>(
  Object.values(PROHIBITED_MOTION),
);

export function isProhibitedMotion(id: string): boolean {
  return PROHIBITED_SET.has(id as ProhibitedMotionId);
}
