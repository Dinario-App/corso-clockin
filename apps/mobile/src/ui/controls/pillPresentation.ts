import type { TextStyle, ViewStyle } from 'react-native';
import {
  ONGLASS,
  ONGLASS_MID,
  type MaterialState,
  type MaterialWeightName,
} from '@/src/ui/glass/materialTokens.js';
import {
  MIN_TAP_TARGET_PT,
  resolveTapTargetInsets,
  type TapTargetInsets,
} from '@/src/ui/primitives/tapTargetPresentation.js';
import { colors, radii, typography } from '@/src/ui/tokens';
import { resolveDisabledPaint } from './disabledPresentation.js';

export type PillVariant =
  | 'mover'
  | 'quickAction'
  | 'quickActionSkills'
  | 'queryEcho'
  | 'wallet'
  | 'evidence';

export type PillValueTone = 'up' | 'down' | 'neutral' | 'caution';

export type PillPresentation = {
  /** Which material weight the pill mounts, or `null` for the on-glass chip. */
  weight: MaterialWeightName | null;
  /** `hi` is the lifted read: pressed, open, or an always-lifted variant. */
  state: MaterialState;
  /** Flat wash for the on-glass chip. `null` whenever `weight` is set. */
  washColor: string | null;
  radius: number;
  /** Padding + gap for the pill's own row. */
  containerStyle: ViewStyle;
  /** The pill's label. */
  labelStyle: TextStyle;
  /**
   * The trailing value — a mover's percent, the wallet's amount. `null` on the
   * variants that carry no value.
   */
  valueStyle: TextStyle | null;
  /** Leading glyph size + colour, or `null` where the variant draws none. */
  leading: { size: number; color: string } | null;
  height: number;
  /** Invisible expansion so a 36pt pill still hits 44. */
  hitSlop: TapTargetInsets;
};

const GEOMETRY: Record<
  PillVariant,
  { paddingVertical: number; paddingHorizontal: number; gap: number }
> = {
  /** `padding: 8px 13px; gap: 7px` */
  mover: { paddingVertical: 8, paddingHorizontal: 13, gap: 7 },
  /** `padding: 8px 13px; gap: 6px` */
  quickAction: { paddingVertical: 8, paddingHorizontal: 13, gap: 6 },
  quickActionSkills: { paddingVertical: 8, paddingHorizontal: 13, gap: 6 },
  /** `padding: 6px 12px; gap: 7px` */
  queryEcho: { paddingVertical: 6, paddingHorizontal: 12, gap: 7 },
  /** `padding: 6px 11px; gap: 7px` */
  wallet: { paddingVertical: 6, paddingHorizontal: 11, gap: 7 },
  /** `padding: 6px 11px; gap: 6px` */
  evidence: { paddingVertical: 6, paddingHorizontal: 11, gap: 6 },
};

export const PILL_HEIGHTS = { lg: 52, md: 44, sm: 36 } as const;
export type PillSize = keyof typeof PILL_HEIGHTS;
export const PILL_LABEL_SIZE = 17;
export const PILL_LABEL_WEIGHT = '500';
export const PILL_ICON_SIZE = 20;
export const PILL_GAP = 10;
export const PILL_PAD_H = { lg: 20, md: 16, sm: 13 } as const;

/** Trailing values (mover percent, wallet amount) — HEAD 12.5. */
const VALUE_SIZE = 12.5;
/** Chip leadings still sit on the old 13px body slot. */
const CHIP_LEADING_SIZE = 13;

export const WALLET_PILL_CUE_SIZE = 20;
/** The wallet cue's fill — an on-glass wash, so the cue never re-blurs. */
export const WALLET_PILL_CUE_FILL = ONGLASS_MID;
export const QUERY_ECHO_DOT_SIZE = 5;

export function resolvePillValueColor(tone: PillValueTone): string {
  switch (tone) {
    case 'up':
      return colors.priceUp;
    case 'down':
      return colors.priceDown;
    case 'caution':
      return colors.riskDanger;
    default:
      return colors.inkTertiary;
  }
}

export type PillPresentationInput = {
  variant: PillVariant;
  lifted?: boolean;
  /** The tone of the trailing value, where the variant carries one. */
  valueTone?: PillValueTone;
  size?: PillSize;
  /** Inert paint via `resolveDisabledPaint('pill')`. Shape stays. */
  disabled?: boolean;
};

export function resolvePillPresentation(
  input: PillPresentationInput,
): PillPresentation {
  const variant = assertPillVariant(input.variant);
  const geometry = GEOMETRY[variant];
  const size = input.size ?? 'md';
  const height = PILL_HEIGHTS[size];
  const disabled = input.disabled === true;

  const lifted = input.lifted === true || variant === 'queryEcho';
  const isEvidence = variant === 'evidence';

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingVertical: geometry.paddingVertical,
    paddingHorizontal: geometry.paddingHorizontal,
    gap: geometry.gap,
  };

  return {
    weight: isEvidence ? null : 'pill',
    state: lifted ? 'hi' : 'rest',
    washColor: isEvidence ? ONGLASS : null,
    radius: radii.pill,
    containerStyle,
    labelStyle: resolveLabelStyle(variant, disabled),
    valueStyle: resolveValueStyle(variant, input.valueTone ?? 'neutral'),
    leading: resolveLeading(variant),
    height,
    hitSlop: resolveTapTargetInsets({
      visualWidth: MIN_TAP_TARGET_PT,
      visualHeight: height,
    }),
  };
}

