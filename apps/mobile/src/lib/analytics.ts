import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  buildAnalyticsTransportPayload,
  type AnalyticsProperties,
} from '@/src/lib/analyticsScrub';
import {
  readAnalyticsOptOut,
  shouldPostAnalyticsEvent,
  writeAnalyticsOptOut,
} from '@/src/lib/analyticsPreference';
import { getAnonymousId } from '@/src/lib/analyticsInstallId';

export type { AnalyticsProperties, AnalyticsPropertyValue } from '@/src/lib/analyticsScrub';
export {
  buildAnalyticsTransportPayload,
  scrubAnalyticsEventName,
  scrubClientProperties,
  scrubProviderErrorMessage,
  validateScrubbedAnalyticsPayload,
} from '@/src/lib/analyticsScrub';
export {
  ANALYTICS_OPT_OUT_KEY,
  analyticsSwitchAccessibilityLabel,
  parseAnalyticsOptOut,
  shouldPostAnalyticsEvent,
} from '@/src/lib/analyticsPreference';

export { ANALYTICS_INSTALL_ID_KEY, getAnonymousId } from '@/src/lib/analyticsInstallId';

const ONBOARDING_COMPLETED_KEY = '@corso/analytics/onboardingCompleted';

function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

/** null = not loaded; in-memory so opt-out suppresses immediately without a storage race. */
let cachedOptOut: boolean | null = null;

/**
 * True when the user has turned analytics off.
 * Default is false (analytics on) until they opt out.
 */
export async function isAnalyticsOptedOut(): Promise<boolean> {
  if (cachedOptOut !== null) return cachedOptOut;
  const optedOut = await readAnalyticsOptOut(AsyncStorage);
  cachedOptOut = optedOut;
  return optedOut;
}

/** Persist withdrawal (true) or re-enable (false). Updates cache first for immediate suppress. */
export async function setAnalyticsOptedOut(optedOut: boolean): Promise<void> {
  const previous = cachedOptOut;
  cachedOptOut = optedOut;
  try {
    await writeAnalyticsOptOut(AsyncStorage, optedOut);
  } catch (error) {
    cachedOptOut = previous;
    throw error;
  }
}

export function resetAnalyticsPreferenceCacheForTests(): void {
  cachedOptOut = null;
}

function appVersion(): string | undefined {
  return (
    Constants.expoConfig?.version ??
    Constants.nativeAppVersion ??
    undefined
  );
}

function buildFlavor(): string {
  const extra = Constants.expoConfig?.extra as { flavor?: string } | undefined;
  return extra?.flavor === 'seeker' ? 'seeker' : 'play';
}

export function resolveBuildFlavor(): string {
  return buildFlavor();
}

/**
 * Fire-and-forget PMF event → POST /v1/analytics/events.
 * Never throws; never blocks UX. No-ops when API URL is unset or user opted out.
 * Opt-out does not delete historical server events (deletion is a separate path).
 */
export function trackEvent(
  name: string,
  properties?: AnalyticsProperties,
): void {
  void (async () => {
    try {
      const base = apiBaseUrl();
      // Shared transport scrub path (tested via buildAnalyticsTransportPayload).
      const { name: safeName, properties: scrubbed } =
        buildAnalyticsTransportPayload(name, properties);
      const optedOut = await isAnalyticsOptedOut();
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.info(
          optedOut
            ? '[corso:analytics] suppressed (opt-out)'
            : '[corso:analytics]',
          safeName,
          scrubbed,
        );
      }
      if (!shouldPostAnalyticsEvent({ optedOut, apiBaseUrl: base })) return;
      try {
        const anonymousId = await getAnonymousId();
        await fetch(`${base}/v1/analytics/events`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: safeName,
            properties: scrubbed,
            anonymousId,
            timestamp: new Date().toISOString(),
            appVersion: appVersion(),
            platform:
              Platform.OS === 'ios' || Platform.OS === 'android'
                ? Platform.OS
                : 'unknown',
          }),
        });
      } catch {
        // Best-effort ingest — never surface to user.
      }
    } catch {
      // trackEvent path must never throw.
    }
  })();
}

/** Emit onboarding_completed once per install when Home first has an address. */
export function trackOnboardingCompletedOnce(door: string): void {
  void (async () => {
    try {
      const done = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
      if (done === '1') return;
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
      trackEvent('onboarding_completed', { door });
    } catch {
      trackEvent('onboarding_completed', { door });
    }
  })();
}
