import { ethena } from '@/constants/theme.ethena';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import { resolveDeltaInk } from '@/src/ui/ethena/deltaInk';

export type DirectionInk = 'secondary' | 'tertiary';

export function resolveInkDirectionGlyph(
  direction: 'up' | 'down',
  ink: DirectionInk,
): {
  glyph: '▲' | '▼';
  style: { fontSize: number; lineHeight: number; color: string };
} {
  return {
    glyph: direction === 'up' ? '▲' : '▼',
    style: {
      fontSize: ETHENA_TYPE.rowDelta.fontSize,
      lineHeight: ETHENA_TYPE.rowDelta.lineHeight,
      color: ink === 'tertiary' ? ethena.ink.tertiary : resolveDeltaInk(direction),
    },
  };
}
