import { copy } from '@/constants/copy';
import { colors } from '@/src/ui/tokens';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames';

export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_RADIUS = 31;
/** Horizontal inset from the phone edge; also the bar's rest gap above the home indicator. */
export const TAB_BAR_INSET = 14;
/** Composer dock gap above the bar when the bar is shown (height + inset + 4 = 80). */
export const TAB_BAR_DOCK_LIFT = TAB_BAR_HEIGHT + TAB_BAR_INSET + 4;
/** Hide/show: `.35s cubic-bezier(.3,.8,.3,1)`; the bar drops 120% and fades. */
export const TAB_BAR_MOTION_MS = 350;
export const TAB_BAR_HIDDEN_TRANSLATE = Math.round(TAB_BAR_HEIGHT * 1.2);
export const TAB_BAR_LABEL_SIZE = 11;
export const TAB_ACTIVE_CAPSULE = 'rgba(255, 255, 255, 0.10)';
export const TAB_ACTIVE_CAPSULE_INSET = 4;

export type TabRootName =
  | 'index'
  | 'activity'
  | 'account'
  | 'markets';

export type TabRoot = {
  name: TabRootName;
  /** Group-qualified href so the trigger resolves inside `(app)`, never to the root redirect. */
  href:
    | '/(app)'
    | '/(app)/activity'
    | '/(app)/account'
    | '/(app)/markets';
  label: string;
  glyph: CorsoIconName;
};

export const TAB_ROOTS: readonly TabRoot[] = Object.freeze([
  { name: 'index', href: '/(app)', label: 'Home', glyph: 'home' },
  {
    name: 'activity',
    href: '/(app)/activity',
    label: 'Activity',
    glyph: 'activity',
  },
  {
    name: 'account',
    href: '/(app)/account',
    label: 'Profile',
    glyph: 'profile',
  },
]);

export const PORTFOLIO_ROOT: TabRoot = Object.freeze({
  name: 'index',
  href: '/(app)',
  label: copy.launchDock.locked.portfolio,
  glyph: 'home',
});

export const MARKETS_ROOT: TabRoot = Object.freeze({
  name: 'markets',
  href: '/(app)/markets',
  label: copy.launchDock.locked.markets,
  glyph: 'trend',
});

const ACTIVITY_ROOT = TAB_ROOTS[1] as TabRoot;
const PROFILE_ROOT = TAB_ROOTS[2] as TabRoot;

export const LAUNCH_TAB_ROOTS: readonly TabRoot[] = Object.freeze([
  PORTFOLIO_ROOT,
  MARKETS_ROOT,
  ACTIVITY_ROOT,
  PROFILE_ROOT,
]);

export function resolveTabRoots(input: {
  launchDock?: boolean;
}): readonly TabRoot[] {
  if (input.launchDock === true) return LAUNCH_TAB_ROOTS;
  return TAB_ROOTS;
}

/** Where the dock's Ask summon-ring goes: the existing 05 Ask sheet. */
export const DOCK_ASK_HREF = '/ask' as const;

export type DockItem =
  | { kind: 'root'; key: TabRootName; root: TabRoot }
  | {
      kind: 'summon';
      key: 'ask';
      label: string;
      /** The ✦ the Home Ask disc draws. A glyph, not a word. */
      glyph: '✦';
      href: typeof DOCK_ASK_HREF;
    };

export const LAUNCH_DOCK_ITEMS: readonly DockItem[] = Object.freeze([
  { kind: 'root', key: 'index', root: PORTFOLIO_ROOT },
  { kind: 'root', key: 'markets', root: MARKETS_ROOT },
  {
    kind: 'summon',
    key: 'ask',
    label: copy.launchDock.proposed.ask,
    glyph: '✦',
    href: DOCK_ASK_HREF,
  },
  { kind: 'root', key: 'activity', root: ACTIVITY_ROOT },
]);

/** The avatar's destination: the unchanged Profile root. */
export const LAUNCH_AVATAR_HREF = PROFILE_ROOT.href;

/**
 * What the dock draws. Flag off: one root item per `resolveTabRoots` entry,
 * in the same order — today's dock. Flag on: `LAUNCH_DOCK_ITEMS`.
 */
export function resolveDockItems(input: {
  launchDock: boolean;
}): readonly DockItem[] {
  if (input.launchDock) return LAUNCH_DOCK_ITEMS;
  return resolveTabRoots({}).map((root) => ({
    kind: 'root' as const,
    key: root.name,
    root,
  }));
}

export type TabBarPresentation = {
  /** Bottom offset: the greater of the safe-area inset and the 14px rest gap. */
  bottom: number;
  /** Total vertical space a screen must keep clear while the bar is shown. */
  reserve: number;
  translateY: number;
  opacity: number;
  animate: boolean;
  material: 'float';
};

export function resolveTabBarPresentation(input: {
  hidden: boolean;
  safeAreaBottom: number;
  reduceMotion: boolean;
}): TabBarPresentation {
  const bottom = Math.max(input.safeAreaBottom, TAB_BAR_INSET);
  return {
    bottom,
    reserve: bottom + TAB_BAR_HEIGHT,
    translateY: input.hidden ? TAB_BAR_HIDDEN_TRANSLATE + bottom : 0,
    opacity: input.hidden ? 0 : 1,
    animate: !input.reduceMotion,
    material: 'float',
  };
}

export type TabItemPresentation = {
  color: string;
  capsuleColor: string | null;
  accessibilityState: { selected: boolean };
};

export function resolveTabItemPresentation(input: {
  focused: boolean;
}): TabItemPresentation {
  return {
    color: input.focused ? colors.ink : colors.inkSecondary,
    capsuleColor: input.focused ? TAB_ACTIVE_CAPSULE : null,
    accessibilityState: { selected: input.focused },
  };
}
