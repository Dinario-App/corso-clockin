import type { TextStyle, ViewStyle } from 'react-native';
import { ethena } from '@/constants/theme.ethena';
import { ethenaGeometry } from '@/constants/theme.ethenaGeometry';
import { ETHENA_TYPE } from '@/constants/theme.ethenaType';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import { canonWeight } from '@/src/ui/cards/canonType.js';
import { resolveEthenaMaterial } from '@/src/ui/ethena/materialLaw';
import { ACCESSIBLE_RIM } from '@/src/ui/glass/materialTokens';
import { spacing, typography } from '@/src/ui/tokens';

/** The back affordance is the header chrome disc. */
export const SCREEN_HEADER_BACK_GLYPH: CorsoIconName = 'chevron-left';
export const SCREEN_HEADER_BACK_SIZE = 40;
/** The disc's chevron — the 20pt glyph both desk shells draw. */
export const SCREEN_HEADER_BACK_GLYPH_SIZE = 20;
/**
 * The 40 disc is 4pt under the 44pt tap floor, so the PRESSABLE is 44 and
 * the disc is drawn inside it. A hit slop instead would leave the visual and
 * the target disagreeing about where the control is.
 */
export const SCREEN_HEADER_BACK_HIT_SIZE = 44;
export const SCREEN_HEADER_GAP = 10;
export const SCREEN_HEADER_PADDING_TOP = 10;

export type ScreenHeaderFamily = 'grok' | 'desk';

export type ScreenHeaderInput = {
  /**
   * How much the CONTAINING surface has already inset its content. 0 on a
   * screen (the default); `BOTTOM_SHEET_CONTENT_INSET` inside a sheet.
   */
  surfaceInset?: number;
  family?: ScreenHeaderFamily;
  increaseContrast?: boolean;
};

export type ScreenHeaderStyles = {
  rowStyle: ViewStyle;
  /** The 44pt pressable, centred on the 40pt disc. */
  backHitStyle: ViewStyle;
  /** The 40pt ground-plane disc — fill and rim from the material law. */
  backCircleStyle: ViewStyle;
  /** The chevron's ink. */
  backGlyphColor: string;
  /** `ETHENA_TYPE.navMid` — 17/600, ink primary. */
  titleStyle: TextStyle;
  spacerStyle: ViewStyle;
};

export function resolveScreenHeader(
  input: ScreenHeaderInput = {},
): ScreenHeaderStyles {
  const surfaceInset =
    typeof input.surfaceInset === 'number' &&
    Number.isFinite(input.surfaceInset)
      ? Math.max(0, input.surfaceInset)
      : 0;
  /** Clamped at 0 so a wider surface inset can never produce negative padding. */
  const base = input.family === 'desk' ? ethenaGeometry.gutter : spacing.gutter;
  const gutter = Math.max(0, base - surfaceInset);
  const disc = resolveEthenaMaterial('ground');
  const increaseContrast = input.increaseContrast === true;
  return {
    rowStyle: {
      alignSelf: 'stretch',
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SCREEN_HEADER_GAP,
      paddingHorizontal: gutter,
      paddingTop: SCREEN_HEADER_PADDING_TOP,
    },
    backHitStyle: {
      width: SCREEN_HEADER_BACK_HIT_SIZE,
      height: SCREEN_HEADER_BACK_HIT_SIZE,
      /** The 44pt target is centred on the 40pt disc, so it reads as one control. */
      marginLeft: -(SCREEN_HEADER_BACK_HIT_SIZE - SCREEN_HEADER_BACK_SIZE) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    backCircleStyle: {
      width: SCREEN_HEADER_BACK_SIZE,
      height: SCREEN_HEADER_BACK_SIZE,
      borderRadius: SCREEN_HEADER_BACK_SIZE / 2,
      backgroundColor: disc.fill as string,
      borderWidth: increaseContrast
        ? Math.max(1, disc.borderWidth)
        : disc.borderWidth,
      borderColor: increaseContrast
        ? ACCESSIBLE_RIM
        : (disc.borderColor ?? undefined),
      alignItems: 'center',
      justifyContent: 'center',
    },
    backGlyphColor: ethena.ink.primary,
    titleStyle: {
      color: ethena.ink.primary,
      fontSize: ETHENA_TYPE.navMid.fontSize,
      lineHeight: 22,
      fontFamily: typography.face('600'),
      fontWeight: canonWeight('600'),
      flexShrink: 1,
    },
    spacerStyle: { flex: 1 },
  };
}
