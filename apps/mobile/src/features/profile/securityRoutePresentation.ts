import { copy } from '@/constants/copy';
import { isFeeRateLabel } from '@/src/lib/feeRateLabel';
import { resolveExportEntryPointFromEnv } from '@/src/features/export/exportConfig';
import { NEUTRAL_BIOMETRIC_LABEL } from '@/src/features/security/biometricLabel';
import {
  resolveSafeRevealCeremony,
  resolveSafeRevealDoor,
  type SafeRevealDoor,
} from '@/src/features/security/safeRevealPresentation';
import { spacing } from '@/src/ui/tokens';
import type { CorsoIconName } from '@/src/ui/icons/corsoIconNames.js';
import type { SettingsRowAccessory } from '@/src/ui/rows/settingsRowPresentation.js';

export const SECURITY_SCREEN_GUTTER = spacing.gutter;

export const SECURITY_HUB_HREF = '/profile/security';
export const SECURITY_RECOVERY_HREF = '/profile/security/recovery';
export const SECURITY_MFA_HREF = '/profile/security/mfa';

export const SECURITY_WORDS_HREF = '/profile/words';
export const SECURITY_KEYS_HREF = '/profile/keys';

export const SECURITY_UNREACHABLE_SOURCE_STATES = [
  'F134',
  'F135',
  'F137',
  'F138',
  'F139',
  'F140',
  'F141',
  'F144',
  'F145',
] as const;

export const SECURITY_UNREACHABLE_HREFS = [
  '/profile/security/phrase',
  '/profile/security/advanced',
  '/profile/advanced',
  '/advanced',
] as const;

export type SecuritySourceState = 'F133' | 'F136' | 'F142' | 'F143';

export type SecurityHubRowId =
  | 'biometrics'
  | 'change-passcode'
  | 'wallet-signing-check'
  | 'wallet-recovery'
  | 'reveal-phrase'
  | 'export-key';

export type SecurityBiometricsRow = {
  id: 'biometrics';
  label: string;
  glyph: CorsoIconName;
  accessory: 'switch';
  checked: boolean;
  disabled: false;
  frame: 'F133' | 'F143';
};

export type SecurityPasscodeRow = {
  id: 'change-passcode';
  label: string;
  glyph: CorsoIconName;
  accessory: 'chevron';
  href: null;
  inHubAction: true;
  frame: 'F142';
};

export type SecurityRecoveryRow = {
  id: 'wallet-recovery';
  label: string;
  glyph: CorsoIconName;
  accessory: 'chevron';
  href: typeof SECURITY_RECOVERY_HREF;
  frame: 'F136';
};

export type SecurityMfaRow = {
  id: 'wallet-signing-check';
  label: string;
  glyph: CorsoIconName;
  accessory: 'value';
  value: string;
  href: typeof SECURITY_MFA_HREF;
};

export type SecurityRevealRow = {
  id: 'reveal-phrase' | 'export-key';
  label: string;
  glyph: CorsoIconName;
  accessory: 'chevron';
  href: typeof SECURITY_WORDS_HREF | typeof SECURITY_KEYS_HREF;
  /** Small caps line above the row. Ceremony copy, never authored here. */
  eyebrow: string;
  /** Muted line under the label — the import door names its step-up factor. */
  hint: string | null;
  door: SafeRevealDoor;
};

export type SecurityHubRow =
  | SecurityBiometricsRow
  | SecurityPasscodeRow
  | SecurityMfaRow
  | SecurityRecoveryRow
  | SecurityRevealRow;

export type SecurityRecoveryPresentation = {
  frame: 'F136';
  title: string;
  body: string;
  exportCta: false;
  phraseHref: null;
  phraseRow: false;
};

/**
 * Carried from `lock-setup.tsx` inline literals. Not new copy. Used when
 * the device cannot complete an app-lock change.
 */
export const SECURITY_BIOMETRICS_UNAVAILABLE =
  'Biometrics unavailable on this device.';
export const SECURITY_LOCK_ENABLE_FAILED = 'Could not enable lock';

const FORBIDDEN_SECURITY_LABELS = [
  'Show recovery phrase',
  'Disconnect',
  'Advanced',
  'Import',
  'Connect',
  'WebAuthn',
  'coming soon',
  'Backup complete',
  'Backup incomplete',
  'Autopilot',
  '85 bps',
  'Export private key',
  'Linked accounts',
] as const;

