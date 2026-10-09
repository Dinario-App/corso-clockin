export type AccessibilityPreferenceState = {
  reduceMotion: boolean;
  reduceTransparency: boolean;
};

export const FAIL_ACCESSIBLE_PREFERENCE: AccessibilityPreferenceState = {
  reduceMotion: true,
  reduceTransparency: true,
};

/** Conservative boot default until the first platform read lands. */
export const INITIAL_ACCESSIBILITY_PREFERENCE: AccessibilityPreferenceState = {
  ...FAIL_ACCESSIBLE_PREFERENCE,
};

export function coercePreferenceFlag(
  value: boolean | null | undefined,
  errored: boolean,
): boolean {
  if (errored) return true;
  if (value === true) return true;
  if (value === false) return false;
  return true;
}

export function buildAccessibilityPreferenceState(input: {
  reduceMotion?: boolean | null;
  reduceTransparency?: boolean | null;
  errored?: boolean;
}): AccessibilityPreferenceState {
  const errored = input.errored === true;
  return {
    reduceMotion: coercePreferenceFlag(input.reduceMotion, errored),
    reduceTransparency: coercePreferenceFlag(input.reduceTransparency, errored),
  };
}

export function shouldApplyPreferenceRead(
  readGeneration: number,
  currentGeneration: number,
): boolean {
  return readGeneration === currentGeneration;
}

export function patchAccessibilityPreference(
  prev: AccessibilityPreferenceState,
  patch: Partial<AccessibilityPreferenceState>,
): AccessibilityPreferenceState {
  return { ...prev, ...patch };
}

export type AccessibilityInfoReader = {
  isReduceMotionEnabled(): Promise<boolean>;
  isReduceTransparencyEnabled(): Promise<boolean>;
  addEventListener(
    event: 'reduceMotionChanged' | 'reduceTransparencyChanged',
    handler: (enabled: boolean) => void,
  ): { remove: () => void };
};

export async function readAccessibilityPreferenceSnapshot(
  info: AccessibilityInfoReader,
): Promise<
  | { ok: true; snapshot: AccessibilityPreferenceState }
  | { ok: false }
> {
  try {
    const [reduceMotion, reduceTransparency] = await Promise.all([
      info.isReduceMotionEnabled(),
      info.isReduceTransparencyEnabled(),
    ]);
    return {
      ok: true,
      snapshot: buildAccessibilityPreferenceState({
        reduceMotion,
        reduceTransparency,
      }),
    };
  } catch {
    return { ok: false };
  }
}
