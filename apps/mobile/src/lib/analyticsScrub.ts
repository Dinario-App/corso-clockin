import { wordlist as bip39English } from '@scure/bip39/wordlists/english';

export type AnalyticsPropertyValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | AnalyticsPropertyValue[]
  | { [key: string]: AnalyticsPropertyValue };
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

const BIP39_WORDS = new Set(bip39English);
const BIP39_LENGTHS = new Set([12, 15, 18, 21, 24]);
const MAX_SCRUB_DEPTH = 4;
const MAX_NESTED_KEYS = 32;
const MAX_NESTED_ARRAY = 32;
const SAFE_STRUCTURED_SENTINEL = '[redacted_structured_input]';

/**
 * #8 — deny-list for analytics + log scrubbing.
 * Keys are matched after normalizeKey (lower + snake). Compact form
 * (underscores stripped) catches authToken / auth_token / AUTH-TOKEN alike.
 */
const DENIED_PROPERTY_KEYS = new Set([
  'mnemonic',
  'phrase',
  'recovery_phrase',
  'recoveryphrase',
  'seed',
  'seed_phrase',
  'seedphrase',
  'private_key',
  'privatekey',
  'secret',
  'secret_key',
  'secretkey',
  'password',
  'passcode',
  'email',
  'authorization',
  'access_token',
  'accesstoken',
  'id_token',
  'idtoken',
  'refresh_token',
  'refreshtoken',
  // Finding #8 extensions
  'signed_transaction',
  'signedtransaction',
  'raw_transaction',
  'rawtransaction',
  'serialized_transaction',
  'serializedtransaction',
  'auth_token',
  'authtoken',
  'privy_access_token',
  'privyaccesstoken',
  'privy_token',
  'privytoken',
  'bearer',
  'bearer_token',
  'bearertoken',
  'api_key',
  'apikey',
  'api_secret',
  'apisecret',
  'client_secret',
  'clientsecret',
  'nonce',
  'signature',
  'challenge',
  'message_bytes',
  'messagebytes',
]);

const DENIED_COMPACT = new Set(
  [...DENIED_PROPERTY_KEYS].map((k) => k.replace(/_/g, '')),
);
const BUY_AUTH_DENIED_FRAGMENTS = [
  'nonce',
  'signature',
  'challenge',
  'messagebytes',
] as const;

const MNEMONIC_ASSIGNMENT_KEYS = new Set([
  'mnemonic',
  'seed',
  'phrase',
  'seedphrase',
  'recoveryphrase',
  'seed_phrase',
  'recovery_phrase',
]);

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function compactKey(key: string): string {
  return key.replace(/_/g, '');
}

function isDeniedKey(normalized: string): boolean {
  if (!normalized) return true;
  if (DENIED_PROPERTY_KEYS.has(normalized)) return true;
  if (DENIED_COMPACT.has(compactKey(normalized))) return true;
  // Substring traps: foo_signed_transaction_bar, privy_access_token_v2
  const compact = compactKey(normalized);
  if (BUY_AUTH_DENIED_FRAGMENTS.some((fragment) => compact.includes(fragment))) {
    return true;
  }
  for (const denied of DENIED_COMPACT) {
    if (denied.length >= 6 && compact.includes(denied)) return true;
  }
  return false;
}

function isMnemonicAssignmentKey(key: string): boolean {
  const normalized = normalizeKey(key);
  const compact = compactKey(normalized);
  if (MNEMONIC_ASSIGNMENT_KEYS.has(normalized) || MNEMONIC_ASSIGNMENT_KEYS.has(compact)) {
    return true;
  }
  return (
    compact.includes('mnemonic') ||
    compact.includes('seedphrase') ||
    compact.includes('recoveryphrase') ||
    compact === 'seed' ||
    compact === 'phrase'
  );
}

/**
 * Split candidate phrase on every non-letter separator (space, comma, hyphen,
 * underscore, dot, colon, slash, etc.) and strip boundary-affixed junk from
 * each token so `pre-abandon_ability...` / `:zoo:` still reconstruct.
 */
