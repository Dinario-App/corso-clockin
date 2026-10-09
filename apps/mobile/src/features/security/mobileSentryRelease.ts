import {
  MOBILE_ENVIRONMENT_SET,
  type MobileSentryEnvironment,
} from './mobileDiagnosticVocabulary';

export type MobileSentryMeta = {
  release?: string;
  dist?: string;
  environment?: MobileSentryEnvironment;
};

export type MobileBuildIdentity = {
  applicationId: string | null | undefined;
  nativeApplicationVersion: string | null | undefined;
  nativeBuildVersion: string | null | undefined;
  updateId?: string | null;
  isEmbeddedLaunch?: boolean;
  channel?: string | null;
};

const APPLICATION_IDS: ReadonlySet<string> = new Set([
  'app.corso.wallet',
  'com.dinario.app',
  'com.dinario.app.preview',
]);

const CHANNEL_ENVIRONMENTS: Readonly<Record<string, MobileSentryEnvironment>> = {
  production: 'production',
  'production-seeker': 'production',
  staging: 'staging',
  'staging-seeker': 'staging',
  development: 'development',
  'development-seeker': 'development',
};

export function resolveMobileSentryMeta(identity: MobileBuildIdentity): MobileSentryMeta {
  const meta: MobileSentryMeta = {};
  const { applicationId, nativeApplicationVersion: version, nativeBuildVersion: build } = identity;
  const buildOk = typeof build === 'string' && /^\d{1,9}$/.test(build);
  if (
    typeof applicationId === 'string' &&
    APPLICATION_IDS.has(applicationId) &&
    typeof version === 'string' &&
    /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(version) &&
    buildOk
  ) {
    meta.release = `${applicationId}@${version}+${build}`;
  }
  const updateId = identity.updateId?.toLowerCase();
  if (
    identity.isEmbeddedLaunch === false &&
    typeof updateId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(updateId)
  ) {
    meta.dist = updateId;
  } else if (buildOk) {
    meta.dist = build as string;
  }
  const environment = identity.channel ? CHANNEL_ENVIRONMENTS[identity.channel] : undefined;
  if (environment && MOBILE_ENVIRONMENT_SET.has(environment)) meta.environment = environment;
  return meta;
}
