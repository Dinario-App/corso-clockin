/**
 * Map known ramp session error codes to consumer-safe copy keys.
 * Never surface server config detail (allowlist, env names, raw messages).
 * Pure — no React.
 */

export type RampErrorCopyKey =
  | 'disabled'
  | 'returnNotConfigured'
  | 'assetDisabled'
  | 'unsupportedGeo'
  | 'providerUnsupported'
  | 'authDeclined'
  | 'authUnavailable'
  | 'authExpired'
  | 'authDoorUnsupported'
  | 'generic';

const GEO_CODES = new Set([
  'unsupported_geo',
  'unsupported-geo',
  'geo_restricted',
  'geo_not_supported',
  'region_unsupported',
  'country_not_supported',
]);

/**
 * Normalize API / network error codes to a stable copy key.
 * Server config / env shortfalls map to temporary-unavailability (`disabled`),
 * never a config-leaking consumer key.
 */
export function mapRampErrorCode(
  error: string | undefined | null,
): RampErrorCopyKey {
  const code = (error ?? '').trim().toLowerCase();
  if (!code) return 'generic';

  switch (code) {
    case 'ramp_disabled':
    // MoonPay keys missing etc. — do not expose "not configured" to the user.
    case 'ramp_not_configured':
      return 'disabled';
    case 'ramp_redirect_not_allowed':
    case 'ramp_redirect_not_configured':
      return 'returnNotConfigured';
    case 'ramp_asset_disabled':
      return 'assetDisabled';
    case 'provider_unsupported':
    case 'provider_not_supported':
      return 'providerUnsupported';
    case 'ramp_auth_declined':
      return 'authDeclined';
    case 'ramp_auth_expired':
      return 'authExpired';
    case 'ramp_auth_door_unsupported':
      return 'authDoorUnsupported';
    case 'ramp_auth_unavailable':
    case 'ramp_auth_invalid':
    case 'ramp_auth_replayed':
    case 'ramp_auth_mismatch':
    case 'ramp_auth_required':
    case 'ramp_auth_session_changed':
      return 'authUnavailable';
    default:
      break;
  }

  if (GEO_CODES.has(code)) {
    return 'unsupportedGeo';
  }

  // Provider payloads sometimes embed geo in the code string.
  if (code.includes('geo') || code.includes('region') || code.includes('country')) {
    return 'unsupportedGeo';
  }

  return 'generic';
}

/**
 * Resolve user-facing string from a key map.
 * Callers pass copy.buy fields; raw server messages must not be shown for known codes.
 */
export function resolveRampErrorMessage(
  error: string | undefined | null,
  messages: Record<RampErrorCopyKey, string>,
): string {
  const key = mapRampErrorCode(error);
  return messages[key] ?? messages.generic;
}
