import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useIncreaseContrast } from './useIncreaseContrast';
import { resolveInkPalette, type InkPalette } from './inkContrast';

const InkContrastContext = createContext<boolean>(false);

export function InkContrastProvider({ children }: { children: ReactNode }) {
  const increaseContrast = useIncreaseContrast();
  return (
    <InkContrastContext.Provider value={increaseContrast}>
      {children}
    </InkContrastContext.Provider>
  );
}

/** True when the OS has been asked for more contrast. */
export function useInkContrastEnabled(): boolean {
  return useContext(InkContrastContext);
}

const FloatSheetInkContext = createContext<boolean>(false);

export function FloatSheetInkProvider({
  onFloatSheet,
  children,
}: {
  onFloatSheet: boolean;
  children: ReactNode;
}) {
  return (
    <FloatSheetInkContext.Provider value={onFloatSheet}>
      {children}
    </FloatSheetInkContext.Provider>
  );
}

/** True for text under a float sheet. */
export function useOnFloatSheet(): boolean {
  return useContext(FloatSheetInkContext);
}

/**
 * `inkTertiary` / `inkQuaternary` at the user's requested contrast.
 *
 * For a screen that resolves its own colours rather than routing text through
 * `<CorsoText>` — an icon tint, a `placeholderTextColor`, a chart series.
 */
export function useInkPalette(): InkPalette {
  const increaseContrast = useInkContrastEnabled();
  return useMemo(() => resolveInkPalette(increaseContrast), [increaseContrast]);
}
