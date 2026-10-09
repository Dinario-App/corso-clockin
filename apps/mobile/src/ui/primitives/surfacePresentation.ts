import { colors, radii } from '@/src/ui/tokens';

export type SurfaceFill = 'canvas' | 'surface' | 'ink';
export type SurfaceRadius =
  | 'sm'
  | 'md'
  | 'lg'
  | 'pill'
  | 'menuRow'
  | 'cta'
  | 'smallPane'
  | 'pane'
  | 'verdict';

const SURFACE_RADII: readonly SurfaceRadius[] = [
  'sm',
  'md',
  'lg',
  'pill',
  'menuRow',
  'cta',
  'smallPane',
  'pane',
  'verdict',
];

export type SurfacePresentation = {
  backgroundColor: string;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
};

export const KIT_DARK_SURFACE_STROKE_WIDTH = 0.5;

function assertSurfaceFill(value: unknown): SurfaceFill {
  if (value === 'canvas' || value === 'surface' || value === 'ink') {
    return value;
  }
  throw new Error('Surface fill must be "canvas", "surface", or "ink"');
}

function assertSurfaceRadius(value: unknown): SurfaceRadius {
  if (
    typeof value === 'string' &&
    (SURFACE_RADII as readonly string[]).includes(value)
  ) {
    return value as SurfaceRadius;
  }
  throw new Error(
    `Surface radius must be one of ${SURFACE_RADII.join(', ')}`,
  );
}

function assertSurfaceElevated(value: unknown): false {
  if (value === undefined || value === false) {
    return false;
  }
  if (value === true) {
    throw new Error(
      'Surface elevated=true is unsupported: no Corso/Elevation/Soft token exists in source',
    );
  }
  throw new Error('Surface elevated must be a boolean');
}

export function resolveSurfacePresentation(input: {
  fill?: unknown;
  radius?: unknown;
  elevated?: unknown;
}): SurfacePresentation {
  const fill = assertSurfaceFill(
    input.fill === undefined ? 'surface' : input.fill,
  );
  const radius = assertSurfaceRadius(
    input.radius === undefined ? 'md' : input.radius,
  );
  assertSurfaceElevated(input.elevated);

  return {
    backgroundColor: colors[fill],
    borderRadius: radii[radius],
    borderWidth: KIT_DARK_SURFACE_STROKE_WIDTH,
    borderColor: colors.line,
  };
}
