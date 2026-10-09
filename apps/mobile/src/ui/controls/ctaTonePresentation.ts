import type { ViewStyle } from 'react-native';
import { resolveCorsoGlass } from '@/src/ui/glass/corsoGlassRecipe';
import type { CtaPressVariant } from '@/src/ui/controls/ctaPressPresentation.js';
import { resolveDisabledPaint } from '@/src/ui/controls/disabledPresentation.js';

export type CtaTone = 'neutral' | 'transactional';

export const CTA_HEIGHT = 52;
/** On-icy label, 17/600. The paint is CorsoGlass `icy-cta`, not a fill here. */
export const CTA_LABEL_SIZE = 17;
export const CTA_LABEL_WEIGHT = '600';

export type CtaTonePresentation = {
  containerStyle: ViewStyle;
  /** `icy-cta` when armed; `null` when disabled (inert is not icy). */
  material: 'icy-cta' | null;
  /** The label / spinner colour on that fill. */
  labelColor: string;
  /** Which pressed carrier this tone answers with. */
  pressVariant: CtaPressVariant;
  dimWhenDisabled: boolean;
};

export function resolveCtaTonePresentation(input: {
  tone: CtaTone;
  disabled?: boolean;
}): CtaTonePresentation {
  const tone = assertCtaTone(input.tone);
  const pressVariant = tone === 'transactional' ? 'transactional' : 'primary';

  if (input.disabled === true) {
    const paint = resolveDisabledPaint('cta');
    return {
      containerStyle: { backgroundColor: paint.fill },
      material: null,
      labelColor: paint.label,
      pressVariant,
      dimWhenDisabled: false,
    };
  }

  return {
    containerStyle: {},
    material: 'icy-cta',
    labelColor: resolveCorsoGlass('icy-cta').label,
    pressVariant,
    dimWhenDisabled: false,
  };
}

/** An invented tone would silently fall through to neutral. Reject it. */
export function assertCtaTone(value: unknown): CtaTone {
  if (value === 'neutral' || value === 'transactional') return value;
  throw new Error(`Invalid CTA tone: ${String(value)}`);
}
