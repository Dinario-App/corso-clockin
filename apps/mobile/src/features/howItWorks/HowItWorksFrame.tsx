import type { ReactNode } from 'react';
import { ethena } from '@/constants/theme.ethena';
import { EthenaGround } from '@/src/ui/ethena/EthenaPrimitives';

export function HowItWorksGround({ children }: { children?: ReactNode }) {
  return <EthenaGround>{children}</EthenaGround>;
}

/**
 * What a page's bottom fade dissolves into. The intro's scroller ends well
 * below the 256dp the ground's top light reaches, where the ground is void.
 */
export const HOW_IT_WORKS_GROUND_FADE = ethena.void;
