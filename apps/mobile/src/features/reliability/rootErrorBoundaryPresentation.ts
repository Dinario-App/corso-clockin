import { copy } from '@/constants/copy';
import type { ErrorStateCtaKind } from '@/src/ui/state/errorStatePresentation';

export const ROOT_CRASH_TEST_ID = 'root-error-boundary';

export type RootCrashPresentation = {
  testID: string;
  retry: 'withRetry';
  cta: ErrorStateCtaKind;
  title: string;
  body: string;
  ctaLabel: string;
};

export function resolveRootCrashPresentation(
  _error: unknown,
): RootCrashPresentation {
  return {
    testID: ROOT_CRASH_TEST_ID,
    retry: 'withRetry',
    cta: 'secondary',
    title: copy.crash.title,
    body: copy.crash.body,
    ctaLabel: copy.crash.cta,
  };
}
