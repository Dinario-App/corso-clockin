export type SkillsEnv = Readonly<{
  FLAG_SKILLS: boolean;
}>;

export type SkillsEnvInput = {
  EXPO_PUBLIC_FLAG_SKILLS?: string;
};

function parseEnvFlag(
  value: string | undefined,
  defaultValue: '0' | '1',
): boolean {
  const raw = (value ?? defaultValue).trim();
  if (raw !== '0' && raw !== '1') {
    throw new Error('EXPO_PUBLIC_FLAG_SKILLS must be "0" or "1"');
  }
  return raw === '1';
}

export function parseSkillsEnv(input: SkillsEnvInput = {}): SkillsEnv {
  const FLAG_SKILLS = parseEnvFlag(input.EXPO_PUBLIC_FLAG_SKILLS, '0');
  return Object.freeze({ FLAG_SKILLS });
}

export function readSkillsBuildFlag(): boolean {
  try {
    return parseSkillsEnv({
      EXPO_PUBLIC_FLAG_SKILLS: process.env.EXPO_PUBLIC_FLAG_SKILLS,
    }).FLAG_SKILLS;
  } catch {
    return false;
  }
}