function tokenizeMnemonicCandidate(value: string): string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z]+/)
    .map((part) => part.replace(/^[^a-z]+|[^a-z]+$/g, ''))
    .filter(Boolean);
}

/** Wordlist-aware BIP39 detection for 12/15/18/21/24-word candidates. */
function looksLikeMnemonic(value: string): boolean {
  const words = tokenizeMnemonicCandidate(value);
  return (
    BIP39_LENGTHS.has(words.length) &&
    words.every((word) => BIP39_WORDS.has(word))
  );
}

function looksLikeSolanaAddress(value: string): boolean {
  return (
    value.length >= 32 &&
    value.length <= 64 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
  );
}

/** Base58 tx signatures are typically 87–88 chars (longer than addresses). */
function looksLikeSolanaSignature(value: string): boolean {
  return (
    value.length >= 64 &&
    value.length <= 128 &&
    /^[1-9A-HJ-NP-Za-km-z]+$/.test(value)
  );
}

/**
 * Long base64 blobs (signed txs, provider payloads).
 * Require `+`, `/`, or `=` so pure base58 signatures are not mistaken for base64.
 */
function looksLikeBase64Blob(value: string): boolean {
  if (value.length < 80) return false;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(value)) return false;
  if (value.length >= 96 && /^[A-Za-z0-9]+$/.test(value)) return true;
  if (!(value.includes('+') || value.includes('/') || value.includes('='))) {
    return false;
  }
  return true;
}

function truncateAddress(value: string): string {
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function truncateSignature(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

const SENSITIVE_ASSIGNMENT_RE =
  /(["']?)(authorization|auth[\s_-]*token|privy[\s_-]*access[\s_-]*token|bearer[\s_-]*token|api[\s_-]*(?:key|secret)|client[\s_-]*secret|secret[\s_-]*key|private[\s_-]*key|signed[\s_-]*transaction|raw[\s_-]*transaction|serialized[\s_-]*transaction|nonce|signature|challenge|(?:raw[\s_-]*)?message[\s_-]*bytes|recovery[\s_-]*phrase|seed[\s_-]*phrase|mnemonic|seed|phrase)[A-Za-z0-9_-]{0,64}\1([^A-Za-z0-9\s]{0,4}\s*[:=]\s*)/gi;

/** Runs of 12+ alpha words separated by any non-letter characters. */
const EMBEDDED_WORD_RUN_RE =
  /[a-z]+(?:[^a-z]+[a-z]+){11,}/gi;

function redactEmbeddedMnemonics(text: string): string {
  return text.replace(EMBEDDED_WORD_RUN_RE, (run) => {
    const words = tokenizeMnemonicCandidate(run);
    const redact = new Array<boolean>(words.length).fill(false);
    for (const len of [24, 21, 18, 15, 12] as const) {
      for (let i = 0; i + len <= words.length; i += 1) {
        const slice = words.slice(i, i + len);
        if (slice.every((word) => BIP39_WORDS.has(word))) {
          for (let j = i; j < i + len; j += 1) redact[j] = true;
        }
      }
    }
    if (!redact.some(Boolean)) return run;

    const out: string[] = [];
    let i = 0;
    while (i < words.length) {
      if (redact[i]) {
        out.push('[redacted_mnemonic]');
        while (i < words.length && redact[i]) i += 1;
        continue;
      }
      out.push(words[i]!);
      i += 1;
    }
    // Rebuild without leaking any redacted BIP39 suffix/substring tokens.
    return out.join(' ');
  });
}

function quotedValueEnd(text: string, start: number, quote: string): number {
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === quote) return index + 1;
  }
  return text.length;
}

function structuredValueEnd(text: string, start: number): number {
  const stack: string[] = [];
  let quote: string | null = null;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.at(-1) !== char) return text.length;
      stack.pop();
      if (stack.length === 0) return index + 1;
    }
  }
  return text.length;
}

/**
 * For mnemonic/seed/phrase assignments, consume the entire value including
 * whitespace/punctuation-separated BIP39 words (not just the first token).
 */
