import { trackEvent } from '@/src/lib/analytics';
import type { BuyAuthAnalyticsEvent } from '@/src/features/ramp/buyAuthAnalytics';

/** Ramp funnel → POST /v1/analytics/events (PostHog when API key configured). */
export function trackRampEvent(
  name: 'ramp_opened' | 'ramp_returned',
  props?: Record<string, string | number | boolean | undefined>,
): void {
  trackEvent(name, props);
}

/** Exact approved Buy authorization contract; no request material is accepted. */
export function trackBuyAuthEvent(event: BuyAuthAnalyticsEvent): void {
  trackEvent(event.name, event.properties);
}
