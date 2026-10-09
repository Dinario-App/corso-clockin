const EXTERNAL_RETURN_HEADS = new Set([
  'corso://',
  'corso:///',
  ...['ramp/callback', 'ai/return'].flatMap((path) => [
    `corso://${path}`,
    `corso://${path}/`,
    `corso:///${path}`,
    `corso:///${path}/`,
  ]),
]);

export function rewriteCustomSchemeLink(incoming: string): string {
  let url: URL | null;
  try {
    url = new URL(incoming);
  } catch {
    url = null;
  }
  // Same parsed-protocol classification as webOriginLinks: WHATWG accepts
  // case, leading controls and tabs/newlines inside the scheme. A malformed
  // URL with the spelled scheme must still fail closed.
  // If the host/path is malformed, parse just the protocol portion with
  // the same URL parser. This retains its control-character handling without
  // normalizing any bytes used for callback membership.
  let protocol = url?.protocol;
  if (protocol === undefined) {
    try {
      protocol = new URL(incoming.slice(0, incoming.indexOf(':') + 1).trim())
        .protocol;
    } catch {
      return incoming;
    }
  }
  // Web URLs retain rewriteWebOriginLink's policy. Every other absolute
  // protocol requires an exact callback head, regardless of registration.
  if (protocol === 'http:' || protocol === 'https:') return incoming;
  if (url === null) return '/';

  // Match the ORIGINAL bytes, never a decoded or URL-normalized path:
  // normalization could turn traversal into an allowed callback. Preserve
  // query/fragment bytes for the existing callback consumers.
  const head = incoming.split(/[?#]/, 1)[0];
  if (!EXTERNAL_RETURN_HEADS.has(head ?? '')) return '/';
  return incoming;
}