function mnemonicAssignmentValueEnd(text: string, start: number): number {
  if (start >= text.length) return start;
  const first = text[start];
  if (first === '"' || first === "'") {
    return quotedValueEnd(text, start, first);
  }
  if (first === '{' || first === '[') {
    return structuredValueEnd(text, start);
  }

  // Prefer a full 12/15/18/21/24 BIP39 run when present (any non-letter separators).
  const rest = text.slice(start);
  const bip39Run = rest.match(
    /^([a-z]+(?:[^a-z]+[a-z]+){23}|[a-z]+(?:[^a-z]+[a-z]+){20}|[a-z]+(?:[^a-z]+[a-z]+){17}|[a-z]+(?:[^a-z]+[a-z]+){14}|[a-z]+(?:[^a-z]+[a-z]+){11})(?![a-z])/i,
  );
  if (bip39Run && looksLikeMnemonic(bip39Run[0]!)) {
    return start + bip39Run[0]!.length;
  }

  // Otherwise consume a non-letter-separated alpha run or contiguous scalar.
  let end = start;
  while (end < text.length) {
    const ch = text[end]!;
    if (/[}\]]/.test(ch)) break;
    if (ch === ',' && !/[a-z]/i.test(text.slice(end + 1, end + 2))) break;
    if (/[^a-zA-Z0-9]/.test(ch)) {
      const moreWords = text.slice(end).match(/^[^a-zA-Z0-9]+[a-z]+/i);
      if (moreWords) {
        end += moreWords[0].length;
        continue;
      }
      break;
    }
    end += 1;
  }
  return end;
}

function sensitiveValueEnd(text: string, start: number, key: string): number {
  if (start >= text.length) return start;
  if (isMnemonicAssignmentKey(key)) {
    return mnemonicAssignmentValueEnd(text, start);
  }

  const first = text[start];
  if (first === '"' || first === "'") {
    return quotedValueEnd(text, start, first);
  }
  if (first === '{' || first === '[') {
    return structuredValueEnd(text, start);
  }

  let scalarStart = start;
  if (compactKey(normalizeKey(key)) === 'authorization') {
    const bearerPrefix = /^Bearer\s+/i.exec(text.slice(start));
    if (bearerPrefix) scalarStart += bearerPrefix[0].length;
  }
  let end = scalarStart;
  while (end < text.length && !/[\s,}\]]/.test(text[end]!)) end += 1;
  return end;
}

function scrubSensitiveAssignments(text: string): string {
  const matcher = new RegExp(
    SENSITIVE_ASSIGNMENT_RE.source,
    SENSITIVE_ASSIGNMENT_RE.flags,
  );
  let cursor = 0;
  let scrubbed = '';

  for (;;) {
    matcher.lastIndex = cursor;
    const match = matcher.exec(text);
    if (!match) break;
    const valueStart = match.index + match[0].length;
    const valueEnd = sensitiveValueEnd(text, valueStart, match[2]!);
    scrubbed += text.slice(cursor, valueStart);
    scrubbed += '[redacted_secret]';
    cursor = valueEnd;
  }

  return scrubbed + text.slice(cursor);
}

function scrubStringText(text: string): string {
  // Contextual secret assignments, including quoted JSON-like fields.
  let out = scrubSensitiveAssignments(text);
  // Embedded BIP39 wordlist phrases inside provider/error prose.
  out = redactEmbeddedMnemonics(out);
  out = out.replace(
    /\bBearer\s+([A-Za-z0-9._~+/=-]{8,})/gi,
    (match, credential: string) => {
      const candidate = credential.replace(/\.+$/, '');
      return /^[A-Za-z]+$/.test(candidate) && candidate.length < 24
        ? match
        : 'Bearer [redacted_secret]';
    },
  );

  // Base64-ish blobs (require + / or = so base58 is not wiped)
  out = out.replace(
    /[A-Za-z0-9][A-Za-z0-9+/]{60,}(?:[+/][A-Za-z0-9+/]*)?={0,2}/g,
    (m) =>
      m.includes('+') || m.includes('/') || m.includes('=')
        ? '[redacted_blob]'
        : m,
  );
  // Long hex (keys / hashes accidentally logged)
  out = out.replace(/\b[0-9a-fA-F]{64,}\b/g, '[redacted_hex]');
  // Unpadded serialized transactions can be pure alphanumeric base64.
  out = out.replace(/\b[A-Za-z0-9]{96,}\b/g, '[redacted_blob]');
  // Base58 signatures / addresses
  out = out.replace(/\b[1-9A-HJ-NP-Za-km-z]{64,128}\b/g, (m) =>
    truncateSignature(m),
  );
  out = out.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,63}\b/g, (m) =>
    truncateAddress(m),
  );
  return out.slice(0, 512);
}

