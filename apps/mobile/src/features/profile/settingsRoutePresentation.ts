import { isHeadsUpInboxEvent, type HeadsUpInboxEvent } from '@/src/features/skills/directory/headsUpAccessClient';

import { copy } from '@/constants/copy';
import { isFeeRateLabel } from '@/src/lib/feeRateLabel';
import { spacing } from '@/src/ui/tokens';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import type { SettingsRowAccessory } from '@/src/ui/rows/settingsRowPresentation.js';

export const SETTINGS_SCREEN_GUTTER = spacing.gutter;

export const PROFILE_NOTIFICATIONS_HREF = '/profile/notifications';
export const PROFILE_NOTIFICATIONS_PREFERENCES_HREF =
  '/profile/notifications/preferences';
export const PROFILE_NETWORK_HREF = '/profile/network';
export const PROFILE_PREFERENCES_HREF = '/profile/preferences';
export const PROFILE_ABOUT_HREF = '/profile/about';
export const PROFILE_PRIVACY_HREF = '/profile/privacy';
export const PROFILE_HOW_IT_WORKS_HREF = '/profile/how-it-works';

/** Locked fiat — prices fail closed on anything else. */
export const PREFERENCES_CURRENCY_VALUE = 'USD' as const;

export const NETWORK_CLUSTERS = ['mainnet-beta', 'devnet'] as const;
export type SettingsCluster = (typeof NETWORK_CLUSTERS)[number];

export const SETTINGS_UNREACHABLE_HREFS = [
  '/profile/security/phrase',
  '/profile/security/advanced',
  '/profile/advanced',
  '/advanced',
  '/profile/developer',
] as const;

const FORBIDDEN_SETTINGS_LABELS = [
  'Select network',
  'Advanced',
  'Import',
  'Connect',
  'Passkey',
  'WebAuthn',
  'coming soon',
  'Autopilot',
  '85 bps',
  'dark mode',
  'Dark mode',
] as const;

const FORBIDDEN_SETTINGS_VENDORS = [
  'Privy',
  'Squads',
  'Grid',
  'Jupiter',
  'Helius',
] as const;

const FORBIDDEN_NOTIFICATION_KINDS = [
  'autopilot',
  'denial',
  'pause',
  'cap',
  'run journal',
  'armed',
] as const;

export type ProfileSettingsHubRowId =
  | 'notifications'
  | 'network'
  | 'preferences'
  | 'about';

export type ProfileSettingsHubRow = {
  id: ProfileSettingsHubRowId;
  label: string;
  glyph: CorsoIconName;
  accessory: 'chevron';
  hasDestination: true;
  href:
    | typeof PROFILE_NOTIFICATIONS_HREF
    | typeof PROFILE_NETWORK_HREF
    | typeof PROFILE_PREFERENCES_HREF
    | typeof PROFILE_ABOUT_HREF;
  frame: 'F146' | 'F149' | 'F151' | 'F150';
};

export type NotificationsPresentation = {
  frame: 'F146' | 'F147';
  title: string;
  empty: boolean;
  emptyCopy: string;
  items: HeadsUpInboxEvent[];
  preferencesHref: typeof PROFILE_NOTIFICATIONS_PREFERENCES_HREF;
  preferencesLabel: string;
};

export type NotificationPreferencesPresentation = {
  frame: 'F148';
  title: string;
  body: string;
  stub: true;
  controls: [];
};

export type NetworkPresentation = {
  frame: 'F149';
  title: string;
  selectClusterTitle: string;
  cluster: SettingsCluster | null;
  clusterSwitchEnabled: false;
  sheetVisible: boolean;
  clusters: typeof NETWORK_CLUSTERS;
};

export type AboutLegalRow = {
  label: string;
  url?: string;
  /** In-app route (Privacy Policy). */
  href?: string;
  glyph?: CorsoIconName;
};

export type AboutPresentation = {
  frame: 'F150';
  title: string;
  versionLabel: string;
  versionValue: string;
  legalRows: readonly AboutLegalRow[];
  productNameOnScreen: false;
  onChainClosure: false;
};

export type PreferencesRow =
  | {
      id: 'currency';
      label: string;
      glyph: CorsoIconName;
      accessory: 'value';
      value: typeof PREFERENCES_CURRENCY_VALUE;
      frame: 'F151';
    }
  | {
      id: 'hide-balances';
      label: string;
      glyph: CorsoIconName;
      accessory: 'switch';
      href: null;
      inScreenAction: true;
      frame: 'F151';
    };

export type PreferencesPresentation = {
  frame: 'F151';
  title: string;
  rows: PreferencesRow[];
  darkModeRow: false;
};

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCluster(value: unknown): SettingsCluster | null {
  if (value === 'mainnet-beta' || value === 'devnet') {
    return value;
  }
  return null;
}

function normalizeVersion(value: unknown): string {
  const label = normalizeLabel(value);
  return label ?? copy.profile.valueUnavailable;
}

export function resolveProfileSettingsHubRows(): ProfileSettingsHubRow[] {
  return [
    {
      id: 'notifications',
      label: copy.profile.notificationsTitle,
      glyph: 'bell',
      accessory: 'chevron',
      hasDestination: true,
      href: PROFILE_NOTIFICATIONS_HREF,
      frame: 'F146',
    },
    {
      id: 'network',
      label: copy.profile.networkTitle,
      glyph: 'discover',
      accessory: 'chevron',
      hasDestination: true,
      href: PROFILE_NETWORK_HREF,
      frame: 'F149',
    },
    {
      id: 'preferences',
      label: copy.profile.preferencesTitle,
      glyph: 'settings',
      accessory: 'chevron',
      hasDestination: true,
      href: PROFILE_PREFERENCES_HREF,
      frame: 'F151',
    },
    {
      id: 'about',
      label: copy.profile.aboutSection,
      // Same glyph the shipped Settings screen already draws for this row
      // (`settingsDetailPresentation.ts`), so the two resolvers agree on the
      // well as well as the destination.
      glyph: 'more',
      accessory: 'chevron',
      hasDestination: true,
      href: PROFILE_ABOUT_HREF,
      frame: 'F150',
    },
  ];
}