export const SECURITY_REVEAL_EXEMPT_LABELS = [
  copy.v1Security.safeReveal.importDoor.eyebrow,
  copy.v1Security.safeReveal.importDoor.entryLabel,
  copy.v1Security.safeReveal.exportDoor.eyebrow,
  copy.v1Security.safeReveal.exportDoor.entryLabel,
] as const;

const FORBIDDEN_SECURITY_VENDORS = [
  'Privy',
  'Squads',
  'Grid',
  'Jupiter',
  'Helius',
] as const;

function asBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeSecurityLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveSecurityHubFrame(
  biometricsEnabled: unknown,
): 'F133' | 'F143' {
  return asBoolean(biometricsEnabled) ? 'F133' : 'F143';
}

export function resolveSecuritySourceState(input: {
  route: unknown;
  biometricsEnabled: unknown;
}): SecuritySourceState {
  if (input.route === 'recovery') {
    return 'F136';
  }
  return resolveSecurityHubFrame(input.biometricsEnabled);
}

export function resolveSecurityHubRows(input: {
  biometricsEnabled: unknown;
  mfaApplicable: unknown;
  mfaMethods: unknown;
  sessionType?: unknown;
  /** Device-neutral (`getBiometricLabel`), never a literal Apple mark. */
  biometricLabel?: string;
}): SecurityHubRow[] {
  const biometricsOn = asBoolean(input.biometricsEnabled);
  const rows: SecurityHubRow[] = [
    {
      id: 'biometrics',
      label:
        typeof input.biometricLabel === 'string' && input.biometricLabel.length > 0
          ? input.biometricLabel
          : NEUTRAL_BIOMETRIC_LABEL,
      glyph: 'scan',
      accessory: 'switch',
      checked: biometricsOn,
      disabled: false,
      frame: resolveSecurityHubFrame(biometricsOn),
    },
    {
      id: 'change-passcode',
      label: copy.profile.securityChangePasscode,
      glyph: 'lock',
      accessory: 'chevron',
      href: null,
      inHubAction: true,
      frame: 'F142',
    },
  ];
  if (input.mfaApplicable === true) {
    rows.push({
      id: 'wallet-signing-check',
      label: copy.profile.securitySigningCheck,
      glyph: 'check',
      accessory: 'value',
      value: resolveMfaStateLabel(input.mfaMethods),
      href: SECURITY_MFA_HREF,
    });
  }
  rows.push({
    id: 'wallet-recovery',
    label: copy.profile.securityWalletRecovery,
    glyph: 'refresh',
    accessory: 'chevron',
    href: SECURITY_RECOVERY_HREF,
    frame: 'F136',
  });
  const revealRow = resolveSecurityRevealRow({
    sessionType: input.sessionType,
    biometricLabel: input.biometricLabel,
  });
  // `null` is the export door with its gate shut: Corso does not draw the row.
  if (revealRow !== null) {
    rows.push(revealRow);
  }
  return rows;
}

export function resolveSecurityRevealRow(input: {
  sessionType?: unknown;
  biometricLabel?: string;
}): SecurityRevealRow | null {
  const door = resolveSafeRevealDoor(input.sessionType);
  const biometricLabel =
    typeof input.biometricLabel === 'string' && input.biometricLabel.length > 0
      ? input.biometricLabel
      : NEUTRAL_BIOMETRIC_LABEL;
  if (door === 'import') {
    const ceremony = resolveSafeRevealCeremony({
      door: 'import',
      biometricLabel,
    });
    return {
      id: 'reveal-phrase',
      label: ceremony.entryLabel,
      glyph: 'lock',
      accessory: 'chevron',
      href: SECURITY_WORDS_HREF,
      eyebrow: ceremony.eyebrow,
      hint: ceremony.entryHint,
      door: 'import',
    };
  }
  if (!resolveExportEntryPointFromEnv().enabled) {
    return null;
  }
  const ceremony = resolveSafeRevealCeremony({
    door: 'export',
    biometricLabel,
  });
  return {
    id: 'export-key',
    label: ceremony.entryLabel,
    glyph: 'lock',
    accessory: 'chevron',
    href: SECURITY_KEYS_HREF,
    eyebrow: ceremony.eyebrow,
    hint: null,
    door: 'export',
  };
}

