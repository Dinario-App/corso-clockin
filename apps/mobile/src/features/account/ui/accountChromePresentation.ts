import type { TextStyle, ViewStyle } from 'react-native';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType.js';
import {
  colors,
  kitType,
  kitWeight,
  radii,
  spacing,
  typography,
} from '@/src/ui/tokens';
import { ONGLASS_MID } from '@/src/ui/glass/materialTokens';

/** `.stepdots i{width:5px;height:5px}` · `.stepdots{gap:5px}` */
export const ACCOUNT_STEP_DOT_SIZE = 5;
export const ACCOUNT_STEP_DOT_GAP = 5;

export const ACCOUNT_SECT_MARGIN_TOP = 28;
export const ACCOUNT_SECT_MARGIN_BOTTOM = 12;

/** `.idcard{border-radius:20px;padding:16px;gap:13px}` */
export const ACCOUNT_IDCARD_PADDING = 16;
export const ACCOUNT_IDCARD_GAP = 13;
export const ACCOUNT_AVATAR_SIZE = 50;
export const ACCOUNT_AVATAR_RADIUS = 14;
export const ACCOUNT_AVATAR_GLYPH_SIZE = 18;
export const ACCOUNT_AVATAR_WASH = ONGLASS_MID;

export const ACCOUNT_COPY_FLASH_MS = 1600;

/** `.danger{margin-top:34px;border-radius:20px;padding:14px 16px;gap:8px}` */
export const ACCOUNT_DANGER_MARGIN_TOP = 34;
export const ACCOUNT_DANGER_GAP = 8;
export const ACCOUNT_DANGER_GLYPH_SIZE = 15;

export type AccountChromeStyles = {
  stepDotsStyle: ViewStyle;
  sectionHeadingStyle: TextStyle;
  idCardContentStyle: ViewStyle;
  avatarStyle: ViewStyle;
  identityNameStyle: TextStyle;
  addressButtonStyle: ViewStyle;
  addressTextStyle: TextStyle;
  addressCopiedStyle: TextStyle;
  dangerContentStyle: ViewStyle;
  dangerLabelStyle: TextStyle;
  dangerNoteStyle: TextStyle;
};

/** `.stepdots i` — `--hair-strong` until the step is behind you, then `--ink72`. */
export function stepDotStyle(active: boolean): ViewStyle {
  return {
    width: ACCOUNT_STEP_DOT_SIZE,
    height: ACCOUNT_STEP_DOT_SIZE,
    borderRadius: radii.pill,
    backgroundColor: active ? colors.inkSecondary : colors.surfaceStroke,
  };
}

/**
 * Every account-tier chrome style, resolved once.
 *
 * A fresh object per call: a style handed to a caller must not share a mutable
 * field with the next one (the same rule `accountRowPresentation` follows).
 */
export function resolveAccountChrome(): AccountChromeStyles {
  return {
    stepDotsStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ACCOUNT_STEP_DOT_GAP,
      flexShrink: 0,
    },
    sectionHeadingStyle: {
      color: colors.inkTertiary,
      fontSize: 15,
      fontFamily: typography.face('500'),
      fontWeight: '500',
      marginTop: ACCOUNT_SECT_MARGIN_TOP,
      marginBottom: ACCOUNT_SECT_MARGIN_BOTTOM,
    },
    idCardContentStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ACCOUNT_IDCARD_GAP,
      padding: ACCOUNT_IDCARD_PADDING,
    },
    avatarStyle: {
      width: ACCOUNT_AVATAR_SIZE,
      height: ACCOUNT_AVATAR_SIZE,
      borderRadius: ACCOUNT_AVATAR_RADIUS,
      backgroundColor: ACCOUNT_AVATAR_WASH,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    identityNameStyle: {
      color: colors.ink,
      fontSize: kitType.headline,
      lineHeight: 22,
      letterSpacing: canonTracking(kitType.headline, -0.012),
      fontFamily: typography.face(kitWeight.medium),
      fontWeight: kitWeight.medium,
    },
    /** `.addr-btn{gap:6px;margin-top:3px;padding:2px 0}` */
    addressButtonStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    addressTextStyle: {
      color: colors.inkSecondary,
      fontSize: kitType.sub,
      lineHeight: 20,
      fontFamily: typography.face(kitWeight.medium),
      fontWeight: kitWeight.medium,
    },
    addressCopiedStyle: {
      color: colors.priceUp,
      fontSize: CANON_TYPE_SIZES.sub,
      lineHeight: 16,
      fontFamily: typography.face('600'),
      fontWeight: canonWeight('600'),
    },
    dangerContentStyle: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ACCOUNT_DANGER_GAP,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    dangerLabelStyle: {
      color: colors.priceDown,
      fontSize: CANON_TYPE_SIZES.rowLabel,
      lineHeight: 18,
      fontFamily: typography.face('500'),
      fontWeight: canonWeight('500'),
    },
    dangerNoteStyle: {
      color: colors.inkTertiary,
      fontSize: CANON_TYPE_SIZES.micro,
      lineHeight: 16,
      fontFamily: typography.face('500'),
      fontWeight: canonWeight('500'),
      textAlign: 'center',
      marginTop: spacing.sm + 2,
    },
  };
}
