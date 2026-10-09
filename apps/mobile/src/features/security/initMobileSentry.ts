import * as Sentry from '@sentry/react-native';
import { breadcrumbsIntegration } from '@sentry/react-native';
import type { ErrorEvent, ReactNativeOptions } from '@sentry/react-native';
import { mobileCrashBeforeSend, type MobileSentryTrustedMeta } from './mobileCrashBeforeSend';
import type { MobileSentryMeta } from './mobileSentryRelease';

type SentryIntegration = { name: string };

const DISABLED_INTEGRATION_NAMES = new Set([
  'Breadcrumbs',
  'MobileReplay',
  'Replay',
  'BrowserReplay',
  'HttpClient',
  'HttpContext',
  'ConsoleLogs',
  'ConsoleLogging',
  'Spotlight',
]);

export const MOBILE_SENTRY_BREADCRUMBS_OPTIONS = {
  console: false,
  fetch: false,
  xhr: false,
  dom: false,
  history: false,
  sentry: false,
} as const;

/** Fail-closed JS-only slice: native crash/hang/watchdog/session paths cannot bypass beforeSend. */
export const MOBILE_SENTRY_JS_ONLY_NATIVE_OPTIONS = {
  enableNative: false,
  autoInitializeNativeSdk: false,
  enableNativeCrashHandling: false,
  enableAutoSessionTracking: false,
  enableWatchdogTerminationTracking: false,
  enableAppHangTracking: false,
  enableNdk: false,
} as const;

type SentryInitFn = (options: ReactNativeOptions) => ReturnType<typeof Sentry.init>;

export function createMobileSentryBeforeSend(
  trusted: MobileSentryTrustedMeta = {},
  scrub: (
    event: unknown,
    hint: unknown,
    trusted: MobileSentryTrustedMeta,
  ) => unknown | null = mobileCrashBeforeSend,
): (event: ErrorEvent, hint: unknown) => ErrorEvent | null {
  return (event, hint) => {
    try {
      const scrubbed = scrub(event, hint, trusted);
      if (scrubbed === null) return null;
      return scrubbed as ErrorEvent;
    } catch {
      return null;
    }
  };
}

function hardenedIntegrations(defaults: SentryIntegration[]): SentryIntegration[] {
  const filtered = defaults.filter(
    (integration) => !DISABLED_INTEGRATION_NAMES.has(integration.name),
  );
  return [
    ...filtered,
    breadcrumbsIntegration(MOBILE_SENTRY_BREADCRUMBS_OPTIONS),
  ];
}

export type ReleasedMobileSentryMeta = MobileSentryMeta & { release: string };

export function hasTrustedRelease(
  meta: MobileSentryMeta | undefined,
): meta is ReleasedMobileSentryMeta {
  return typeof meta?.release === 'string' && meta.release.length > 0;
}

export function buildMobileSentryInitOptions(
  dsn: string,
  meta: ReleasedMobileSentryMeta,
): ReactNativeOptions {
  return {
    ...MOBILE_SENTRY_JS_ONLY_NATIVE_OPTIONS,
    dsn,
    release: meta.release,
    ...(meta.dist ? { dist: meta.dist } : {}),
    ...(meta.environment ? { environment: meta.environment } : {}),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableLogs: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: () => null,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: hardenedIntegrations,
    beforeSend: createMobileSentryBeforeSend(meta),
  };
}

export function initMobileSentry(
  env: { FLAG_SENTRY: boolean; SENTRY_DSN: string | undefined },
  deps: { init?: SentryInitFn; meta?: MobileSentryMeta } = {},
): boolean {
  if (!env.FLAG_SENTRY || !env.SENTRY_DSN) {
    return false;
  }
  if (!hasTrustedRelease(deps.meta)) {
    return false;
  }

  const init = deps.init ?? Sentry.init.bind(Sentry);
  init(buildMobileSentryInitOptions(env.SENTRY_DSN, deps.meta));
  return true;
}
