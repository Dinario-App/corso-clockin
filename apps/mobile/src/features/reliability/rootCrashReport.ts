import * as Sentry from '@sentry/react-native';

export const ROOT_CRASH_TAGS = {
  component: 'root_error_boundary',
  stage: 'render',
} as const;

export type RootCrashCapture = (
  error: unknown,
  context: { tags: Record<string, string> },
) => void;

const captureThroughSentry: RootCrashCapture = (error, context) => {
  Sentry.captureException(error, context);
};

/**
 * Report one caught render error. Returns whether the capture call completed —
 * a reporter that throws inside an error boundary would be the second crash,
 * on top of the first, with no boundary left above it to catch it. So every
 * failure here is swallowed and the screen still paints.
 */
export function reportRootCrash(
  error: unknown,
  capture: RootCrashCapture = captureThroughSentry,
): boolean {
  try {
    capture(error, { tags: { ...ROOT_CRASH_TAGS } });
    return true;
  } catch {
    return false;
  }
}
