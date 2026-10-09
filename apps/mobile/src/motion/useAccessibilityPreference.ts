import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  INITIAL_ACCESSIBILITY_PREFERENCE,
  coercePreferenceFlag,
  patchAccessibilityPreference,
  shouldApplyPreferenceRead,
  type AccessibilityInfoReader,
  type AccessibilityPreferenceState,
} from '@/src/motion/accessibilityPreference.js';

export type { AccessibilityPreferenceState };

export function useAccessibilityPreference(
  info: AccessibilityInfoReader = AccessibilityInfo,
): AccessibilityPreferenceState {
  const [state, setState] = useState(INITIAL_ACCESSIBILITY_PREFERENCE);
  const motionGenerationRef = useRef(0);
  const transparencyGenerationRef = useRef(0);

  useEffect(() => {
    const motionGeneration = ++motionGenerationRef.current;
    const transparencyGeneration = ++transparencyGenerationRef.current;

    void (async () => {
      try {
        const reduceMotion = await info.isReduceMotionEnabled();
        if (!shouldApplyPreferenceRead(motionGeneration, motionGenerationRef.current)) {
          return;
        }
        setState((prev) =>
          patchAccessibilityPreference(prev, {
            reduceMotion: coercePreferenceFlag(reduceMotion, false),
          }),
        );
      } catch {
        if (!shouldApplyPreferenceRead(motionGeneration, motionGenerationRef.current)) {
          return;
        }
        setState((prev) =>
          patchAccessibilityPreference(prev, { reduceMotion: true }),
        );
      }
    })();

    void (async () => {
      try {
        const reduceTransparency = await info.isReduceTransparencyEnabled();
        if (
          !shouldApplyPreferenceRead(
            transparencyGeneration,
            transparencyGenerationRef.current,
          )
        ) {
          return;
        }
        setState((prev) =>
          patchAccessibilityPreference(prev, {
            reduceTransparency: coercePreferenceFlag(reduceTransparency, false),
          }),
        );
      } catch {
        if (
          !shouldApplyPreferenceRead(
            transparencyGeneration,
            transparencyGenerationRef.current,
          )
        ) {
          return;
        }
        setState((prev) =>
          patchAccessibilityPreference(prev, { reduceTransparency: true }),
        );
      }
    })();

    if (typeof info?.addEventListener !== 'function') {
      return () => {
        motionGenerationRef.current += 1;
        transparencyGenerationRef.current += 1;
      };
    }

    const motionSub = info.addEventListener('reduceMotionChanged', (enabled) => {
      motionGenerationRef.current += 1;
      setState((prev) =>
        patchAccessibilityPreference(prev, { reduceMotion: enabled }),
      );
    });
    const transparencySub = info.addEventListener(
      'reduceTransparencyChanged',
      (enabled) => {
        transparencyGenerationRef.current += 1;
        setState((prev) =>
          patchAccessibilityPreference(prev, { reduceTransparency: enabled }),
        );
      },
    );

    return () => {
      motionGenerationRef.current += 1;
      transparencyGenerationRef.current += 1;
      motionSub.remove();
      transparencySub.remove();
    };
  }, [info]);

  return state;
}
