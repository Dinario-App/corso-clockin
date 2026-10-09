/** The one external destination the page may name: the Vela project page. */
export const VELA_PROJECT_URL = 'https://luxalgo.com/vela' as const;

export type VelaNavigationDecision =
  | { action: 'allow' }
  | { action: 'open_external'; url: string }
  | { action: 'deny' };

function isInlineDocument(url: string): boolean {
  return (
    url === 'about:blank' ||
    url.startsWith('about:blank#') ||
    url.startsWith('about:srcdoc')
  );
}

export function decideVelaNavigation(url: string): VelaNavigationDecision {
  if (typeof url !== 'string' || url.length === 0) return { action: 'deny' };
  if (isInlineDocument(url)) return { action: 'allow' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { action: 'deny' };
  }
  const isVelaProject =
    parsed.protocol === 'https:' &&
    parsed.hostname === 'luxalgo.com' &&
    (parsed.pathname === '/vela' || parsed.pathname === '/vela/');
  if (isVelaProject) return { action: 'open_external', url: VELA_PROJECT_URL };
  return { action: 'deny' };
}
