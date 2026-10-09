import { initMobileSentry } from './initMobileSentry';
import { parseMobileSentryEnv, type MobileSentryEnvInput } from './mobileSentryEnv';
import { resolveMobileSentryMeta, type MobileBuildIdentity } from './mobileSentryRelease';

export function bootstrapMobileSentry(deps: {
  env: MobileSentryEnvInput;
  readIdentity: () => MobileBuildIdentity;
  init?: Parameters<typeof initMobileSentry>[1] extends infer D
    ? D extends { init?: infer I }
      ? I
      : never
    : never;
}): boolean {
  try {
    const env = parseMobileSentryEnv(deps.env);
    const meta = resolveMobileSentryMeta(deps.readIdentity());
    return initMobileSentry(env, { meta, ...(deps.init ? { init: deps.init } : {}) });
  } catch {
    return false;
  }
}
