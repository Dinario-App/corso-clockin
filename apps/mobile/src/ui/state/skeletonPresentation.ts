import type { ResolvedMotion } from '@/src/motion/resolveMotion.js';
import { resolveSkeletonMotion } from '@/src/motion/resolveMotion.js';
import { copy } from '@/constants/copy';
import { colors, radii } from '@/src/ui/tokens';

export const SKELETON_PRESETS = {
  hero: { width: 220, height: 34 },
  delta: { width: 120, height: 22 },
  assetAmount: { width: 90, height: 16 },
  assetFiat: { width: 60, height: 13 },
  quoteReceive: { width: 180, height: 32 },
} as const;

export type SkeletonPreset = keyof typeof SKELETON_PRESETS;

export type SkeletonPresentation = {
  width: number;
  height: number;
  borderRadius: number;
  backgroundColor: string;
  motion: ResolvedMotion;
  accessibilityLabel: string;
  accessibilityState: { busy: true };
};

export type SkeletonPresentationInput = {
  what: string;
  reduceMotion: boolean;
  preset?: SkeletonPreset;
  width?: number;
  height?: number;
};

function assertSourcedWhat(what: unknown): string {
  if (typeof what !== 'string') {
    throw new Error('Skeleton what must be a sourced noun');
  }
  const trimmed = what.trim();
  if (trimmed.length === 0) {
    throw new Error('Skeleton what must be a sourced noun');
  }
  if (/[\d$]/.test(trimmed)) {
    throw new Error('Skeleton what cannot be announced as a value');
  }
  return trimmed;
}

function assertPositiveSize(value: unknown, axis: 'width' | 'height'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Skeleton ${axis} must be a positive finite number`);
  }
  return value;
}

export function resolveSkeletonPresentation(
  input: SkeletonPresentationInput,
): SkeletonPresentation {
  const what = assertSourcedWhat(input.what);

  let width: number;
  let height: number;

  if (input.preset !== undefined) {
    const preset = SKELETON_PRESETS[input.preset];
    if (preset === undefined) {
      throw new Error(`Unknown skeleton preset: ${String(input.preset)}`);
    }
    if (input.width !== undefined || input.height !== undefined) {
      throw new Error(
        'Skeleton preset cannot be combined with custom dimensions',
      );
    }
    width = preset.width;
    height = preset.height;
  } else {
    width = assertPositiveSize(input.width, 'width');
    height = assertPositiveSize(input.height, 'height');
  }

  return {
    width,
    height,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    motion: resolveSkeletonMotion({ reduceMotion: input.reduceMotion }),
    accessibilityLabel: copy.skeleton.loading(what),
    accessibilityState: { busy: true },
  };
}
