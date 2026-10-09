import { validateRampReturnUrl } from '@/src/features/ramp/rampReturnUrl';

export const WEB_ORIGIN_ENTRY_HREF = '/' as const;

/** Host (with any non-default port) and path of the build's one claim. */
function rampReturnClaim(
  rampReturnUrl: string | undefined | null,
): { host: string; path: string } | null {
  const validated = validateRampReturnUrl(rampReturnUrl);
  if (!validated.ok) return null;
  const url = new URL(validated.url);
  const last = url.pathname.length - 1;
  const path =
    last > 0 && url.pathname.charAt(last) === WEB_ORIGIN_ENTRY_HREF
      ? url.pathname.slice(0, last)
      : url.pathname;
  return { host: url.host, path };
}

/** The scheme of an absolute URL, lowercased, or null for a bare path. */
function schemeOf(value: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return match?.[1] === undefined ? null : match[1].toLowerCase();
}

export function rewriteWebOriginLink(
  incoming: string,
  rampReturnUrl: string | undefined | null,
): string {
  const trimmed = incoming.trim();
  // Protocol-relative `//host/path` is a web link with no scheme.
  if (/^\/\//.test(trimmed)) return WEB_ORIGIN_ENTRY_HREF;
  // Classify by the protocol the WHATWG parser reads, the same parser Expo
  // Router hands the link to, so a spelling the parser accepts as http(s)
  // (tabs or newlines inside the scheme, leading control characters) is a
  // web link here too. Only an unparseable string falls back to its spelled
  // scheme. Non-web schemes and bare paths leave unchanged, byte for byte.
  let url: URL | null;
  try {
    url = new URL(incoming);
  } catch {
    url = null;
  }
  const scheme = url === null ? schemeOf(trimmed) : url.protocol.slice(0, -1);
  if (scheme === null || !/^https?$/.test(scheme)) return incoming;
  if (url === null) return WEB_ORIGIN_ENTRY_HREF;

  const claim = rampReturnClaim(rampReturnUrl);
  if (claim === null || url.host !== claim.host) return WEB_ORIGIN_ENTRY_HREF;

  const canonical = url.origin + claim.path;
  const head = incoming.split(/[?#]/, 1)[0];
  const exact =
    head === canonical || head === canonical + WEB_ORIGIN_ENTRY_HREF;
  return exact ? incoming : WEB_ORIGIN_ENTRY_HREF;
}

/** The inlined build value; the same one `app.config.ts` reads. */
export function readRampReturnClaimSource(): string | undefined {
  return process.env.EXPO_PUBLIC_RAMP_RETURN_URL;
}
