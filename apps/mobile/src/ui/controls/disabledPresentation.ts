import { colors } from '@/src/ui/tokens';
import { KIT_RIM } from '@/src/ui/glass/materialTokens';

export type DisabledKind = 'cta' | 'pill' | 'circle' | 'segment' | 'toggle';
export type DisabledPaint = {
  readonly fill: string;
  readonly label: string;
  /** Non-text only — grey3 is 2.4:1 and never carries a word. */
  readonly glyph: string;
  readonly rim: string;
  readonly opacity: number;
};

const PAINT: Readonly<Record<DisabledKind, DisabledPaint>> = Object.freeze({
  cta: Object.freeze({ fill: colors.primaryDisabled, label: colors.primaryDisabledLabel, glyph: colors.inkQuaternary, rim: 'transparent', opacity: 1 }),
  pill: Object.freeze({ fill: colors.surface, label: colors.inkTertiary, glyph: colors.inkQuaternary, rim: KIT_RIM, opacity: 1 }),
  circle: Object.freeze({ fill: colors.surface, label: colors.inkTertiary, glyph: colors.inkQuaternary, rim: KIT_RIM, opacity: 1 }),
  segment: Object.freeze({ fill: colors.surfaceControl, label: colors.inkTertiary, glyph: colors.inkQuaternary, rim: 'transparent', opacity: 1 }),
  /** The one opacity: iOS dims a disabled UISwitch to 50%; the thumb still carries state. */
  toggle: Object.freeze({ fill: 'transparent', label: colors.inkTertiary, glyph: colors.inkQuaternary, rim: 'transparent', opacity: 0.5 }),
});

export function resolveDisabledPaint(kind: DisabledKind): DisabledPaint {
  return PAINT[kind];
}
