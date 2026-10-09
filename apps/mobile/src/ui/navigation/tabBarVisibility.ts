export type TabBarHiddenReason = 'reply-on-screen';

type TabBarVisibilityState = {
  hidden: boolean;
  reason: TabBarHiddenReason | null;
};

const SHOWN: TabBarVisibilityState = Object.freeze({
  hidden: false,
  reason: null,
});

let state: TabBarVisibilityState = SHOWN;
const listeners = new Set<() => void>();

export function readTabBarVisibility(): TabBarVisibilityState {
  return state;
}

export function subscribeTabBarVisibility(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(next: TabBarVisibilityState): void {
  if (next.hidden === state.hidden && next.reason === state.reason) return;
  state = next;
  for (const listener of listeners) listener();
}

/** Home: a reply is on screen — the bar yields to the conversation. */
export function hideTabBar(reason: TabBarHiddenReason): void {
  write({ hidden: true, reason });
}

/** Composer swipe-down, or the conversation leaving the screen. */
export function showTabBar(): void {
  write(SHOWN);
}

/**
 * Pure: what the bar should do given Home's state. `replyOnScreen` is the
 * only input that hides; everything else shows. Kept separate from the store
 * so the rule is testable without React.
 */
export function resolveTabBarHidden(input: {
  /** Home is in the live view and at least one card carries a reply. */
  replyOnScreen: boolean;
  summoned: boolean;
}): boolean {
  return input.replyOnScreen && !input.summoned;
}

export function __resetTabBarVisibilityForTests(): void {
  state = SHOWN;
  listeners.clear();
}
