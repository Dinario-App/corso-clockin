import { copy } from '@/constants/copy';
import {
  PROFILE_ABOUT_HREF,
  PROFILE_HOW_IT_WORKS_HREF,
  PROFILE_NETWORK_HREF,
  PROFILE_NOTIFICATIONS_HREF,
  PROFILE_PREFERENCES_HREF,
  PROFILE_PRIVACY_HREF,
  assertNoForbiddenSettingsLabels,
  assertNoUnreachableSettingsHref,
} from '@/src/features/profile/settingsRoutePresentation';
import { SECURITY_RECOVERY_HREF } from '@/src/features/profile/securityRoutePresentation';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import { defaultAssistantRow } from '@/src/features/aiConsent/ui/defaultAssistantRow';
import type { DefaultAssistantDecision } from '@/src/features/aiConsent/aiConsentStore';

export type SettingsDetailRow =
  | {
      id: 'biometrics' | 'analytics' | 'default-assistant';
      kind: 'switch';
      glyph: CorsoIconName;
      label: string;
      sub: string;
      checked: boolean;
      disabled: boolean;
      /** Set only where a cleared label exists; the screen falls back per id. */
      accessibilityLabel?: string;
    }
  | {
      id:
        | 'wallet-recovery'
        | 'notifications'
        | 'network'
        | 'preferences'
        | 'about'
        | 'privacy-policy'
        | 'how-it-works';
      kind: 'chevron';
      glyph: CorsoIconName;
      label: string;
      href: string;
    }
  | {
      id: 'contact-support';
      kind: 'action';
      glyph: CorsoIconName;
      label: string;
      sub: string;
    }
  | {
      id: 'reduce-motion';
      kind: 'value';
      glyph: CorsoIconName;
      label: string;
      sub: string;
      value: string;
    };

export type SettingsDetailSection = {
  id: 'security' | 'app' | 'privacy' | 'help';
  heading: string;
  rows: SettingsDetailRow[];
};

export type SettingsDetailPresentation = {
  title: string;
  sections: SettingsDetailSection[];
};

export function resolveSettingsDetailPresentation(input: {
  /** Device-neutral label (`getBiometricLabel`), never a literal Apple mark. */
  biometricLabel: string;
  biometricsOn: unknown;
  /** False until the stored preference has been read; the switch waits. */
  biometricsReady: unknown;
  busy?: unknown;
  reduceMotion: unknown;
  analyticsOn: unknown;
  /** False until `isAnalyticsOptedOut()` has answered; the switch waits. */
  analyticsReady: unknown;
  assistantDecision?: unknown;
}): SettingsDetailPresentation {
  const assistant = defaultAssistantRow(
    input.assistantDecision === 'allowed' ||
      input.assistantDecision === 'declined'
      ? (input.assistantDecision as DefaultAssistantDecision)
      : 'unset',
  );
  const presentation: SettingsDetailPresentation = {
    title: copy.v1.settings,
    sections: [
      {
        id: 'security',
        heading: copy.profile.securityTitle,
        rows: [
          {
            id: 'biometrics',
            kind: 'switch',
            glyph: 'lock',
            label: input.biometricLabel,
            sub: copy.account.biometricsSub,
            checked: input.biometricsOn === true,
            disabled: input.biometricsReady !== true || input.busy === true,
          },
          {
            id: 'wallet-recovery',
            kind: 'chevron',
            glyph: 'refresh',
            label: copy.profile.securityWalletRecovery,
            href: SECURITY_RECOVERY_HREF,
          },
        ],
      },
      {
        id: 'app',
        heading: copy.account.sectionApp,
        rows: [
          {
            id: 'notifications',
            kind: 'chevron',
            glyph: 'bell',
            label: copy.profile.notificationsTitle,
            href: PROFILE_NOTIFICATIONS_HREF,
          },
          {
            id: 'reduce-motion',
            kind: 'value',
            glyph: 'sparkle',
            label: copy.account.reduceMotion,
            sub: copy.account.reduceMotionSub,
            value:
              input.reduceMotion === true
                ? copy.account.reduceMotionOnSystem
                : copy.account.reduceMotionFollowsSystem,
          },
          {
            id: 'network',
            kind: 'chevron',
            glyph: 'discover',
            label: copy.profile.networkTitle,
            href: PROFILE_NETWORK_HREF,
          },
          {
            id: 'preferences',
            kind: 'chevron',
            glyph: 'settings',
            label: copy.profile.preferencesTitle,
            href: PROFILE_PREFERENCES_HREF,
          },
          {
            id: 'about',
            kind: 'chevron',
            glyph: 'more',
            label: copy.profile.aboutSection,
            href: PROFILE_ABOUT_HREF,
          },
        ],
      },
      {
        id: 'privacy',
        heading: copy.profile.privacySection,
        rows: [
          {
            id: 'privacy-policy',
            kind: 'chevron',
            glyph: 'copy',
            label: copy.profile.aboutPrivacy,
            href: PROFILE_PRIVACY_HREF,
          },
          {
            id: 'analytics',
            kind: 'switch',
            glyph: 'trend',
            label: copy.profile.analyticsToggle,
            sub: copy.profile.analyticsTitle,
            checked: input.analyticsOn === true,
            disabled: input.analyticsReady !== true || input.busy === true,
          },
          {
            id: 'default-assistant',
            kind: 'switch',
            glyph: 'sparkle',
            label: assistant.label,
            sub: assistant.sub,
            checked: assistant.checked,
            disabled: input.busy === true,
            accessibilityLabel: assistant.accessibilityLabel,
          },
        ],
      },
      {
        id: 'help',
        heading: copy.support.sectionHeading,
        rows: [
          {
            id: 'how-it-works',
            kind: 'chevron',
            glyph: 'help',
            label: copy.howItWorks.title,
            href: PROFILE_HOW_IT_WORKS_HREF,
          },
          {
            id: 'contact-support',
            kind: 'action',
            glyph: 'mail',
            label: copy.support.contactTitle,
            sub: copy.support.contactSub,
          },
        ],
      },
    ],
  };

  assertNoForbiddenSettingsLabels(
    presentation.sections.flatMap((section) => [
      section.heading,
      ...section.rows.flatMap((row) => [
        row.label,
        'sub' in row ? row.sub : null,
        'value' in row ? row.value : null,
      ]),
    ]),
  );
  assertNoUnreachableSettingsHref(
    presentation.sections.flatMap((section) =>
      section.rows.map((row) => ('href' in row ? row.href : null)),
    ),
  );
  return presentation;
}
