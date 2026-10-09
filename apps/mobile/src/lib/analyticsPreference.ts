export const ANALYTICS_OPT_OUT_KEY = '@corso/analytics/optOut';

/** Stored as '1' when the user has withdrawn analytics. */
export type PreferenceStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

/** true = user opted out / withdrew; events must not leave the device. */
export function parseAnalyticsOptOut(raw: string | null | undefined): boolean {
  return raw === '1';
}

export function serializeAnalyticsOptOut(optedOut: boolean): string {
  return optedOut ? '1' : '0';
}

/**
 * Gate for network POST. Opt-out wins over API availability.
 * Does not delete historical server data.
 */
export function shouldPostAnalyticsEvent(input: {
  optedOut: boolean;
  apiBaseUrl: string | null | undefined;
}): boolean {
  if (input.optedOut) return false;
  const base = input.apiBaseUrl?.trim();
  return Boolean(base);
}

export async function readAnalyticsOptOut(
  storage: PreferenceStorage,
): Promise<boolean> {
  try {
    const raw = await storage.getItem(ANALYTICS_OPT_OUT_KEY);
    return parseAnalyticsOptOut(raw);
  } catch {
    // Fail open to product default (analytics on) when storage is unreadable.
    return false;
  }
}

export async function writeAnalyticsOptOut(
  storage: PreferenceStorage,
  optedOut: boolean,
): Promise<void> {
  await storage.setItem(
    ANALYTICS_OPT_OUT_KEY,
    serializeAnalyticsOptOut(optedOut),
  );
}

/**
 * Screen-reader label for the Profile privacy switch (enabled = analytics on).
 * Action-oriented wording; state announced as on/off (pairs with accessibilityState).
 */
export function analyticsSwitchAccessibilityLabel(enabled: boolean): string {
  return enabled
    ? 'Share usage analytics, on'
    : 'Share usage analytics, off';
}