/**
 * Scrub free-form provider / wallet error text before console or analytics.
 * Never throws; hostile structures yield a fixed safe sentinel.
 */
export function scrubProviderErrorMessage(input: unknown): string {
  try {
    if (input == null) return '';
    let text: string;
    if (typeof input === 'string') {
      text = input;
    } else if (typeof input === 'number' || typeof input === 'boolean') {
      text = String(input);
    } else if (typeof input === 'bigint') {
      text = String(input);
    } else if (isErrorLike(input)) {
      text = readErrorMessageSafely(input);
    } else {
      // Never serialize unknown structured inputs (avoids hostile toJSON hooks).
      return SAFE_STRUCTURED_SENTINEL;
    }
    return scrubStringText(text);
  } catch {
    return SAFE_STRUCTURED_SENTINEL;
  }
}

/**
 * Error-like classification via prototype or own data descriptor only.
 * Never reads accessors / invokes proxy traps / getters.
 * (Boolean return — not a type predicate — so control-flow does not collapse
 * the remaining object branch to `never`.)
 */
function isErrorLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (value instanceof Error) return true;
  try {
    const desc = Object.getOwnPropertyDescriptor(value, 'message');
    return Boolean(desc && 'value' in desc && typeof desc.value === 'string');
  } catch {
    return false;
  }
}

/** Read Error.message via own data descriptor only — never invoke getters. */
function readErrorMessageSafely(error: object): string {
  try {
    const desc = Object.getOwnPropertyDescriptor(error, 'message');
    if (desc && 'value' in desc && typeof desc.value === 'string') {
      return desc.value;
    }
    // Prototype Error.message is typically an own data prop; if only an accessor
    // exists, fail closed rather than invoke it.
    if (desc?.get || desc?.set) {
      return SAFE_STRUCTURED_SENTINEL;
    }
    if (error instanceof Error) {
      // Standard Error instances store message as own data; if missing, empty.
      return '';
    }
    return SAFE_STRUCTURED_SENTINEL;
  } catch {
    return SAFE_STRUCTURED_SENTINEL;
  }
}

/**
 * Every top-level string is scrubbed regardless of key name — BIP39 candidates,
 * seed punctuation, prefixes/suffixes, and secret assignments never ride under
 * a benign key like `note` / `label` / `detail_extra`.
 * Mint keys keep full mint addresses (retained PASS) unless secret material is present.
 */
function scrubStringProperty(key: string, value: string): string | null {
  // Bare mnemonic values are dropped (not emitted under any key).
  if (looksLikeMnemonic(value)) return null;

  // Mint addresses: still run secret/BIP39 detectors, but do not truncate a pure mint.
  if (key.includes('mint') && looksLikeSolanaAddress(value)) {
    const secretScrubbed = redactEmbeddedMnemonics(
      scrubSensitiveAssignments(value),
    );
    if (
      secretScrubbed.includes('[redacted_mnemonic]') ||
      secretScrubbed.includes('[redacted_secret]')
    ) {
      return null;
    }
    return value.slice(0, 256);
  }

  // Total string scrub (not limited to error/message keys).
  const scrubbedText = scrubProviderErrorMessage(value);
  // If scrubbing left only a secret/mnemonic sentinel, drop the key.
  const trimmed = scrubbedText.trim();
  if (
    trimmed === '[redacted_mnemonic]' ||
    trimmed === '[redacted_secret]' ||
    trimmed === '[redacted_blob]' ||
    trimmed === '[redacted_hex]'
  ) {
    return null;
  }
  // Embedded redactions are already safe markers — keep the scrubbed text.
  if (looksLikeBase64Blob(scrubbedText)) return null;
  if (looksLikeSolanaSignature(scrubbedText)) {
    return truncateSignature(scrubbedText);
  }
  if (looksLikeSolanaAddress(scrubbedText) && !key.includes('mint')) {
    return truncateAddress(scrubbedText);
  }
  return scrubbedText.slice(0, 256);
}

