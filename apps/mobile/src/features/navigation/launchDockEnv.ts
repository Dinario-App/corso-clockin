export type LaunchDockEnv = Readonly<{
  FLAG_LAUNCH_DOCK: boolean;
}>;

export type LaunchDockEnvInput = {
  EXPO_PUBLIC_FLAG_LAUNCH_DOCK?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error('EXPO_PUBLIC_FLAG_LAUNCH_DOCK must be "0" or "1"');
  }
  return raw === '1';
}

export function parseLaunchDockEnv(
  input: LaunchDockEnvInput = {},
): LaunchDockEnv {
  const on = parseEnvFlag(input.EXPO_PUBLIC_FLAG_LAUNCH_DOCK, '0');
  return Object.freeze({ FLAG_LAUNCH_DOCK: on });
}

export function readLaunchDockBuildFlag(): boolean {
  try {
    return parseLaunchDockEnv({
      EXPO_PUBLIC_FLAG_LAUNCH_DOCK: process.env.EXPO_PUBLIC_FLAG_LAUNCH_DOCK,
    }).FLAG_LAUNCH_DOCK;
  } catch {
    return false;
  }
}
