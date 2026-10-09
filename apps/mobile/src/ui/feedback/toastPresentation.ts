import { MOTION_DURATION_MS } from '@/src/motion/motionTokens.js';
import { colors, radii, spacing, typography } from '@/src/ui/tokens';

export const TOAST_HEIGHT = 44;
export const TOAST_RADIUS = radii.hold;
/** Standard 393pt frame content width (20pt gutters). */
export const TOAST_MAX_WIDTH = 353;
export const TOAST_LINE_HEIGHT = 18;
export const TOAST_TEXT_VERTICAL_OFFSET = 13;
export const TOAST_TEXT_SIZE = typography.body;

export type ToastTone = 'neutral' | 'error';

export type ToastPresentation = {
  containerStyle: {
    alignSelf: 'flex-start';
    maxWidth: number;
    height: number;
    minHeight: number;
    borderRadius: number;
    backgroundColor: string;
    paddingHorizontal: number;
    paddingVertical: number;
  };
  textStyle: {
    color: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
  };
  textLayout: {
    numberOfLines: 1;
    ellipsizeMode: 'tail';
  };
  displayMessage: string;
  tone: ToastTone;
  accessible: true;
  role: 'status';
  accessibilityLiveRegion: 'polite';
  accessibilityLabel: string;
  focusable: false;
  holdDurationMs: number;
};

/** Trim valid strings; null for empty, whitespace-only, or non-string input. */
export function normalizeToastMessage(message: unknown): string | null {
  if (typeof message !== 'string') {
    return null;
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

export function resolveToastPresentation(
  message: unknown,
  tone: ToastTone = 'neutral',
): ToastPresentation | null {
  const label = normalizeToastMessage(message);
  if (label === null) {
    return null;
  }

  return {
    containerStyle: {
      alignSelf: 'flex-start',
      maxWidth: TOAST_MAX_WIDTH,
      height: TOAST_HEIGHT,
      minHeight: TOAST_HEIGHT,
      borderRadius: TOAST_RADIUS,
      backgroundColor: colors.ink,
      paddingHorizontal: spacing.lg,
      paddingVertical: TOAST_TEXT_VERTICAL_OFFSET,
    },
    textStyle: {
      color: colors.canvas,
      fontSize: TOAST_TEXT_SIZE,
      lineHeight: TOAST_LINE_HEIGHT,
      fontFamily: typography.fontFamily,
    },
    textLayout: {
      numberOfLines: 1,
      ellipsizeMode: 'tail',
    },
    displayMessage: label,
    tone,
    accessible: true,
    role: 'status',
    accessibilityLiveRegion: 'polite',
    accessibilityLabel: label,
    focusable: false,
    holdDurationMs: MOTION_DURATION_MS.toastHold,
  };
}

export type TimerApi = {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timer: unknown) => void;
};

const defaultTimerApi: TimerApi = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer as Parameters<typeof clearTimeout>[0]),
};

/** Pure dismiss scheduler — cleared by the returned cleanup. */
export function scheduleToastDismiss(
  holdDurationMs: number,
  onDismiss: () => void,
  timerApi: TimerApi = defaultTimerApi,
): () => void {
  const timer = timerApi.setTimeout(onDismiss, holdDurationMs);
  return () => timerApi.clearTimeout(timer);
}
