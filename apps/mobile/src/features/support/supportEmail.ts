import { copy } from '@/constants/copy';

/** The one support destination. Also the fallback shown when mail cannot open. */
export const SUPPORT_EMAIL = 'support@corso.trade';

export type SupportSessionTypeLabelInput =
  | 'privy_embedded'
  | 'imported_seed'
  | 'connected_external'
  | null
  | undefined;

export type SupportDiagnostics = {
  /** `app.json` / `expoConfig.version`, e.g. `0.1.0`. */
  appVersion: string | null;
  /** Native build number, e.g. `12`. */
  buildVersion: string | null;
  /** OTA runtime version. */
  runtimeVersion: string | null;
  /** `ios` | `android`. */
  platform: string | null;
  /** OS version, e.g. `18.2`. */
  osVersion: string | null;
  /** Device CLASS, never a device NAME (a device name is often a person's name). */
  deviceModel: string | null;
  /** The session-type LABEL only. Never the type's address, ids or tokens. */
  sessionType: SupportSessionTypeLabelInput;
};

/**
 * Key-shaped material. Each pattern is here because it is a real shape a
 * secret takes, not because the word is impolite.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /recovery phrase/i,
  /seed phrase/i,
  /\bmnemonic\b/i,
  /private key/i,
  /secret key/i,
  /\bpassphrase\b/i,
  /\bapi[\s_-]?key\b/i,
  /\bbearer\b/i,
  /\bsk-[A-Za-z0-9]/,
  /\bsk_live_/i,
  /\bxprv[0-9A-Za-z]/,
  /\bAIza[0-9A-Za-z_-]{10}/,
  /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /\b[0-9a-f]{64}\b/i,
  /\b[1-9A-HJ-NP-Za-km-z]{32,}\b/,
  /(?:\b[a-z]{3,8}\b[ \t]+){11,}/,
];

export function assertNoSecretMaterial(body: string): void {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(body)) {
      throw new Error('support email body carries key-shaped material');
    }
  }
}

function sanitizeDiagnosticValue(value: unknown): string {
  if (typeof value !== 'string') return copy.support.valueUnknown;
  const cleaned = value.replace(/[^A-Za-z0-9 ._()-]/g, '').trim();
  if (cleaned.length === 0) return copy.support.valueUnknown;
  return cleaned.slice(0, 32);
}

/**
 * The session-type LABEL, from the closed door set. Anything unrecognised
 * reports unknown rather than echoing the input back into the mail.
 */
export function resolveSessionTypeLabel(
  sessionType: SupportSessionTypeLabelInput,
): string {
  if (sessionType === 'privy_embedded') return copy.support.sessionEmbedded;
  if (sessionType === 'imported_seed') return copy.support.sessionImported;
  if (sessionType === 'connected_external')
    return copy.support.sessionConnected;
  return copy.support.sessionUnknown;
}

export function composeSupportEmailBody(
  diagnostics: SupportDiagnostics,
): string {
  const lines = [
    copy.support.bodyPrompt,
    '',
    '',
    '',
    copy.support.bodyDetailsHeading,
    `${copy.support.fieldAppVersion}: ${sanitizeDiagnosticValue(diagnostics.appVersion)}`,
    `${copy.support.fieldBuild}: ${sanitizeDiagnosticValue(diagnostics.buildVersion)}`,
    `${copy.support.fieldRuntime}: ${sanitizeDiagnosticValue(diagnostics.runtimeVersion)}`,
    `${copy.support.fieldPlatform}: ${sanitizeDiagnosticValue(diagnostics.platform)}`,
    `${copy.support.fieldOsVersion}: ${sanitizeDiagnosticValue(diagnostics.osVersion)}`,
    `${copy.support.fieldDevice}: ${sanitizeDiagnosticValue(diagnostics.deviceModel)}`,
    `${copy.support.fieldSignIn}: ${resolveSessionTypeLabel(diagnostics.sessionType)}`,
    '',
    copy.support.bodyFooter,
  ];
  const body = lines.join('\n');
  assertNoSecretMaterial(body);
  return body;
}

export function composeSupportEmailSubject(): string {
  return copy.support.subject;
}

/**
 * `mailto:` with subject and body percent-encoded. RFC 6068 encodes the
 * headers, so `encodeURIComponent` is right here and `encodeURI` is not.
 */
export function buildSupportMailtoUrl(diagnostics: SupportDiagnostics): string {
  const subject = encodeURIComponent(composeSupportEmailSubject());
  const body = encodeURIComponent(composeSupportEmailBody(diagnostics));
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
