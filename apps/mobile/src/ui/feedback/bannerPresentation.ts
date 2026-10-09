import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export const BANNER_WIDTH = 353;
/** Panel inset — matches OfflineState Banner-tone surface padding. */
export const BANNER_PADDING = spacing.md;
/** Stable neutral 1pt stroke on surface for both tones. */
export const BANNER_BORDER_WIDTH = 1;

export type BannerTone = 'info' | 'warning';

export type BannerPresentation = {
  containerStyle: {
    width: '100%';
    maxWidth: number;
    alignSelf: 'center';
    backgroundColor: string;
    borderRadius: number;
    padding: number;
    borderWidth?: number;
    borderColor?: string;
  };
  textStyle: {
    color: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    fontWeight: '400';
  };
  displayMessage: string;
  tone: BannerTone;
  accessible: true;
  role: 'status' | 'alert';
  accessibilityLiveRegion: 'polite' | 'assertive';
  accessibilityLabel: string;
  focusable: false;
};

/** Reject unknown tones before message normalization. */
export function assertBannerTone(tone: unknown): asserts tone is BannerTone {
  if (tone !== 'info' && tone !== 'warning') {
    throw new Error(`Invalid banner tone: ${String(tone)}`);
  }
}

/** Trim valid strings; null for empty, whitespace-only, or non-string input. */
export function normalizeBannerMessage(message: unknown): string | null {
  if (typeof message !== 'string') {
    return null;
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

export function resolveBannerPresentation(
  message: unknown,
  tone: BannerTone = 'info',
): BannerPresentation | null {
  assertBannerTone(tone);

  const label = normalizeBannerMessage(message);
  if (label === null) {
    return null;
  }

  const isWarning = tone === 'warning';

  return {
    containerStyle: {
      width: '100%',
      maxWidth: BANNER_WIDTH,
      alignSelf: 'center',
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: BANNER_PADDING,
      borderWidth: BANNER_BORDER_WIDTH,
      borderColor: colors.line,
    },
    textStyle: {
      color: colors.ink,
      fontSize: typography.body,
      lineHeight: 22,
      fontFamily: typography.face('400'),
      fontWeight: '400',
    },
    displayMessage: label,
    tone,
    accessible: true,
    role: isWarning ? 'alert' : 'status',
    accessibilityLiveRegion: isWarning ? 'assertive' : 'polite',
    accessibilityLabel: label,
    focusable: false,
  };
}
