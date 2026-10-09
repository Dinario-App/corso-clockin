import { MATERIAL_WEIGHTS, type MaterialWeightName } from './materialTokens';
import { GLASS_RADIUS_NESTED } from './glassTokens';

export type LensPresentation = {
  weight: MaterialWeightName;
  nested: boolean;
  hug: boolean;
  borderRadius: number;
};

export function isPillRadius(radius: number | undefined): boolean {
  return radius !== undefined && radius >= MATERIAL_WEIGHTS.pill.radius;
}

export function resolveLensPresentation(input: {
  nested?: boolean;
  radius?: number;
  /** Content-height: no flex-fill in either wrapper. Default fills. */
  hug?: boolean;
}): LensPresentation {
  const nested = input.nested === true;

  return {
    weight: isPillRadius(input.radius) ? 'pill' : 'card',
    nested,
    hug: input.hug === true,
    borderRadius:
      input.radius ??
      (nested ? GLASS_RADIUS_NESTED : MATERIAL_WEIGHTS.card.radius),
  };
}
