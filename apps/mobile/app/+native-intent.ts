import {
  GROKBOT_HOME_HREF,
  readGrokbotRoutesFlag,
  rewriteGrokbotDeepLink,
} from '@/src/features/navigation/grokbotRoutes';
import {
  readRampReturnClaimSource,
  rewriteWebOriginLink,
} from '@/src/features/navigation/webOriginLinks';
import { rewriteCustomSchemeLink } from '@/src/features/navigation/customSchemeLinks';

export function redirectSystemPath(event: {
  path: string;
  initial: boolean;
}): string {
  try {
    const path = rewriteCustomSchemeLink(
      rewriteWebOriginLink(event.path, readRampReturnClaimSource()),
    );
    return rewriteGrokbotDeepLink(path, readGrokbotRoutesFlag());
  } catch {
    return GROKBOT_HOME_HREF;
  }
}
