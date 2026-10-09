import { createContext, useContext, type RefObject } from 'react';
import type { View } from 'react-native';

/**
 * The Android blur target's ref, handed down by `MaterialBlurTarget`
 * (`BlurTarget.tsx` carries the mechanism and why the target is a layer BEHIND
 * the panes). Split out so `CorsoGlass.tsx` can read it without importing
 * `BlurTarget.tsx`, which imports the target view back from `CorsoGlass.tsx`.
 */
export type MaterialBlurTargetRef = RefObject<View | null>;

export const BlurTargetContext = createContext<MaterialBlurTargetRef | null>(
  null,
);

export function useMaterialBlurTarget(): MaterialBlurTargetRef | null {
  return useContext(BlurTargetContext);
}
