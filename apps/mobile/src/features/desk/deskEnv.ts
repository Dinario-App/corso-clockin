export type DeskEnv = Readonly<{
  FLAG_DESK_V1: boolean;
}>;

export type DeskEnvInput = {
  EXPO_PUBLIC_FLAG_DESK_V1?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error('EXPO_PUBLIC_FLAG_DESK_V1 must be "0" or "1"');
  }
  return raw === '1';
}

export function parseDeskEnv(input: DeskEnvInput = {}): DeskEnv {
  const FLAG_DESK_V1 = parseEnvFlag(input.EXPO_PUBLIC_FLAG_DESK_V1, '0');
  return Object.freeze({ FLAG_DESK_V1 });
}

export function readDeskBuildFlag(): boolean {
  try {
    return parseDeskEnv({
      EXPO_PUBLIC_FLAG_DESK_V1: process.env.EXPO_PUBLIC_FLAG_DESK_V1,
    }).FLAG_DESK_V1;
  } catch {
    return false;
  }
}
