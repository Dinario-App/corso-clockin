import { colors, spacing, typography } from '@/src/ui/tokens';

export const ERROR_STATE_WIDTH = 353;
/** Title-to-body stack gap (section rhythm). */
export const ERROR_STATE_TITLE_BODY_GAP = spacing.sm;
/** Body-to-CTA stack gap before the single allowed CTA instance. */
export const ERROR_STATE_BODY_CTA_GAP = spacing.md;

export const ERROR_STATE_RETRY_ALLOWLIST = [
  'withRetry',
  'withoutRetry',
] as const;

export type ErrorStateRetry = (typeof ERROR_STATE_RETRY_ALLOWLIST)[number];

export const ERROR_STATE_CTA_ALLOWLIST = [
  'secondary',
  'text',
] as const;

export type ErrorStateCtaKind = (typeof ERROR_STATE_CTA_ALLOWLIST)[number];

export type ErrorStatePresentationInput = {
  retry: unknown;
  title: unknown;
  body: unknown;
  ctaLabel?: unknown;
  cta?: unknown;
  onPress?: unknown;
};

export type ErrorStateCtaStyleOverride = {
  marginTop?: number;
  marginBottom?: number;
};

type ErrorStatePresentationBase = {
  containerStyle: {
    width: '100%';
    maxWidth: number;
    alignSelf: 'center';
    alignItems: 'center';
  };
  titleStyle: {
    color: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    fontWeight: '600';
    textAlign: 'center';
    letterSpacing: number;
  };
  bodyStyle: {
    color: string;
    fontSize: number;
    lineHeight: number;
    fontFamily: string;
    fontWeight: '400';
    textAlign: 'center';
  };
  bodyLayout: {
    numberOfLines: 1;
    ellipsizeMode: 'tail';
  };
  titleBodyGap: number;
  displayTitle: string;
  displayBody: string;
  bodyAccessibilityLabel: string;
};

export type ErrorStatePresentationWithRetry = ErrorStatePresentationBase & {
  retry: 'withRetry';
  bodyCtaGap: number;
  ctaLabel: string;
  ctaKind: ErrorStateCtaKind;
  ctaStyleOverride: ErrorStateCtaStyleOverride;
};

export type ErrorStatePresentationWithoutRetry = ErrorStatePresentationBase & {
  retry: 'withoutRetry';
  bodyCtaGap?: undefined;
  ctaLabel?: undefined;
  ctaKind?: undefined;
  ctaStyleOverride?: undefined;
};

export type ErrorStatePresentation =
  | ErrorStatePresentationWithRetry
  | ErrorStatePresentationWithoutRetry;

/** Trim valid strings; null for empty, whitespace-only, or non-string input. */
export function normalizeErrorStateText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function assertRetry(retry: unknown): ErrorStateRetry {
  if (
    typeof retry !== 'string' ||
    !(ERROR_STATE_RETRY_ALLOWLIST as readonly string[]).includes(retry)
  ) {
    throw new Error(`Unknown ErrorState retry: ${String(retry)}`);
  }
  return retry as ErrorStateRetry;
}

function assertCtaKind(cta: unknown): ErrorStateCtaKind {
  if (
    typeof cta !== 'string' ||
    !(ERROR_STATE_CTA_ALLOWLIST as readonly string[]).includes(cta)
  ) {
    throw new Error(`Unknown ErrorState cta: ${String(cta)}`);
  }
  return cta as ErrorStateCtaKind;
}

function assertWithoutRetryHasNoCtaFields(input: ErrorStatePresentationInput): void {
  if (
    input.cta !== undefined ||
    input.ctaLabel !== undefined ||
    input.onPress !== undefined
  ) {
    throw new Error('ErrorState withoutRetry forbids cta fields');
  }
}

function resolveCtaStyleOverride(
  kind: ErrorStateCtaKind,
): ErrorStateCtaStyleOverride {
  switch (kind) {
    case 'text':
      // TextButton ships marginTop: spacing.sm — gap is owned by bodyCtaGap.
      return { marginTop: 0 };
    case 'secondary':
      // SecondaryCTA ships marginBottom: spacing.sm — no trailing phantom height.
      return { marginBottom: 0 };
  }
}

function buildPresentationBase(
  displayTitle: string,
  displayBody: string,
): ErrorStatePresentationBase {
  return {
    containerStyle: {
      width: '100%',
      maxWidth: ERROR_STATE_WIDTH,
      alignSelf: 'center',
      alignItems: 'center',
    },
    titleStyle: {
      color: colors.ink,
      fontSize: typography.title,
      lineHeight: 28,
      fontFamily: typography.face('600'),
      fontWeight: '600',
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    bodyStyle: {
      color: colors.muted,
      fontSize: typography.body,
      lineHeight: 22,
      fontFamily: typography.face('400'),
      fontWeight: '400',
      textAlign: 'center',
    },
    bodyLayout: {
      numberOfLines: 1,
      ellipsizeMode: 'tail',
    },
    titleBodyGap: ERROR_STATE_TITLE_BODY_GAP,
    displayTitle,
    displayBody,
    bodyAccessibilityLabel: displayBody,
  };
}

export function resolveErrorStatePresentation(
  input: ErrorStatePresentationInput,
): ErrorStatePresentation | null {
  const retry = assertRetry(input.retry);

  if (retry === 'withoutRetry') {
    assertWithoutRetryHasNoCtaFields(input);

    const displayTitle = normalizeErrorStateText(input.title);
    const displayBody = normalizeErrorStateText(input.body);

    if (displayTitle === null || displayBody === null) {
      return null;
    }

    return {
      ...buildPresentationBase(displayTitle, displayBody),
      retry: 'withoutRetry',
    };
  }

  const ctaKind = assertCtaKind(input.cta);

  const displayTitle = normalizeErrorStateText(input.title);
  const displayBody = normalizeErrorStateText(input.body);
  const ctaLabel = normalizeErrorStateText(input.ctaLabel);

  if (displayTitle === null || displayBody === null || ctaLabel === null) {
    return null;
  }

  return {
    ...buildPresentationBase(displayTitle, displayBody),
    retry: 'withRetry',
    bodyCtaGap: ERROR_STATE_BODY_CTA_GAP,
    ctaLabel,
    ctaKind,
    ctaStyleOverride: resolveCtaStyleOverride(ctaKind),
  };
}
