export const EXPORT_CONSENT_ACK_EVENT = 'export_consent_ack';

/** The complete, closed set of property keys for this event. */
export const EXPORT_CONSENT_ACK_PROPERTY_KEYS = [
  'install_uuid',
  'consent_version',
  'timestamp',
] as const;

export type ExportConsentAckProperties = {
  install_uuid: string;
  consent_version: string;
  timestamp: string;
};

/**
 * Render the 16-byte install id as a dashed UUID (8-4-4-4-12).
 *
 * This is not cosmetic. The analytics scrub truncates any 32–64 char base58-
 * shaped string to `abcd…wxyz` because that is the shape of a wallet address.
 * A bare 32-char hex install id can be entirely base58-alphabet, so it would be
 * silently truncated and the consent record would lose its join key. Dashes
 * take it out of the base58 alphabet, so the value survives the scrub intact
 * while remaining the same identifier the user can read off Profile → Install ID.
 *
 * Returns null when the input is not a 32-char hex id — fail closed rather than
 * emit a half-formed identifier.
 */
export function formatInstallUuid(
  anonymousId: string | undefined | null,
): string | null {
  if (typeof anonymousId !== 'string') return null;
  const value = anonymousId.trim().toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(value)) return null;
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join('-');
}

export type ConsentAckResult =
  | { ok: true; name: string; properties: ExportConsentAckProperties }
  | { ok: false; reason: 'bad_install_uuid' | 'bad_consent_version' | 'bad_timestamp' };

/**
 * Build the event. Constructs the object literal from scratch — a caller
 * cannot add a key, because no caller-supplied object is ever spread in.
 */
export function buildExportConsentAckEvent(input: {
  anonymousId: string | undefined | null;
  consentVersion: string;
  timestamp: string;
}): ConsentAckResult {
  const installUuid = formatInstallUuid(input.anonymousId);
  if (!installUuid) return { ok: false, reason: 'bad_install_uuid' };

  const consentVersion =
    typeof input.consentVersion === 'string' ? input.consentVersion.trim() : '';
  if (!/^[a-z0-9_]{1,64}$/.test(consentVersion)) {
    return { ok: false, reason: 'bad_consent_version' };
  }

  const timestamp =
    typeof input.timestamp === 'string' ? input.timestamp.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(timestamp)) {
    return { ok: false, reason: 'bad_timestamp' };
  }

  return {
    ok: true,
    name: EXPORT_CONSENT_ACK_EVENT,
    properties: {
      install_uuid: installUuid,
      consent_version: consentVersion,
      timestamp,
    },
  };
}
