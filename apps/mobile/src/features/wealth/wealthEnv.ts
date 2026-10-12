
export type WealthEnv = Readonly<{
  FLAG_WEALTH_V1: boolean;
  FLAG_WEALTH_CLASSES: boolean;
  FLAG_WEALTH_HIDE_DOING: boolean;
}>;

export type WealthEnvInput = {
  EXPO_PUBLIC_FLAG_WEALTH_V1?: string;
  EXPO_PUBLIC_FLAG_WEALTH_CLASSES?: string;
  EXPO_PUBLIC_FLAG_WEALTH_HIDE_DOING?: string;
};

export const WAIT_HEADS_UP_LINE_SHOWN = false;

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error('A wealth build flag must be "0" or "1"');
  }
  return raw === '1';
}

export function parseWealthEnv(input: WealthEnvInput = {}): WealthEnv {
  const v1 = parseEnvFlag(input.EXPO_PUBLIC_FLAG_WEALTH_V1, '0');
  const classes = parseEnvFlag(input.EXPO_PUBLIC_FLAG_WEALTH_CLASSES, '0');
  const hide = parseEnvFlag(input.EXPO_PUBLIC_FLAG_WEALTH_HIDE_DOING, '0');
  return Object.freeze({
    FLAG_WEALTH_V1: v1,
    FLAG_WEALTH_CLASSES: classes,
    FLAG_WEALTH_HIDE_DOING: hide,
  });
}

function readWealthEnv(): WealthEnv | null {
  try {
    return parseWealthEnv({
      EXPO_PUBLIC_FLAG_WEALTH_V1: process.env.EXPO_PUBLIC_FLAG_WEALTH_V1,
      EXPO_PUBLIC_FLAG_WEALTH_CLASSES:
        process.env.EXPO_PUBLIC_FLAG_WEALTH_CLASSES,
      EXPO_PUBLIC_FLAG_WEALTH_HIDE_DOING:
        process.env.EXPO_PUBLIC_FLAG_WEALTH_HIDE_DOING,
    });
  } catch {
    return null;
  }
}

/**
 * The inlined build flag. A malformed value throws at parse time in tests;
 * in a shipped bundle the catch keeps the wealth surfaces closed.
 */
export function readWealthV1BuildFlag(): boolean {
  return readWealthEnv()?.FLAG_WEALTH_V1 ?? false;
}

/** The wealth Home's display options. Both closed unless the build sets them. */
export function readWealthHomeOptions(): Readonly<{
  classes: boolean;
  doing: boolean;
}> {
  const env = readWealthEnv();
  return {
    classes: env?.FLAG_WEALTH_CLASSES ?? false,
    doing: env ? !env.FLAG_WEALTH_HIDE_DOING : false,
  };
}
