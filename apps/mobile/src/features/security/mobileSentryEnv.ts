export type MobileSentryEnv = {
  FLAG_SENTRY: boolean;
  SENTRY_DSN: string | undefined;
};

export type MobileSentryEnvInput = {
  EXPO_PUBLIC_FLAG_SENTRY?: string;
  EXPO_PUBLIC_SENTRY_DSN?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error('EXPO_PUBLIC_FLAG_SENTRY must be "0" or "1"');
  }
  return raw === '1';
}

export function isValidSentryDsn(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:') return false;
    if (!url.username) return false;
    if (url.password !== '') return false;
    if (url.search !== '') return false;
    if (url.hash !== '') return false;
    if (!url.hostname) return false;
    const projectId = url.pathname.replace(/^\//, '');
    return /^\d+$/.test(projectId);
  } catch {
    return false;
  }
}

function parseOptionalSentryDsn(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (!isValidSentryDsn(raw)) {
    throw new Error('EXPO_PUBLIC_SENTRY_DSN must be a non-empty HTTPS Sentry DSN');
  }
  return raw;
}

export function parseMobileSentryEnv(
  input: MobileSentryEnvInput = {},
): MobileSentryEnv {
  const FLAG_SENTRY = parseEnvFlag(input.EXPO_PUBLIC_FLAG_SENTRY, '0');
  const SENTRY_DSN = parseOptionalSentryDsn(input.EXPO_PUBLIC_SENTRY_DSN);

  if (FLAG_SENTRY && !SENTRY_DSN) {
    throw new Error(
      'EXPO_PUBLIC_SENTRY_DSN is required when EXPO_PUBLIC_FLAG_SENTRY is enabled',
    );
  }

  return { FLAG_SENTRY, SENTRY_DSN };
}

export function shouldInitMobileSentry(
  env: Pick<MobileSentryEnv, 'FLAG_SENTRY' | 'SENTRY_DSN'>,
): boolean {
  return env.FLAG_SENTRY && env.SENTRY_DSN !== undefined;
}
