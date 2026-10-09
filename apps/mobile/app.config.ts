import type { ExpoConfig, ConfigContext } from 'expo/config';
import { withSentry } from '@sentry/react-native/expo';
import { withEntitlementsPlist } from 'expo/config-plugins';

type RampLinkConfig = {
  hostname: string;
  port?: string;
  pathPrefix: string;
  iosAssociatedDomain: string;
  androidIntentFilter: {
    action: 'VIEW';
    autoVerify: true;
    data: Array<{
      scheme: 'https';
      host: string;
      port?: string;
      pathPrefix: string;
    }>;
    category: ['BROWSABLE', 'DEFAULT'];
  };
};

export type RampLinkConfigResult =
  | { ok: true; config: RampLinkConfig }
  | { ok: false; reason: 'missing' | 'invalid' };

/**
 * Derive native Universal/App Link config from the exact hosted ramp return.
 * No fallback domain is allowed: absent/invalid env leaves these capabilities
 * out of the native build until hosting is ready.
 */
export function resolveRampLinkConfig(
  value: string | undefined | null,
): RampLinkConfigResult {
  const raw = value?.trim() ?? '';
  if (!raw) return { ok: false, reason: 'missing' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.hash !== '' ||
    !url.hostname
  ) {
    return { ok: false, reason: 'invalid' };
  }

  const hostname = url.hostname;
  const port = url.port || undefined;
  const hostWithPort = port ? `${hostname}:${port}` : hostname;
  const pathPrefix = url.pathname || '/';

  return {
    ok: true,
    config: {
      hostname,
      ...(port ? { port } : {}),
      pathPrefix,
      iosAssociatedDomain: `applinks:${hostWithPort}`,
      androidIntentFilter: {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: hostname,
            ...(port ? { port } : {}),
            pathPrefix,
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    },
  };
}

type CorsoFlavor = 'play' | 'seeker';

const PLAY_ANDROID_PACKAGE = 'app.corso.wallet';
const SEEKER_STORE_ANDROID_PACKAGE = 'com.dinario.app';
const SEEKER_PREVIEW_ANDROID_PACKAGE = 'com.dinario.app.preview';
const PRODUCTION_SEEKER_TRACK = 'production';

function resolveFlavor(raw: string | undefined): CorsoFlavor {
  return raw === 'seeker' ? 'seeker' : 'play';
}

function resolveAndroidPackage(
  flavorRaw: string | undefined,
  seekerTrackRaw: string | undefined,
): string {
  if (flavorRaw !== 'seeker') return PLAY_ANDROID_PACKAGE;
  if (seekerTrackRaw === PRODUCTION_SEEKER_TRACK) {
    return SEEKER_STORE_ANDROID_PACKAGE;
  }
  return SEEKER_PREVIEW_ANDROID_PACKAGE;
}

export const LAUNCH_VERSION = '1.0.0';

const SENTRY_PLUGIN_BASE = {
  organization: 'dinario',
  project: 'corso-mobile',
  url: 'https://sentry.io/',
} as const;

function applySentryPlugin(config: ExpoConfig): ExpoConfig {
  const authToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  if (!authToken) return config;

  // Sentry reads the token from the build environment. Never serialize it
  // into Expo config or install upload scripts for builds that cannot upload.
  return withSentry(config, SENTRY_PLUGIN_BASE);
}

function withoutStagingPushEntitlement(config: ExpoConfig): ExpoConfig {
  if (process.env.APP_ENV !== 'staging') return config;
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const flavor = resolveFlavor(process.env.CORSO_FLAVOR);
  const androidPackage = resolveAndroidPackage(
    process.env.CORSO_FLAVOR,
    process.env.CORSO_SEEKER_TRACK,
  );
  const rampLinks = resolveRampLinkConfig(
    process.env.EXPO_PUBLIC_RAMP_RETURN_URL,
  );

  const ios = {
    ...config.ios,
    bundleIdentifier: 'app.corso.wallet',
    infoPlist: {
      ...config.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
    },
    ...(rampLinks.ok
      ? { associatedDomains: [rampLinks.config.iosAssociatedDomain] }
      : {}),
  };
  const android = {
    ...config.android,
    package: androidPackage,
    ...(rampLinks.ok
      ? {
          intentFilters: [
            ...(config.android?.intentFilters ?? []),
            rampLinks.config.androidIntentFilter,
          ],
        }
      : {}),
  };

  return withoutStagingPushEntitlement(
    applySentryPlugin({
      ...config,
      name: 'Corso',
      slug: config.slug ?? 'corso',
      ios,
      android,
      extra: {
        ...config.extra,
        flavor,
      },
    } as ExpoConfig),
  );
};
