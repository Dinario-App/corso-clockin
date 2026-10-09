import type { ActivityKind } from '@/src/features/activity/types';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

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

/** Platform-specific symbol names for expo-symbols SymbolView. */
export type CorsoIconPlatformNames = {
  /** SF Symbol name (iOS). */
  ios: SFSymbol;
  /** Material Symbol name (Android). */
  android: AndroidSymbol;
  /** Material Symbol name (web fallback path in expo-symbols). */
  web: AndroidSymbol;
};

/**
 * Thin-line monochrome set. Prefer outline/regular over filled multicolor.
 * Keep this table the single source for tab / quick-action / activity glyphs.
 */
export const CORSO_ICON_NAMES: Record<CorsoIconName, CorsoIconPlatformNames> = {
  home: { ios: 'house', android: 'home', web: 'home' },
  discover: { ios: 'safari', android: 'explore', web: 'explore' },
  activity: { ios: 'clock', android: 'schedule', web: 'schedule' },
  profile: { ios: 'person', android: 'person', web: 'person' },
  threads: { ios: 'line.3.horizontal', android: 'menu', web: 'menu' },
  /** Composer attach. */
  plus: { ios: 'plus', android: 'add', web: 'add' },
  /** Composer dictation. */
  mic: { ios: 'mic', android: 'mic', web: 'mic' },
  send: { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' },
  request: {
    ios: 'arrow.down',
    android: 'arrow_downward',
    web: 'arrow_downward',
  },
  swap: {
    ios: 'arrow.left.arrow.right',
    android: 'swap_horiz',
    web: 'swap_horiz',
  },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  trend: {
    ios: 'chart.line.uptrend.xyaxis',
    android: 'trending_up',
    web: 'trending_up',
  },
  rule: {
    ios: 'waveform.path.ecg',
    android: 'monitor_heart',
    web: 'monitor_heart',
  },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  /** Contact-support row (Settings › Help). Envelope, not a paper plane. */
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
  help: {
    ios: 'questionmark.circle',
    android: 'help_outline',
    web: 'help_outline',
  },
  play: { ios: 'play', android: 'play_arrow', web: 'play_arrow' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  scan: {
    ios: 'qrcode.viewfinder',
    android: 'qr_code_scanner',
    web: 'qr_code_scanner',
  },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  'chevron-double-right': {
    ios: 'chevron.right.2',
    android: 'keyboard_double_arrow_right',
    web: 'keyboard_double_arrow_right',
  },
  compose: {
    ios: 'square.and.pencil',
    android: 'edit_square',
    web: 'edit_square',
  },
  delete: { ios: 'delete.left', android: 'backspace', web: 'backspace' },
  'chevron-left': {
    ios: 'chevron.left',
    android: 'chevron_left',
    web: 'chevron_left',
  },
  'chevron-right': {
    ios: 'chevron.right',
    android: 'chevron_right',
    web: 'chevron_right',
  },
  'chevron-down': {
    ios: 'chevron.down',
    android: 'keyboard_arrow_down',
    web: 'keyboard_arrow_down',
  },
  copy: {
    ios: 'doc.on.doc',
    android: 'content_copy',
    web: 'content_copy',
  },
  filter: {
    ios: 'line.3.horizontal.decrease',
    android: 'filter_list',
    web: 'filter_list',
  },
  grid: {
    ios: 'square.grid.2x2',
    android: 'grid_view',
    web: 'grid_view',
  },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  warning: {
    ios: 'exclamationmark.triangle',
    android: 'warning',
    web: 'warning',
  },
  refresh: {
    ios: 'arrow.clockwise',
    android: 'refresh',
    web: 'refresh',
  },
  sparkle: {
    ios: 'sparkle',
    android: 'auto_awesome',
    web: 'auto_awesome',
  },
  spinner: {
    ios: 'progress.indicator',
    android: 'progress_activity',
    web: 'progress_activity',
  },
  'activity.sent': {
    ios: 'arrow.up',
    android: 'arrow_upward',
    web: 'arrow_upward',
  },
  'activity.received': {
    ios: 'arrow.down',
    android: 'arrow_downward',
    web: 'arrow_downward',
  },
  'activity.swap': {
    ios: 'arrow.left.arrow.right',
    android: 'swap_horiz',
    web: 'swap_horiz',
  },
  'activity.unknown': { ios: 'circle', android: 'circle', web: 'circle' },
  'result.success': { ios: 'checkmark', android: 'check', web: 'check' },
  'result.error': {
    ios: 'exclamationmark',
    android: 'priority_high',
    web: 'priority_high',
  },
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
