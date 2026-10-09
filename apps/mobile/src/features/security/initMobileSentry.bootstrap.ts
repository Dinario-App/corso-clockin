import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { bootstrapMobileSentry } from './mobileSentryBootstrap';

/**
 * Early crash-reporting bootstrap. Misconfiguration or missing build identity
 * is fail-closed: no SDK init and zero emission (`mobileSentryBootstrap.ts`).
 */
bootstrapMobileSentry({
  env: {
    EXPO_PUBLIC_FLAG_SENTRY: process.env.EXPO_PUBLIC_FLAG_SENTRY,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  },
  readIdentity: () => ({
    applicationId: Application.applicationId,
    nativeApplicationVersion: Application.nativeApplicationVersion,
    nativeBuildVersion: Application.nativeBuildVersion,
    updateId: Updates.updateId,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    channel: Updates.channel,
  }),
});
