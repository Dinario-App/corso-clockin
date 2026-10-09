/**
 * The four anchors, and then the per-route parents.
 *
 * `/(app)` is the app's anchor: `app/index.tsx` redirects here once the
 * session resolves to `home`, and the tab shell restores its own focused root,
 * so it lands on the tab the person last used rather than forcing one. The
 * three group-qualified tab hrefs are the same ones `TAB_ROOTS` registers.
 */
export const BACK_FALLBACK = {
  /** Signed-in shell — lands on the tab the person last used. */
  shell: '/(app)',
  /** Account tab: the root that pushes receive · swap · security · settings. */
  accountTab: '/(app)/account',
  /** Activity tab: the list `/activity/[signature]` details a row of. */
  activityTab: '/(app)/activity',
  /** Auth entry. A signed-out person must never be handed the signed-in shell. */
  authWelcome: '/(auth)/welcome',

  /** Lane roots. Both are `Stack.Protected`; a child only exists while the guard is on. */
  botsList: '/bots',
  skillsList: '/skills',
  /** Profile hubs. */
  settingsHub: '/profile/settings',
  securityHub: '/profile/security',
  notificationsHub: '/profile/notifications',
  about: '/profile/about',
  /** `/export` is entered from the key ceremony and from nowhere else. */
  keys: '/profile/keys',
} as const;

export type BackFallback =
  | (typeof BACK_FALLBACK)[keyof typeof BACK_FALLBACK]
  /**
   * `/chart/[mint]` is escalated from `/asset/[mint]`, so its fallback carries
   * the mint it is already showing. The screen only builds this once
   * `parseFullChartParams` has validated the mint; an unparsed chart falls back
   * to `shell` instead of naming a route with a mint nobody vouched for.
   */
  | `/asset/${string}`;

export type GuardedBackEffect<T extends BackFallback = BackFallback> =
  /** History exists: pop it, and land on the real origin. */
  | { kind: 'back' }
  /** Nothing beneath this screen: name the parent rather than stand still. */
  | { kind: 'replace'; href: T };

export function resolveGuardedBack<T extends BackFallback>(input: {
  canGoBack: boolean;
  fallback: T;
}): GuardedBackEffect<T> {
  if (input.canGoBack) return { kind: 'back' };
  return { kind: 'replace', href: input.fallback };
}
