import type { TextStyle, ViewStyle } from 'react-native';
import {
  CANON_TYPE_SIZES,
  canonTracking,
  canonWeight,
} from '@/src/ui/cards/canonType.js';
import { ONGLASS, ONGLASS_MID } from '@/src/ui/glass/materialTokens.js';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export const SAFE_REVEAL_STEPS = ['warning', 'gate', 'revealed'] as const;

export type SafeRevealStep = (typeof SAFE_REVEAL_STEPS)[number];

export const SAFE_REVEAL_STEP_COUNT = SAFE_REVEAL_STEPS.length;

/**
 * Which dot is lit, from the state the screen already holds. Pure, and it reads
 * the same booleans the screen already computed — it never re-derives whether a
 * word may be shown.
 */
export function resolveSafeRevealStepIndex(input: {
  stage: unknown;
  wordsVisible: unknown;
}): number {
  if (input.wordsVisible === true) return 2;
  return input.stage === 'reveal' ? 1 : 0;
}

export type SafeRevealChrome = {
  leadStyle: TextStyle;
  faceIdCardStyle: ViewStyle;
  faceIdGlyphStyle: ViewStyle;
  faceIdTitleStyle: TextStyle;
  faceIdSubStyle: TextStyle;
  leadDimStyle: TextStyle;
  bodyCopyStyle: TextStyle;
  warnLineStyle: ViewStyle;
  warnTextStyle: TextStyle;
  gateStyle: ViewStyle;
  gateItemStyle: ViewStyle;
  gateIndexStyle: ViewStyle;
  gateIndexTextStyle: TextStyle;
  gateTextStyle: TextStyle;
  seedPaneStyle: ViewStyle;
  seedGridStyle: ViewStyle;
  seedCellStyle: ViewStyle;
  seedIndexStyle: TextStyle;
  seedWordStyle: TextStyle;
  shotNoteStyle: ViewStyle;
  shotNoteTextStyle: TextStyle;
  quietLinkStyle: ViewStyle;
  quietLinkTextStyle: TextStyle;
  claimStyle: TextStyle;
  doneCardStyle: ViewStyle;
  doneDotStyle: ViewStyle;
  doneWordStyle: TextStyle;
  doneSubStyle: TextStyle;
  footerStyle: ViewStyle;
};

