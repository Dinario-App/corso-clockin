import { createContext, useContext } from 'react';
import type { MoonPayFlow } from './moonPayFlow';

export const MoonPayFlowContext = createContext<MoonPayFlow | null>(null);

/** The mounted flow, or null outside `MoonPayProvider`. Never throws. */
export function useOptionalMoonPayFlow(): MoonPayFlow | null {
  return useContext(MoonPayFlowContext);
}
