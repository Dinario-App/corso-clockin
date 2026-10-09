/** Closed set. Never derived from page-supplied text. */
export type ExportBridgeCode = 'cancelled' | 'failed' | 'unsupported';

export type ExportBridgeResult =
  | { status: 'success' }
  | { status: 'error'; code: ExportBridgeCode }
  | { status: 'ignored'; reason: 'oversized' | 'unparsable' | 'unknown_shape' };

/** Hard cap before we even attempt JSON.parse. A key blob must not fit a code path. */
const MAX_BRIDGE_BYTES = 512;

/**
 * Map a provider error to a bounded code WITHOUT retaining the string.
 * Only lowercase keyword presence is consulted; the string is then discarded.
 */
function classifyError(raw: unknown): ExportBridgeCode {
  if (typeof raw !== 'string') return 'failed';
  const text = raw.slice(0, MAX_BRIDGE_BYTES).toLowerCase();
  if (
    text.includes('cancel') ||
    text.includes('dismiss') ||
    text.includes('abort') ||
    text.includes('closed by user')
  ) {
    return 'cancelled';
  }
  if (
    text.includes('unsupported') ||
    text.includes('not supported') ||
    text.includes('no embedded wallet')
  ) {
    return 'unsupported';
  }
  return 'failed';
}

/**
 * Parse `event.nativeEvent.data`.
 * @param raw the exact string the WebView delivered.
 */
export function parseExportBridgeMessage(raw: unknown): ExportBridgeResult {
  if (typeof raw !== 'string') {
    return { status: 'ignored', reason: 'unparsable' };
  }
  if (raw.length === 0 || raw.length > MAX_BRIDGE_BYTES) {
    return { status: 'ignored', reason: 'oversized' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'ignored', reason: 'unparsable' };
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    return { status: 'ignored', reason: 'unknown_shape' };
  }

  // Own data descriptors only — never invoke a getter the page authored.
  const statusDesc = Object.getOwnPropertyDescriptor(parsed, 'status');
  if (!statusDesc || statusDesc.get || statusDesc.set || !('value' in statusDesc)) {
    return { status: 'ignored', reason: 'unknown_shape' };
  }
  const status = statusDesc.value;

  if (status === 'success') {
    // Any extra fields on a success message are discarded, unread.
    return { status: 'success' };
  }

  if (status === 'error') {
    const errorDesc = Object.getOwnPropertyDescriptor(parsed, 'error');
    const errorValue =
      errorDesc && !errorDesc.get && !errorDesc.set && 'value' in errorDesc
        ? errorDesc.value
        : undefined;
    return { status: 'error', code: classifyError(errorValue) };
  }

  return { status: 'ignored', reason: 'unknown_shape' };
}

/** True when the result should tear the WebView down. */
export function shouldDismissOnBridgeResult(
  result: ExportBridgeResult,
): boolean {
  return result.status === 'success' || result.status === 'error';
}
