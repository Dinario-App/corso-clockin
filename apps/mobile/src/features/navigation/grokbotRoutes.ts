export const GROKBOT_HOME_HREF = '/(app)' as const;

/** Single-segment routes. A child path is not one of these screens. */
const EXACT_ROOTS = new Set(['send', 'money', 'paper']);
/** Whole trees, including the index URL (`/bots`) and `chart/[mint]`. */
const TREE_ROOTS = new Set(['bots', 'skills', 'chart']);

export type GrokbotRoutesEnv = Readonly<{
  FLAG_GROKBOT_ROUTES: boolean;
}>;

export type GrokbotRoutesEnvInput = {
  EXPO_PUBLIC_FLAG_GROKBOT_ROUTES?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error('EXPO_PUBLIC_FLAG_GROKBOT_ROUTES must be "0" or "1"');
  }
  return raw === '1';
}

export function parseGrokbotRoutesEnv(
  input: GrokbotRoutesEnvInput = {},
): GrokbotRoutesEnv {
  const FLAG_GROKBOT_ROUTES = parseEnvFlag(
    input.EXPO_PUBLIC_FLAG_GROKBOT_ROUTES,
    '0',
  );
  return Object.freeze({ FLAG_GROKBOT_ROUTES });
}

/**
 * The inlined build flag. A malformed value throws inside the parser; the
 * catch keeps the park shut.
 */
export function readGrokbotRoutesFlag(): boolean {
  try {
    return parseGrokbotRoutesEnv({
      EXPO_PUBLIC_FLAG_GROKBOT_ROUTES:
        process.env.EXPO_PUBLIC_FLAG_GROKBOT_ROUTES,
    }).FLAG_GROKBOT_ROUTES;
  } catch {
    return false;
  }
}

/**
 * Pathname of an in-app href or a native deep link.
 * `corso://send` puts the first segment in the host. `corso:///send` and
 * `/send` put it in the pathname. A host that contains a dot (a website, or
 * the dev-client URL) is not a route segment.
 */
export function pathnameFromIncoming(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  let pathname: string;
  if (trimmed.startsWith('/')) {
    pathname = trimmed.split(/[?#]/)[0] ?? trimmed;
  } else {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    const host = url.hostname;
    if (host.length > 0 && !host.includes('.') && host !== 'localhost') {
      const suffix = url.pathname === '/' ? '' : url.pathname;
      pathname = `/${host}${suffix}`;
    } else {
      pathname = url.pathname;
    }
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return pathname.length === 0 ? '/' : pathname;
}

export function isGrokbotParkedPath(path: string): boolean {
  const pathname = pathnameFromIncoming(path);
  if (pathname === null) return false;
  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  const root = segments[0];
  if (root === undefined) return false;
  if (EXACT_ROOTS.has(root)) return segments.length === 1;
  if (!TREE_ROOTS.has(root)) return false;
  return !(root === 'bots' && segments.length === 2 && segments[1] === 'revoke');
}

export type GrokbotRouteDecision =
  | { readonly kind: 'redirect'; readonly href: typeof GROKBOT_HOME_HREF }
  | { readonly kind: 'open' };

export function grokbotRouteDecision(
  path: string,
  enabled: boolean,
): GrokbotRouteDecision {
  if (enabled === true || !isGrokbotParkedPath(path)) return { kind: 'open' };
  return { kind: 'redirect', href: GROKBOT_HOME_HREF };
}

/** Entry doors. Flag off → null (the control is absent). Otherwise the href. */
export function grokbotEntryHref<T extends string>(
  href: T,
  enabled: boolean,
): T | null {
  if (enabled !== true) {
    return isGrokbotParkedPath(href) ? null : href;
  }
  return href;
}

export function rewriteGrokbotDeepLink(path: string, enabled: boolean): string {
  if (enabled === true) return path;
  const pathname = pathnameFromIncoming(path);
  if (pathname !== null && isGrokbotParkedPath(pathname)) return GROKBOT_HOME_HREF;
  return path;
}