/** Reject property names that themselves embed BIP39 candidate material. */
function isBip39BearingPropertyName(rawKey: string): boolean {
  try {
    if (typeof rawKey !== 'string' || rawKey.length === 0) return true;
    if (looksLikeMnemonic(rawKey)) return true;
    // Normalized / compact forms (hyphen→snake, stripped separators) still catch.
    const normalized = normalizeKey(rawKey);
    if (looksLikeMnemonic(normalized)) return true;
    if (looksLikeMnemonic(normalized.replace(/_/g, ' '))) return true;
    if (looksLikeMnemonic(compactKey(normalized))) return true;
    const scrubbed = scrubStringText(rawKey);
    return (
      scrubbed.includes('[redacted_mnemonic]') ||
      scrubbed.includes('[redacted_secret]')
    );
  } catch {
    return true;
  }
}

/**
 * Final serialized-body gate: reject any recoverable BIP39 window in the exact
 * JSON that would leave the device. Own-data path only; never throws.
 * Our own `[redacted_*]` sentinels are not BIP39 words and pass.
 */
function serializedAnalyticsBodyHasRecoverableBip39(serialized: string): boolean {
  try {
    if (typeof serialized !== 'string' || serialized.length === 0) return false;
    return tokensContainBip39Window(tokenizeMnemonicCandidate(serialized));
  } catch {
    return true;
  }
}

const MAX_SCRUBBED_KEYS = 32;
const MAX_SCRUBBED_STRING = 256;

export const EVENT_PROPERTY_ALLOWLIST: Readonly<
  Record<string, readonly string[]>
> = {
  export_consent_ack: ['install_uuid', 'consent_version', 'timestamp'],
  swap_quote_age_at_signing: ['age_ms'],
};

/** True when this event name is governed by an allowlist rather than the deny-list alone. */
export function hasEventPropertyAllowlist(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(EVENT_PROPERTY_ALLOWLIST, name);
}

/**
 * Drop every property not on the named event's allowlist.
 * A no-op for events without an allowlist. Never throws.
 */
export function applyEventPropertyAllowlist(
  name: string,
  properties: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  try {
    if (!hasEventPropertyAllowlist(name)) return properties;
    const allowed = new Set(EVENT_PROPERTY_ALLOWLIST[name] ?? []);
    const out: Record<string, string | number | boolean | null> = {};
    for (const rawKey of Object.keys(properties)) {
      const key = normalizeKey(rawKey);
      if (!allowed.has(key)) continue;
      out[key] = properties[rawKey]!;
    }
    return out;
  } catch {
    // Fail closed: an allowlisted event with an unusable payload sends nothing.
    return {};
  }
}

/**
 * Validate the final bounded scrubbed payload using own data descriptors only —
 * never invoke getters/setters/accessors/toJSON on the result object.
 */
