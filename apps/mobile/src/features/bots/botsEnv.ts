export type BotsEnv = Readonly<{
  FLAG_BOTS: boolean;
}>;

export type BotsEnvInput = {
  EXPO_PUBLIC_FLAG_BOTS?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error('EXPO_PUBLIC_FLAG_BOTS must be "0" or "1"');
  }
  return raw === '1';
}

export function parseBotsEnv(input: BotsEnvInput = {}): BotsEnv {
  parseEnvFlag(input.EXPO_PUBLIC_FLAG_BOTS, '0');
  const FLAG_BOTS = false;
  return Object.freeze({ FLAG_BOTS });
}

export function readBotsBuildFlag(): boolean {
  try {
    return parseBotsEnv({
      EXPO_PUBLIC_FLAG_BOTS: process.env.EXPO_PUBLIC_FLAG_BOTS,
    }).FLAG_BOTS;
  } catch {
    return false;
  }
}