export function resolveSafeRevealChrome(): SafeRevealChrome {
  return {
    leadStyle: {
      color: colors.ink,
      fontSize: CANON_TYPE_SIZES.askTitle,
      lineHeight: Math.round(CANON_TYPE_SIZES.askTitle * 1.16),
      letterSpacing: canonTracking(CANON_TYPE_SIZES.askTitle, -0.024),
      fontFamily: typography.face('620'),
      fontWeight: canonWeight('620'),
    },
    leadDimStyle: { color: colors.inkQuaternary },
    bodyCopyStyle: {
      color: colors.inkTertiary,
      fontSize: CANON_TYPE_SIZES.body,
      lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.5),
      fontFamily: typography.face('450'),
      fontWeight: canonWeight('450'),
      marginTop: spacing.sm,
    },
    faceIdCardStyle: {
      alignItems: 'center',
      gap: 14,
      paddingTop: 34,
      paddingHorizontal: 18,
      paddingBottom: 30,
    },
    faceIdGlyphStyle: {
      width: 64,
      height: 64,
      borderRadius: radii.smallPane,
      backgroundColor: ONGLASS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    faceIdTitleStyle: {
      color: colors.ink,
      fontSize: CANON_TYPE_SIZES.cardTitle,
      lineHeight: 19,
      letterSpacing: canonTracking(CANON_TYPE_SIZES.cardTitle, -0.01),
      fontFamily: typography.face('620'),
      fontWeight: canonWeight('620'),
    },
    faceIdSubStyle: {
      color: colors.inkTertiary,
      fontSize: CANON_TYPE_SIZES.meta,
      lineHeight: 17,
      textAlign: 'center',
      fontFamily: typography.face('500'),
      fontWeight: canonWeight('500'),
    },
    warnLineStyle: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    warnTextStyle: {
      flex: 1,
      color: colors.priceDown,
      fontSize: CANON_TYPE_SIZES.body,
      lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.45),
      fontFamily: typography.face('560'),
      fontWeight: canonWeight('560'),
    },
    /** `.gate{gap:8px}` */
    gateStyle: { gap: spacing.sm, marginTop: spacing.lg },
    /** `.gk{border-radius:18px;padding:13px 14px;gap:12px}` */
    gateItemStyle: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    gateIndexStyle: {
      width: 22,
      height: 22,
      borderRadius: radii.sm,
      backgroundColor: ONGLASS_MID,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    gateIndexTextStyle: {
      color: colors.inkTertiary,
      fontSize: CANON_TYPE_SIZES.groupLabel,
      lineHeight: 13,
      fontFamily: typography.face('640'),
      fontWeight: canonWeight('640'),
    },
    gateTextStyle: {
      flex: 1,
      color: colors.inkSecondary,
      fontSize: CANON_TYPE_SIZES.body,
      lineHeight: Math.round(CANON_TYPE_SIZES.body * 1.4),
      fontFamily: typography.face('550'),
      fontWeight: canonWeight('550'),
    },
    /** `.seedwrap{border-radius:22px;padding:16px 16px 14px}` */
    seedPaneStyle: {
      padding: spacing.md,
      paddingBottom: 14,
      gap: spacing.smd,
    },
    /** `.seedgrid{grid-template-columns:1fr 1fr 1fr;gap:7px}` */
    seedGridStyle: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
    },
    seedCellStyle: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: radii.menuRow,
      backgroundColor: ONGLASS,
    },
    seedIndexStyle: {
      color: colors.inkTertiary,
      fontSize: 11,
      lineHeight: 14,
      fontFamily: typography.face('600'),
      fontWeight: canonWeight('600'),
    },
    seedWordStyle: {
      color: colors.ink,
      fontSize: CANON_TYPE_SIZES.meta,
      lineHeight: 16,
      fontFamily: typography.face('560'),
      fontWeight: canonWeight('560'),
    },
    shotNoteStyle: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: 14,
      paddingHorizontal: 2,
    },
    shotNoteTextStyle: {
      flex: 1,
      color: colors.inkTertiary,
      fontSize: CANON_TYPE_SIZES.sub,
      lineHeight: 17,
      fontFamily: typography.face('500'),
      fontWeight: canonWeight('500'),
    },
    quietLinkStyle: {
      alignSelf: 'center',
      marginTop: spacing.sm + 2,
      paddingVertical: 6,
      paddingHorizontal: spacing.sm + 2,
    },
    /**
     * `muted`, not `--ink28`. De-emphasised is a legitimate design intent and
     * it survives — but this is an interactive control, and an interactive
     * control owes 4.5:1 no matter how quiet it wants to be. It is also the
     * non-visual path to the phrase for a VoiceOver user (the grid itself is
     * deliberately unspoken), so it was the least visible control on the screen
     * and the one a low-vision user most needs to find.
     */
    quietLinkTextStyle: {
      color: colors.muted,
      fontSize: CANON_TYPE_SIZES.sub,
      lineHeight: 16,
      fontFamily: typography.face('500'),
      fontWeight: canonWeight('500'),
    },
    claimStyle: {
      marginTop: spacing.smd,
      textAlign: 'center',
      color: colors.inkTertiary,
      fontSize: CANON_TYPE_SIZES.sub,
      lineHeight: 17,
      fontFamily: typography.face('500'),
      fontWeight: canonWeight('500'),
    },
    /** `.done-card{border-radius:22px;padding:40px 18px 34px;gap:12px}` */
    doneCardStyle: {
      alignItems: 'center',
      gap: spacing.smd,
      paddingTop: 40,
      paddingHorizontal: 18,
      paddingBottom: 34,
    },
    doneDotStyle: {
      width: 11,
      height: 11,
      borderRadius: radii.pill,
      backgroundColor: colors.priceUp,
    },
    /** `.done-word{font-size:23px;font-weight:680;letter-spacing:-.02em}` */
    doneWordStyle: {
      color: colors.ink,
      fontSize: CANON_TYPE_SIZES.verdictWord,
      lineHeight: 26,
      letterSpacing: canonTracking(CANON_TYPE_SIZES.verdictWord, -0.02),
      fontFamily: typography.face('680'),
      fontWeight: canonWeight('680'),
    },
    doneSubStyle: {
      color: colors.inkTertiary,
      fontSize: CANON_TYPE_SIZES.body,
      lineHeight: 19,
      textAlign: 'center',
      fontFamily: typography.face('500'),
      fontWeight: canonWeight('500'),
    },
    footerStyle: {
      paddingTop: 18,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
  };
}