export function validateScrubbedAnalyticsPayload(
  payload: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!payload || typeof payload !== 'object') return out;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(payload);
    const keys = Object.keys(descriptors);
    let count = 0;
    for (const rawKey of keys) {
      if (count >= MAX_SCRUBBED_KEYS) break;
      const desc = descriptors[rawKey]!;
      // Never invoke accessors on the final payload.
      if (desc.get || desc.set || !('value' in desc)) continue;
      const value = desc.value;
      if (value === undefined) continue;
      if (typeof rawKey !== 'string' || isBip39BearingPropertyName(rawKey)) {
        continue;
      }
      if (isDeniedKey(normalizeKey(rawKey))) continue;
      if (typeof value === 'string') {
        if (value.length > MAX_SCRUBBED_STRING) continue;
        // Reject raw BIP39 leftovers that escaped scrubbing. Our own
        // `[redacted_*]` sentinels are safe and permitted.
        if (looksLikeMnemonic(value)) continue;
        out[rawKey] = value;
        count += 1;
        continue;
      }
      if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        out[rawKey] = value;
        count += 1;
      }
      // Structured leftovers are not permitted in the final flat payload.
    }
    return out;
  } catch {
    return { _scrub: SAFE_STRUCTURED_SENTINEL };
  }
}

/**
 * Traverse with own property descriptors + WeakSet. Never invoke getters,
 * setters, accessors, or toJSON. Cycles / depth / size limits fail closed.
 */
function scrubNestedValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): string | number | boolean | null | Record<string, unknown> | unknown[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (looksLikeMnemonic(value)) return '[redacted_mnemonic]';
    return scrubProviderErrorMessage(value);
  }
  if (typeof value !== 'object') {
    return SAFE_STRUCTURED_SENTINEL;
  }
  if (depth >= MAX_SCRUB_DEPTH) return '[redacted_nested]';
  if (seen.has(value)) return '[redacted_nested]';
  seen.add(value);

  if (isErrorLike(value)) {
    const message = readErrorMessageSafely(value as object);
    if (message === SAFE_STRUCTURED_SENTINEL) return SAFE_STRUCTURED_SENTINEL;
    return {
      name: 'Error',
      message: scrubProviderErrorMessage(message),
    };
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    const len = Math.min(value.length, MAX_NESTED_ARRAY);
    for (let i = 0; i < len; i += 1) {
      const desc = Object.getOwnPropertyDescriptor(value, i);
      if (!desc || desc.get || desc.set || !('value' in desc)) continue;
      const scrubbed = scrubNestedValue(desc.value, depth + 1, seen);
      if (scrubbed !== undefined) out.push(scrubbed);
    }
    return out;
  }

  const out: Record<string, unknown> = {};
  let count = 0;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const rawKey of Object.keys(descriptors)) {
    if (count >= MAX_NESTED_KEYS) break;
    const desc = descriptors[rawKey]!;
    // Never invoke accessors / setters / toJSON.
    if (desc.get || desc.set || !('value' in desc)) continue;
    if (rawKey === 'toJSON' && typeof desc.value === 'function') continue;
    const key = normalizeKey(rawKey);
    if (isDeniedKey(key)) continue;
    const scrubbed = scrubNestedValue(desc.value, depth + 1, seen);
    if (scrubbed === undefined) continue;
    out[key] = scrubbed;
    count += 1;
  }
  return out;
}

/**
 * Collect alphabetic tokens from own data descriptors only (never accessors).
 * Used to detect BIP39 candidates distributed across arrays/objects.
 */
function collectAlphaTokens(
  value: unknown,
  seen: WeakSet<object>,
  out: string[],
  budget: { remaining: number },
): void {
  if (budget.remaining <= 0) return;
  if (typeof value === 'string') {
    const tokens = tokenizeMnemonicCandidate(value);
    for (const token of tokens) {
      if (budget.remaining <= 0) return;
      out.push(token);
      budget.remaining -= 1;
    }
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    const len = Math.min(value.length, MAX_NESTED_ARRAY);
    for (let i = 0; i < len; i += 1) {
      if (budget.remaining <= 0) return;
      const desc = Object.getOwnPropertyDescriptor(value, i);
      if (!desc || desc.get || desc.set || !('value' in desc)) continue;
      collectAlphaTokens(desc.value, seen, out, budget);
    }
    return;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const rawKey of Object.keys(descriptors)) {
    if (budget.remaining <= 0) return;
    const desc = descriptors[rawKey]!;
    if (desc.get || desc.set || !('value' in desc)) continue;
    if (rawKey === 'toJSON' && typeof desc.value === 'function') continue;
    collectAlphaTokens(desc.value, seen, out, budget);
  }
}

