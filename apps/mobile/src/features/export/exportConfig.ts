/** In-app consent version. Must match the version referenced in the published ToS. */
export const EXPORT_CONSENT_VERSION = 'export_consent_v1';

export const EXPORT_PAGE_PATH = '/export';

export type ExportDisabledReason =
  | 'flag_off'
  | 'origin_missing'
  | 'origin_invalid'
  | 'legal_not_live'
  | 'consent_version_mismatch';

export type ExportEntryDecision =
  | { enabled: true; origin: string }
  | { enabled: false; reason: ExportDisabledReason };

export type ExportEntryInputs = {
  /** EXPO_PUBLIC_EXPORT_ENABLED */
  flag: string | undefined | null;
  /** EXPO_PUBLIC_EXPORT_ORIGIN, e.g. https://export.corso.trade */
  origin: string | undefined | null;
  /**
   * EXPO_PUBLIC_EXPORT_LEGAL_LIVE — build-time attestation that the amended
   * ToS + Privacy Policy are live. Set by the release process, never by a dev
   * default. Absent → disabled.
   */
  legalLive: string | undefined | null;
  /**
   * EXPO_PUBLIC_EXPORT_CONSENT_VERSION — the consent version referenced by the
   * *published* ToS. Must equal EXPORT_CONSENT_VERSION or the gate fails closed.
   */
  publishedConsentVersion: string | undefined | null;
  appConsentVersion?: string;
};

/** Strict boolean parse — only the exact affirmative literals enable. */
export function parseBuildFlag(raw: string | undefined | null): boolean {
  if (typeof raw !== 'string') return false;
  const value = raw.trim().toLowerCase();
  return value === '1' || value === 'true';
}

export type OriginResult =
  | { ok: true; origin: string }
  | { ok: false; reason: 'origin_missing' | 'origin_invalid' };

export function normalizeExportOrigin(
  raw: string | undefined | null,
): OriginResult {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { ok: false, reason: 'origin_missing' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'origin_invalid' };
  }

  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    !url.hostname ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    return { ok: false, reason: 'origin_invalid' };
  }

  return { ok: true, origin: url.origin };
}

export function resolveExportEntryPoint(
  input: ExportEntryInputs,
): ExportEntryDecision {
  if (!parseBuildFlag(input.flag)) {
    return { enabled: false, reason: 'flag_off' };
  }

  const origin = normalizeExportOrigin(input.origin);
  if (!origin.ok) return { enabled: false, reason: origin.reason };

  if (!parseBuildFlag(input.legalLive)) {
    return { enabled: false, reason: 'legal_not_live' };
  }

  const appVersion = input.appConsentVersion ?? EXPORT_CONSENT_VERSION;
  const published =
    typeof input.publishedConsentVersion === 'string'
      ? input.publishedConsentVersion.trim()
      : '';
  if (!published || published !== appVersion) {
    return { enabled: false, reason: 'consent_version_mismatch' };
  }

  return { enabled: true, origin: origin.origin };
}

/** Read the shipped build env. Defaults to disabled in every environment. */
export function resolveExportEntryPointFromEnv(): ExportEntryDecision {
  return resolveExportEntryPoint({
    flag: process.env.EXPO_PUBLIC_EXPORT_ENABLED,
    origin: process.env.EXPO_PUBLIC_EXPORT_ORIGIN,
    legalLive: process.env.EXPO_PUBLIC_EXPORT_LEGAL_LIVE,
    publishedConsentVersion: process.env.EXPO_PUBLIC_EXPORT_CONSENT_VERSION,
  });
}
