/**
 * Buy return URL — EXPO_PUBLIC_RAMP_RETURN_URL only.
 * Exact HTTPS, no credentials, no fragment. Fail closed.
 * No custom-scheme (corso://) fallback.
 * Pure validation helpers are unit-testable without Expo.
 */

export type RampReturnUrlValidation =
  | { ok: true; url: string }
  | { ok: false; reason: 'missing' | 'invalid' };

/**
 * Validate a candidate ramp return / WebBrowser redirect URL.
 * Matches the server-side HTTPS redirect normalizer contract:
 * https only, no username/password, no hash fragment.
 */
export function validateRampReturnUrl(
  value: string | undefined | null,
): RampReturnUrlValidation {
  const raw = value?.trim() ?? '';
  if (!raw) {
    return { ok: false, reason: 'missing' };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'invalid' };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'invalid' };
  }
  if (url.hash !== '') {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, url: url.href };
}

/** Read env and validate — never writes, never invents a scheme fallback. */
export function readRampReturnUrl(
  raw: string | undefined | null = process.env.EXPO_PUBLIC_RAMP_RETURN_URL,
): RampReturnUrlValidation {
  return validateRampReturnUrl(raw);
}