function tokensContainBip39Window(tokens: string[]): boolean {
  for (const len of [24, 21, 18, 15, 12] as const) {
    for (let i = 0; i + len <= tokens.length; i += 1) {
      const slice = tokens.slice(i, i + len);
      if (slice.every((word) => BIP39_WORDS.has(word))) return true;
    }
  }
  return false;
}

/**
 * True when mnemonic material is present as a string, assignment form, or as
 * BIP39 word candidates distributed across nested arrays/objects.
 * If safe reconstruction is uncertain (budget exhausted with many tokens),
 * treat as sensitive so the caller drops to a fixed sentinel.
 */
function nestedContainsMnemonicMaterial(
  value: unknown,
  seen: WeakSet<object>,
): boolean {
  if (typeof value === 'string') {
    return (
      looksLikeMnemonic(value) ||
      /mnemonic\s*[:=]|seed(?:_phrase)?\s*[:=]|recovery_phrase\s*[:=]/i.test(
        value,
      )
    );
  }
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;

  const walkSeen = new WeakSet<object>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (typeof cur === 'string') {
      if (
        looksLikeMnemonic(cur) ||
        /mnemonic\s*[:=]|seed(?:_phrase)?\s*[:=]|recovery_phrase\s*[:=]/i.test(
          cur,
        )
      ) {
        return true;
      }
      continue;
    }
    if (typeof cur !== 'object' || cur === null) continue;
    if (walkSeen.has(cur)) continue;
    walkSeen.add(cur);
    if (Array.isArray(cur)) {
      const len = Math.min(cur.length, MAX_NESTED_ARRAY);
      for (let i = 0; i < len; i += 1) {
        const desc = Object.getOwnPropertyDescriptor(cur, i);
        if (!desc || desc.get || desc.set || !('value' in desc)) continue;
        stack.push(desc.value);
      }
      continue;
    }
    const descriptors = Object.getOwnPropertyDescriptors(cur);
    for (const rawKey of Object.keys(descriptors)) {
      const desc = descriptors[rawKey]!;
      if (desc.get || desc.set || !('value' in desc)) continue;
      if (rawKey === 'toJSON' && typeof desc.value === 'function') continue;
      stack.push(desc.value);
    }
  }

  // Distributed candidate detection across own data values.
  const tokens: string[] = [];
  const budget = { remaining: 64 };
  try {
    collectAlphaTokens(value, seen, tokens, budget);
  } catch {
    // Uncertain reconstruction → treat as sensitive.
    return true;
  }
  if (tokensContainBip39Window(tokens)) return true;
  // Many tokens but budget exhausted — reconstruction uncertain → drop.
  if (budget.remaining <= 0 && tokens.length >= 12) return true;
  return false;
}

/**
 * Scrub analytics event names through the same BIP39 / secret detectors.
 * Untyped / hostile names collapse to a fixed sentinel. Never throws.
 */
export function scrubAnalyticsEventName(name: unknown): string {
  const REDACTED_EVENT = '[redacted_event]';
  try {
    if (typeof name !== 'string' || name.length === 0) return REDACTED_EVENT;
    if (looksLikeMnemonic(name)) return REDACTED_EVENT;
    const scrubbed = scrubStringText(name);
    if (
      scrubbed.includes('[redacted_mnemonic]') ||
      scrubbed.includes('[redacted_secret]') ||
      scrubbed.includes('[redacted_blob]') ||
      scrubbed.includes('[redacted_hex]')
    ) {
      return REDACTED_EVENT;
    }
    // Bound + restrict to safe event-name characters after scrub.
    const bounded = scrubbed.slice(0, 128);
    if (!/^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/.test(bounded)) {
      return REDACTED_EVENT;
    }
    return bounded;
  } catch {
    return REDACTED_EVENT;
  }
}

