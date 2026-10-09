import { copy } from '@/constants/copy';
import { normalizeSolanaAddressInput } from '@/src/ui/controls/addressChipPresentation.js';
import type { SettingsRowAccessory } from '@/src/ui/rows/settingsRowPresentation.js';

export type ProfileSourceState =
  | 'F127'
  | 'F128'
  | 'F129'
  | 'F130'
  | 'F131'
  | 'F132';

export const PROFILE_UNREACHABLE_SOURCE_STATES = ['F128', 'F129'] as const;

export type ProfileAddressPresentation = 'address-chip' | 'dash';

export const PROFILE_SECURITY_HREF = '/profile/security';

export type ProfileSecurityRowPresentation = {
  label: 'Security';
  accessory: 'chevron';
  hasDestination: true;
  href: typeof PROFILE_SECURITY_HREF;
};

const FORBIDDEN_PROFILE_ROW_LABELS = [
  'Recovery',
  'Wallets',
  'Advanced',
  'Import',
  'Connect',
  'Passkey',
  'WebAuthn',
  'Biometric',
  'Linked accounts',
] as const;

const FORBIDDEN_PROFILE_ROW_VENDORS = [
  'Privy',
  'Squads',
  'Grid',
  'Jupiter',
  'Helius',
] as const;

const FORBIDDEN_PROFILE_DESTINATION_FRAGMENTS = [
  '/advanced',
  'f220',
] as const;

export const PROFILE_LEGAL_ROW_LABELS = [
  copy.profile.aboutSupport,
  copy.profile.aboutPrivacy,
  copy.profile.aboutTerms,
  copy.profile.aboutDelete,
  copy.profile.aboutEmailSupport,
  copy.profile.aboutDisclosures,
] as const;

function normalizeProfileToastMessage(message: unknown): string | null {
  if (typeof message !== 'string') {
    return null;
  }
  const trimmed = message.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProfileSignOutError(error: unknown): string | null {
  if (typeof error !== 'string') {
    return null;
  }
  const trimmed = error.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeProfileSigningOut(value: unknown): boolean {
  return value === true;
}

export function resolveProfileAddressPresentation(
  address: unknown,
): ProfileAddressPresentation {
  return normalizeSolanaAddressInput(address) === null ? 'dash' : 'address-chip';
}

export function resolveProfileSecurityRow(): ProfileSecurityRowPresentation {
  return {
    label: 'Security',
    accessory: 'chevron',
    hasDestination: true,
    href: PROFILE_SECURITY_HREF,
  };
}

export function resolveProfileSourceState(input: {
  signingOut: unknown;
  signOutError: unknown;
  toastMessage: unknown;
}): ProfileSourceState {
  if (normalizeProfileSigningOut(input.signingOut)) {
    return 'F130';
  }

  if (normalizeProfileSignOutError(input.signOutError) !== null) {
    return 'F131';
  }

  if (
    normalizeProfileToastMessage(input.toastMessage) ===
    copy.profile.toastInstallIdCopied
  ) {
    return 'F132';
  }

  return 'F127';
}

export function resolveProfileSignOutLabel(signingOut: unknown): string {
  return normalizeProfileSigningOut(signingOut)
    ? copy.profile.signingOut
    : copy.profile.signOut;
}

export function resolveProfileToastTone(
  toastMessage: unknown,
): 'neutral' | 'error' | null {
  const message = normalizeProfileToastMessage(toastMessage);
  if (message === null) {
    return null;
  }
  if (message === copy.profile.toastCopyFailed) {
    return 'error';
  }
  return 'neutral';
}

export function assertNoForbiddenProfileRows(labels: unknown[]): void {
  for (const label of labels) {
    if (typeof label !== 'string') {
      continue;
    }
    const normalized = label.trim().toLowerCase();
    for (const forbidden of FORBIDDEN_PROFILE_ROW_LABELS) {
      if (normalized.includes(forbidden.toLowerCase())) {
        throw new Error(`Forbidden profile row label: ${label}`);
      }
    }
    for (const vendor of FORBIDDEN_PROFILE_ROW_VENDORS) {
      if (normalized.includes(vendor.toLowerCase())) {
        throw new Error(`Vendor-named profile row label: ${label}`);
      }
    }
  }
}

export function assertNoAdvancedProfileDestination(
  destinations: unknown[],
): void {
  for (const destination of destinations) {
    if (typeof destination !== 'string') {
      continue;
    }
    const normalized = destination.trim().toLowerCase();
    for (const fragment of FORBIDDEN_PROFILE_DESTINATION_FRAGMENTS) {
      if (normalized.includes(fragment)) {
        throw new Error(`Forbidden profile destination: ${destination}`);
      }
    }
  }
}

export function resolveProfileLegalRowAccessory(
  label: unknown,
): SettingsRowAccessory | null {
  if (typeof label !== 'string') {
    return null;
  }
  const trimmed = label.trim();
  if (!PROFILE_LEGAL_ROW_LABELS.includes(trimmed as typeof PROFILE_LEGAL_ROW_LABELS[number])) {
    return null;
  }
  return 'chevron';
}
