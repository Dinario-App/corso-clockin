/** Privy's own SDK / key-assembly origins. Sub-frame only — never top-frame. */
export const PRIVY_FRAME_ORIGINS: readonly string[] = [
  'https://auth.privy.io',
];

export type NavigationDecision = {
  allow: boolean;
  terminate: boolean;
  reason:
    | 'allowed_export_origin'
    | 'allowed_privy_frame'
    | 'blocked_foreign_origin'
    | 'blocked_insecure_scheme'
    | 'blocked_unparsable';
};

export type NavigationInput = {
  url: string | undefined | null;
  allowedOrigin: string;
  /**
   * react-native-webview supplies `isTopFrame` on iOS. Android does not always
   * populate it; absent → treated as a top-frame navigation (the strict path).
   */
  isTopFrame?: boolean;
  allowedFrameOrigins?: readonly string[];
};

function originOf(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function decideExportNavigation(
  input: NavigationInput,
): NavigationDecision {
  const raw = typeof input.url === 'string' ? input.url.trim() : '';
  if (!raw) {
    return { allow: false, terminate: true, reason: 'blocked_unparsable' };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { allow: false, terminate: true, reason: 'blocked_unparsable' };
  }

  // about:, data:, file:, javascript:, intent:, custom schemes — all hostile here.
  if (parsed.protocol !== 'https:') {
    return { allow: false, terminate: true, reason: 'blocked_insecure_scheme' };
  }

  const allowedOrigin = originOf(input.allowedOrigin);
  if (!allowedOrigin) {
    // Misconfigured allowlist must never degrade to "allow".
    return { allow: false, terminate: true, reason: 'blocked_unparsable' };
  }

  if (parsed.origin === allowedOrigin) {
    return { allow: true, terminate: false, reason: 'allowed_export_origin' };
  }

  const isTopFrame = input.isTopFrame !== false;
  if (!isTopFrame) {
    const frameOrigins = input.allowedFrameOrigins ?? PRIVY_FRAME_ORIGINS;
    if (frameOrigins.includes(parsed.origin)) {
      return { allow: true, terminate: false, reason: 'allowed_privy_frame' };
    }
  }

  return { allow: false, terminate: true, reason: 'blocked_foreign_origin' };
}