function flattenNestedForProperty(
  nested: unknown,
): string | number | boolean | null | undefined {
  if (nested === undefined || nested === null) return nested;
  if (
    typeof nested === 'string' ||
    typeof nested === 'number' ||
    typeof nested === 'boolean'
  ) {
    return nested;
  }
  // Bounded JSON of already-scrubbed plain data only (no user toJSON).
  try {
    return scrubProviderErrorMessage(JSON.stringify(nested)).slice(0, 256);
  } catch {
    return SAFE_STRUCTURED_SENTINEL;
  }
}

export function buildAnalyticsTransportPayload(
  name: unknown,
  properties?: AnalyticsProperties | Record<string, unknown>,
): {
  name: string;
  properties: Record<string, string | number | boolean | null>;
} {
  let safeName: string;
  try {
    safeName = scrubAnalyticsEventName(name);
  } catch {
    safeName = '[redacted_event]';
  }
  let scrubbed: Record<string, string | number | boolean | null>;
  try {
    scrubbed = scrubClientProperties(properties);
    scrubbed = validateScrubbedAnalyticsPayload(scrubbed);
    scrubbed = applyEventPropertyAllowlist(safeName, scrubbed);
  } catch {
    scrubbed = { _scrub: SAFE_STRUCTURED_SENTINEL };
  }
  // Validate the exact serialized body that would leave the device.
  try {
    const body = JSON.stringify({ name: safeName, properties: scrubbed });
    if (serializedAnalyticsBodyHasRecoverableBip39(body)) {
      return {
        name: '[redacted_event]',
        properties: { _scrub: SAFE_STRUCTURED_SENTINEL },
      };
    }
  } catch {
    return {
      name: '[redacted_event]',
      properties: { _scrub: SAFE_STRUCTURED_SENTINEL },
    };
  }
  return { name: safeName, properties: scrubbed };
}

/** Client-side scrub before POST (defense in depth with API scrub). Never throws. */
export function scrubClientProperties(
  input?: AnalyticsProperties | Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  try {
    const out: Record<string, string | number | boolean | null> = {};
    if (!input || typeof input !== 'object') return out;

    const rootDescriptors = Object.getOwnPropertyDescriptors(input);
    for (const rawKey of Object.keys(rootDescriptors)) {
      try {
        const desc = rootDescriptors[rawKey]!;
        if (desc.get || desc.set || !('value' in desc)) continue;
        const value = desc.value;
        if (value === undefined) continue;
        // BIP39-bearing property names are rejected (never emitted).
        if (isBip39BearingPropertyName(rawKey)) continue;
        const key = normalizeKey(rawKey);
        if (isDeniedKey(key)) continue;
        if (isBip39BearingPropertyName(key)) continue;
        if (typeof value === 'string') {
          const scrubbed = scrubStringProperty(key, value);
          if (scrubbed == null) continue;
          out[key] = scrubbed;
          continue;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          out[key] = value;
          continue;
        }
        if (value === null) {
          out[key] = null;
          continue;
        }
        // Bounded nested non-primitives: recursively scrub via descriptors.
        // Distributed / uncertain BIP39 material → fixed sentinel (never omit
        // silently in a way that could leak via partial reconstruction).
        if (nestedContainsMnemonicMaterial(value, new WeakSet())) {
          out[key] = SAFE_STRUCTURED_SENTINEL;
          continue;
        }
        const nested = scrubNestedValue(value, 0, new WeakSet());
        if (nested === SAFE_STRUCTURED_SENTINEL) {
          out[key] = SAFE_STRUCTURED_SENTINEL;
          continue;
        }
        const flat = flattenNestedForProperty(nested);
        if (flat === undefined) continue;
        if (typeof flat === 'string') {
          const scrubbedFlat = scrubStringProperty(key, flat);
          if (scrubbedFlat == null) continue;
          out[key] = scrubbedFlat;
          continue;
        }
        out[key] = flat;
      } catch {
        // Drop this key; never propagate secret-bearing exception messages.
        continue;
      }
    }
    // Final bounded validation — descriptors only, no accessor invocation.
    return validateScrubbedAnalyticsPayload(out);
  } catch {
    return { _scrub: SAFE_STRUCTURED_SENTINEL };
  }
}
