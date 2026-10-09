import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import type {
  SupportDiagnostics,
  SupportSessionTypeLabelInput,
} from '@/src/features/support/supportEmail';

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** Resolved OTA runtime version, or the policy name when it is a policy. */
function readRuntimeVersion(): string | null {
  const runtimeVersion = Constants.expoConfig?.runtimeVersion;
  if (typeof runtimeVersion === 'string') return runtimeVersion;
  if (runtimeVersion && typeof runtimeVersion === 'object') {
    return asString((runtimeVersion as { policy?: unknown }).policy);
  }
  return null;
}

/**
 * Device CLASS, never a device name. Android exposes the model in
 * `Platform.constants`; iOS exposes only the interface idiom, which is the
 * honest answer there rather than a guess.
 */
function readDeviceModel(): string | null {
  const constants = Platform.constants as Record<string, unknown> | undefined;
  if (!constants) return null;
  return (
    asString(constants.Model) ??
    asString(constants.interfaceIdiom) ??
    asString(constants.systemName)
  );
}

function readOsVersion(): string | null {
  if (typeof Platform.Version === 'string') return Platform.Version;
  if (typeof Platform.Version === 'number') return String(Platform.Version);
  return null;
}

export function collectSupportDiagnostics(
  sessionType: SupportSessionTypeLabelInput,
): SupportDiagnostics {
  let buildVersion: string | null = null;
  try {
    buildVersion = asString(Application.nativeBuildVersion);
  } catch {
    // Not available on every runtime (Expo Go, web). Unknown is honest.
    buildVersion = null;
  }

  return {
    appVersion: asString(Constants.expoConfig?.version),
    buildVersion,
    runtimeVersion: readRuntimeVersion(),
    platform: asString(Platform.OS),
    osVersion: readOsVersion(),
    deviceModel: readDeviceModel(),
    sessionType,
  };
}