export function resolveMfaStateLabel(methods: unknown): string {
  if (!Array.isArray(methods)) return copy.profile.securityMfaNotEnrolled;
  const known = new Set(
    methods.filter(
      (method): method is 'passkey' | 'totp' | 'sms' =>
        method === 'passkey' || method === 'totp' || method === 'sms',
    ),
  );
  if (known.has('passkey') && known.has('totp') && known.size === 2) {
    return copy.profile.securityMfaBoth;
  }
  const labels = [
    known.has('passkey') ? copy.profile.securityMfaPasskey : null,
    known.has('totp') ? copy.profile.securityMfaTotp : null,
    known.has('sms') ? copy.profile.securityMfaSms : null,
  ].filter((label): label is NonNullable<typeof label> => label !== null);
  if (labels.length === 0) return copy.profile.securityMfaNotEnrolled;
  if (labels.length === 1) return labels[0]!;
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}

export type SecurityRecoveryShape = 'sign-in' | 'imported' | 'connected';

export function resolveSecurityRecoveryShape(
  sessionType: unknown,
): SecurityRecoveryShape {
  if (sessionType === 'privy_embedded') return 'sign-in';
  if (sessionType === 'connected_external') return 'connected';
  return 'imported';
}

const RECOVERY_BODY: Readonly<Record<SecurityRecoveryShape, string>> = {
  'sign-in': copy.trust.privyRecovery,
  imported: copy.trust.importedRecovery,
  connected: copy.trust.connectedRecovery,
};

export function resolveSecurityRecoveryPresentation(input?: {
  sessionType?: unknown;
}): SecurityRecoveryPresentation {
  return {
    frame: 'F136',
    title: copy.profile.securityWalletRecovery,
    body: RECOVERY_BODY[resolveSecurityRecoveryShape(input?.sessionType)],
    exportCta: false,
    phraseHref: null,
    phraseRow: false,
  };
}

/** Every recovery body the screen can draw — for the module-load copy guards. */
export function securityRecoveryBodies(): string[] {
  return Object.values(RECOVERY_BODY);
}

export const SECURITY_RECOVERY_PHRASE_EXEMPT_LABELS = [
  copy.trust.importedRecovery,
] as const;

export function resolveSecurityHubRowAccessory(
  id: unknown,
): SettingsRowAccessory | null {
  if (id === 'biometrics') return 'switch';
  if (id === 'change-passcode') return 'chevron';
  if (id === 'wallet-signing-check') return 'value';
  if (id === 'wallet-recovery') return 'chevron';
  if (id === 'reveal-phrase' || id === 'export-key') return 'chevron';
  return null;
}

export function assertNoForbiddenSecurityLabels(labels: unknown[]): void {
  for (const label of labels) {
    const normalized = normalizeSecurityLabel(label);
    if (normalized === null) {
      continue;
    }
    if (
      (SECURITY_REVEAL_EXEMPT_LABELS as readonly string[]).includes(normalized)
    ) {
      continue;
    }
    const lower = normalized.toLowerCase();
    if (
      isFeeRateLabel(normalized) ||
      FORBIDDEN_SECURITY_LABELS.some((forbidden) => lower.includes(forbidden.toLowerCase()))
    ) {
      throw new Error(`Forbidden security label: ${normalized}`);
    }
    for (const vendor of FORBIDDEN_SECURITY_VENDORS) {
      if (lower.includes(vendor.toLowerCase())) {
        throw new Error(`Vendor-named security label: ${normalized}`);
      }
    }
  }
}

export function assertNoUnreachableSecurityHref(destinations: unknown[]): void {
  for (const destination of destinations) {
    const normalized = normalizeSecurityLabel(destination);
    if (normalized === null) {
      continue;
    }
    const lower = normalized.toLowerCase();
    for (const href of SECURITY_UNREACHABLE_HREFS) {
      if (lower.includes(href)) {
        throw new Error(`Unreachable security href: ${normalized}`);
      }
    }
    if (lower.includes('f220')) {
      throw new Error(`Unreachable security href: ${normalized}`);
    }
  }
}

export function visibleSecurityCopyValues(): string[] {
  return [
    copy.v1.back,
    copy.profile.securityTitle,
    copy.profile.securityChangePasscode,
    copy.profile.securitySigningCheck,
    copy.profile.securityMfaNotEnrolled,
    copy.profile.securityMfaPasskey,
    copy.profile.securityMfaTotp,
    copy.profile.securityMfaSms,
    copy.profile.securityWalletRecovery,
    ...securityRecoveryBodies(),
    ...SECURITY_REVEAL_EXEMPT_LABELS,
  ];
}
