
import type { ActivityKind } from '@/src/features/activity/types';
import type { PhosphorRegularName } from '@/src/ui/icons/phosphorRegular';

export type CorsoIconName =
  | 'home'
  | 'discover'
  | 'activity'
  | 'profile'
  | 'threads'
  | 'plus'
  | 'mic'
  | 'send'
  | 'request'
  | 'swap'
  | 'search'
  | 'trend'
  | 'rule'
  | 'more'
  | 'bell'
  | 'scan'
  | 'settings'
  | 'mail'
  | 'help'
  | 'play'
  | 'lock'
  | 'mix'
  | 'checked'
  | 'close'
  | 'chevron-double-right'
  | 'compose'
  | 'delete'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'copy'
  | 'filter'
  | 'grid'
  | 'check'
  | 'warning'
  | 'refresh'
  | 'sparkle'
  | 'spinner'
  | 'activity.sent'
  | 'activity.received'
  | 'activity.swap'
  | 'activity.unknown'
  | 'result.success'
  | 'result.error';

export const CORSO_ICON_NAMES: Record<CorsoIconName, PhosphorRegularName> = {
  home: 'house',
  discover: 'compass',
  activity: 'list-bullets',
  profile: 'user-circle',
  /** Home top row — threads / history (chat-native, CANON-LOCK decision #1). */
  threads: 'list',
  /** Composer attach. */
  plus: 'plus',
  /** Composer dictation. */
  mic: 'microphone',
  send: 'arrow-up',
  request: 'arrow-down',
  swap: 'arrows-left-right',
  search: 'magnifying-glass',
  /**
   * Composer quick-action "What's moving" — the mock's rising zigzag
   * (`M1.5 9.5l3.2-3.6 2.6 2.2 3-3.9 2.2 1.6`). ⛔ The GLYPH may point up; the
   * copy on this surface still may not assert direction or rank
   * (`copy.moving`'s vocabulary ban).
   */
  trend: 'trend-up',
  rule: 'pulse',
  more: 'dots-three',
  /** Contact-support row (Settings › Help). Envelope, not a paper plane. */
  mail: 'envelope-simple',
  help: 'question',
  play: 'play',
  bell: 'bell',
  scan: 'scan',
  settings: 'gear',
  lock: 'lock-simple',
  mix: 'chart-donut',
  checked: 'seal-check',
  close: 'x',
  'chevron-double-right': 'caret-double-right',
  compose: 'note-pencil',
  delete: 'backspace',
  'chevron-left': 'caret-left',
  'chevron-right': 'caret-right',
  'chevron-down': 'caret-down',
  copy: 'copy',
  filter: 'funnel-simple',
  grid: 'squares-four',
  check: 'check',
  warning: 'warning',
  refresh: 'arrow-clockwise',
  sparkle: 'sparkle',
  spinner: 'circle-notch',
  'activity.sent': 'arrow-up',
  'activity.received': 'arrow-down',
  'activity.swap': 'arrows-left-right',
  'activity.unknown': 'circle',
  'result.success': 'check',
  'result.error': 'exclamation-mark',
};

export function activityKindIconName(kind: ActivityKind): CorsoIconName {
  switch (kind) {
    case 'sent':
      return 'activity.sent';
    case 'received':
      return 'activity.received';
    case 'swap':
      return 'activity.swap';
    default:
      return 'activity.unknown';
  }
}

export type QuickActionKey = 'send' | 'request' | 'swap' | 'more';

/** Map Home quick-action labels (copy-stable keys) to icon names. */
export function quickActionIconName(key: QuickActionKey): CorsoIconName {
  return key;
}

export const TAB_ICON_NAMES = {
  home: 'home',
  discover: 'discover',
  activity: 'activity',
  profile: 'profile',
  account: 'profile',
} as const satisfies Record<string, CorsoIconName>;

export const HEADER_ICON_NAMES = {
  notifications: 'bell',
  scan: 'scan',
} as const satisfies Record<string, CorsoIconName>;

export const TAB_STRIP_ICON_NAMES = {
  filter: 'filter',
} as const satisfies Record<string, CorsoIconName>;