function resolveLabelStyle(
  variant: PillVariant,
  disabled: boolean,
): TextStyle {
  const color = disabled ? resolveDisabledPaint('pill').label : colors.ink;
  switch (variant) {
    case 'mover':
      return text(
        PILL_LABEL_SIZE,
        PILL_LABEL_WEIGHT,
        disabled ? resolveDisabledPaint('pill').label : colors.inkSecondary,
      );
    case 'quickAction':
      return text(PILL_LABEL_SIZE, PILL_LABEL_WEIGHT, color);
    case 'quickActionSkills':
      return text(PILL_LABEL_SIZE, PILL_LABEL_WEIGHT, color);
    case 'queryEcho':
      return text(
        PILL_LABEL_SIZE,
        PILL_LABEL_WEIGHT,
        disabled ? resolveDisabledPaint('pill').label : colors.inkSecondary,
      );
    case 'wallet':
      return text(PILL_LABEL_SIZE, PILL_LABEL_WEIGHT, color);
    default:
      return text(PILL_LABEL_SIZE, PILL_LABEL_WEIGHT, color);
  }
}

function resolveValueStyle(
  variant: PillVariant,
  tone: PillValueTone,
): TextStyle | null {
  switch (variant) {
    /** `pct 12.5px/600` in `--up` / `--down`. */
    case 'mover':
      return {
        ...text(VALUE_SIZE, '600', resolvePillValueColor(tone)),
        /**
         * The house cast (`src/theme/CorsoText.tsx`): React Native's
         * `FontVariant` union omits `slashed-zero` even though the runtime
         * honours it, and every slashed-zero call site in the app spells it
         * this way.
         */
        fontVariant: [
          ...typography.fontVariantNumerals,
        ] as TextStyle['fontVariant'],
      };
    /**
     * The wallet's amount is `--ink72`/600 and its delta is `--up`/600. The
     * amount is the value slot; the delta reads `resolvePillValueColor` at the
     * call site, which is why the tone is not baked in here.
     */
    case 'wallet':
      return {
        ...text(VALUE_SIZE, '600', colors.inkSecondary),
        /**
         * The house cast (`src/theme/CorsoText.tsx`): React Native's
         * `FontVariant` union omits `slashed-zero` even though the runtime
         * honours it, and every slashed-zero call site in the app spells it
         * this way.
         */
        fontVariant: [
          ...typography.fontVariantNumerals,
        ] as TextStyle['fontVariant'],
      };
    case 'evidence':
      return {
        ...text(VALUE_SIZE, '600', colors.ink),
        /**
         * The house cast (`src/theme/CorsoText.tsx`): React Native's
         * `FontVariant` union omits `slashed-zero` even though the runtime
         * honours it, and every slashed-zero call site in the app spells it
         * this way.
         */
        fontVariant: [
          ...typography.fontVariantNumerals,
        ] as TextStyle['fontVariant'],
      };
    default:
      return null;
  }
}

function resolveLeading(
  variant: PillVariant,
): { size: number; color: string } | null {
  switch (variant) {
    /** `leading 13px icon in --ink48` */
    case 'quickAction':
      return { size: CHIP_LEADING_SIZE, color: colors.inkTertiary };
    /** The Skills variant lifts only the label; its icon stays `--ink72`. */
    case 'quickActionSkills':
      return { size: CHIP_LEADING_SIZE, color: colors.inkSecondary };
    /** `5px --ink48 leading dot` */
    case 'queryEcho':
      return { size: QUERY_ECHO_DOT_SIZE, color: colors.inkTertiary };
    /** `glyph 11px`; the tone is the caller's (ok/warn/neutral). */
    case 'evidence':
      return { size: 11, color: colors.inkTertiary };
    default:
      return null;
  }
}

function text(size: number, weight: string, color: string): TextStyle {
  return {
    color,
    fontSize: size,
    fontFamily: typography.face(weight),
    fontWeight: weight as TextStyle['fontWeight'],
    letterSpacing: -0.1,
  };
}

const PILL_VARIANTS: readonly PillVariant[] = [
  'mover',
  'quickAction',
  'quickActionSkills',
  'queryEcho',
  'wallet',
  'evidence',
];

export function assertPillVariant(value: unknown): PillVariant {
  if (
    typeof value === 'string' &&
    (PILL_VARIANTS as readonly string[]).includes(value)
  ) {
    return value as PillVariant;
  }
  throw new Error(`Invalid pill variant: ${String(value)}`);
}

export { PILL_VARIANTS };
