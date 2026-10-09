import {
  MOBILE_ENVIRONMENT_SET,
  MOBILE_EXCEPTION_TYPES,
  MOBILE_LEVELS,
  MOBILE_PLATFORMS,
  MOBILE_TAG_VOCABULARY,
  MOBILE_UNLISTED_EXCEPTION_TYPE,
} from './mobileDiagnosticVocabulary';

export type MobileSentryTrustedMeta = {
  release?: string;
  dist?: string;
  environment?: string;
};

export type MobileCrashEvent = {
  event_id: string;
  timestamp: number;
  level?: string;
  platform?: string;
  release?: string;
  dist?: string;
  environment?: string;
  tags?: Record<string, string>;
  exception?: { values: Array<{ type: string }> };
};

const MAX_EXCEPTION_VALUES = 8;

class UnsafeShape extends Error {}

function isRecord(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOwn(object: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor)) throw new UnsafeShape();
  return descriptor.value;
}

function member(value: unknown, allowed: ReadonlySet<string>): string | undefined {
  return typeof value === 'string' && allowed.has(value) ? value : undefined;
}

function exactly(value: unknown, trusted: string | undefined): string | undefined {
  return trusted !== undefined && value === trusted ? trusted : undefined;
}

function projectTags(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, allowed] of Object.entries(MOBILE_TAG_VOCABULARY)) {
    const safe = member(readOwn(value, key), allowed);
    if (safe !== undefined) out[key] = safe;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function projectException(value: unknown): { values: Array<{ type: string }> } | undefined {
  if (!isRecord(value)) return undefined;
  const values = readOwn(value, 'values');
  if (!Array.isArray(values)) return undefined;
  const length = readOwn(values, 'length');
  if (typeof length !== 'number' || !Number.isSafeInteger(length)) return undefined;
  const out: Array<{ type: string }> = [];
  for (let index = 0; index < Math.min(length, MAX_EXCEPTION_VALUES); index += 1) {
    const item = readOwn(values, String(index));
    if (!isRecord(item)) continue;
    out.push({
      type: member(readOwn(item, 'type'), MOBILE_EXCEPTION_TYPES) ?? MOBILE_UNLISTED_EXCEPTION_TYPE,
    });
  }
  return out.length > 0 ? { values: out } : undefined;
}

function generatedEventId(): string {
  const bytes = new Uint8Array(16);
  const cryptoObject = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoObject?.getRandomValues) cryptoObject.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

export function mobileCrashBeforeSend(
  event: unknown,
  _hint?: unknown,
  trusted: MobileSentryTrustedMeta = {},
): MobileCrashEvent | null {
  try {
    if (!isRecord(event)) return null;
    const out: Omit<MobileCrashEvent, 'event_id' | 'timestamp'> = {};

    const level = member(readOwn(event, 'level'), MOBILE_LEVELS);
    if (level) out.level = level;
    const platform = member(readOwn(event, 'platform'), MOBILE_PLATFORMS);
    if (platform) out.platform = platform;
    const release = exactly(readOwn(event, 'release'), trusted.release);
    if (release) out.release = release;
    const dist = exactly(readOwn(event, 'dist'), trusted.dist);
    if (dist) out.dist = dist;
    const environment = exactly(
      readOwn(event, 'environment'),
      trusted.environment !== undefined && MOBILE_ENVIRONMENT_SET.has(trusted.environment)
        ? trusted.environment
        : undefined,
    );
    if (environment) out.environment = environment;
    const tags = projectTags(readOwn(event, 'tags'));
    if (tags) out.tags = tags;
    const exception = projectException(readOwn(event, 'exception'));
    if (exception) out.exception = exception;

    if (Object.keys(out).length === 0) return null;
    return { ...out, event_id: generatedEventId(), timestamp: Date.now() / 1000 };
  } catch {
    return null;
  }
}