export function notificationEventIsForbidden(kind: unknown): boolean {
  if (typeof kind !== 'string') {
    return false;
  }
  const lower = kind.toLowerCase();
  for (const forbidden of FORBIDDEN_NOTIFICATION_KINDS) {
    if (lower.includes(forbidden)) {
      return true;
    }
  }
  return false;
}

/** Validated Heads-Up events only; unknown and money events fail closed. */
export function resolveNotificationsPresentation(input: { events?: unknown }): NotificationsPresentation {
  const items = Array.isArray(input.events) ? input.events.filter(event => isHeadsUpInboxEvent(event)) : [];
  return {
    frame: items.length ? 'F146' : 'F147',
    title: copy.profile.notificationsTitle,
    empty: items.length === 0,
    emptyCopy: copy.profile.notificationsEmpty,
    items,
    preferencesHref: PROFILE_NOTIFICATIONS_PREFERENCES_HREF,
    preferencesLabel: copy.profile.preferencesTitle,
  };
}

export function resolveNotificationPreferencesPresentation(): NotificationPreferencesPresentation {
  return {
    frame: 'F148',
    title: copy.profile.preferencesTitle,
    body: copy.stub.body,
    stub: true,
    controls: [],
  };
}

export function resolveNetworkPresentation(input: {
  cluster: unknown;
  sheetVisible: unknown;
}): NetworkPresentation {
  return {
    frame: 'F149',
    title: copy.profile.networkTitle,
    selectClusterTitle: copy.profile.selectCluster,
    cluster: normalizeCluster(input.cluster),
    clusterSwitchEnabled: false,
    sheetVisible: asBoolean(input.sheetVisible),
    clusters: NETWORK_CLUSTERS,
  };
}

export function resolveAboutPresentation(input: {
  version: unknown;
  legalRows: readonly AboutLegalRow[];
}): AboutPresentation {
  return {
    frame: 'F150',
    title: copy.profile.aboutSection,
    versionLabel: copy.profile.aboutVersion,
    versionValue: normalizeVersion(input.version),
    legalRows: input.legalRows,
    productNameOnScreen: false,
    onChainClosure: false,
  };
}

export function resolvePreferencesPresentation(): PreferencesPresentation {
  return {
    frame: 'F151',
    title: copy.profile.preferencesTitle,
    darkModeRow: false,
    rows: [
      {
        id: 'currency',
        label: copy.profile.preferencesCurrency,
        glyph: 'more',
        accessory: 'value',
        value: PREFERENCES_CURRENCY_VALUE,
        frame: 'F151',
      },
      {
        id: 'hide-balances',
        label: copy.profile.preferencesHideBalances,
        glyph: 'filter',
        accessory: 'switch',
        href: null,
        inScreenAction: true,
        frame: 'F151',
      },
    ],
  };
}

export function resolvePreferencesRowAccessory(
  id: unknown,
): SettingsRowAccessory | null {
  if (id === 'currency') return 'value';
  if (id === 'hide-balances') return 'switch';
  return null;
}

export function assertNoForbiddenSettingsLabels(labels: unknown[]): void {
  for (const label of labels) {
    const normalized = normalizeLabel(label);
    if (normalized === null) {
      continue;
    }
    const lower = normalized.toLowerCase();
    if (
      isFeeRateLabel(normalized) ||
      FORBIDDEN_SETTINGS_LABELS.some((forbidden) => lower.includes(forbidden.toLowerCase()))
    ) {
      throw new Error(`Forbidden settings label: ${normalized}`);
    }
    for (const vendor of FORBIDDEN_SETTINGS_VENDORS) {
      if (lower.includes(vendor.toLowerCase())) {
        throw new Error(`Vendor-named settings label: ${normalized}`);
      }
    }
  }
}

export function assertNoUnreachableSettingsHref(destinations: unknown[]): void {
  for (const destination of destinations) {
    const normalized = normalizeLabel(destination);
    if (normalized === null) {
      continue;
    }
    const lower = normalized.toLowerCase();
    for (const href of SETTINGS_UNREACHABLE_HREFS) {
      if (lower.includes(href)) {
        throw new Error(`Unreachable settings href: ${normalized}`);
      }
    }
    if (lower.includes('f220')) {
      throw new Error(`Unreachable settings href: ${normalized}`);
    }
  }
}

export function visibleSettingsCopyValues(): string[] {
  return [
    copy.v1.back,
    copy.profile.notificationsTitle,
    copy.profile.notificationsEmpty,
    copy.profile.networkTitle,
    copy.profile.selectCluster,
    copy.profile.preferencesTitle,
    copy.profile.preferencesCurrency,
    copy.profile.preferencesHideBalances,
    copy.profile.preferencesBalanceHidden,
    copy.profile.aboutSection,
    copy.profile.aboutVersion,
    copy.profile.aboutSupport,
    copy.profile.aboutPrivacy,
    copy.profile.aboutTerms,
    copy.profile.aboutDelete,
    copy.profile.aboutEmailSupport,
    copy.profile.valueUnavailable,
    copy.stub.body,
    PREFERENCES_CURRENCY_VALUE,
  ];
}
