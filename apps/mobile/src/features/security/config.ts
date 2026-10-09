export function resolveAppleSignInEnabled(value: string | undefined): boolean {
  return value === '1';
}

export function isAppleSignInEnabled(): boolean {
  return resolveAppleSignInEnabled(process.env.EXPO_PUBLIC_APPLE_SIGNIN);
}

export function requirePrivyEnv(): { appId: string; clientId: string } {
  const appId = process.env.EXPO_PUBLIC_PRIVY_APP_ID;
  const clientId = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID;
  if (!appId || !clientId) {
    throw new Error(
      'Missing EXPO_PUBLIC_PRIVY_APP_ID or EXPO_PUBLIC_PRIVY_CLIENT_ID in apps/mobile/.env',
    );
  }
  return { appId, clientId };
}

export function optionalMfaRelyingParty(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_PRIVY_MFA_RELYING_PARTY?.trim();
  if (!raw) return undefined;
  // Lazy import avoided — keep config free of circular deps.
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') {
      throw new Error(
        'EXPO_PUBLIC_PRIVY_MFA_RELYING_PARTY must be an https origin',
      );
    }
    return url.origin;
  } catch (error) {
    if (error instanceof Error && error.message.includes('https origin')) {
      throw error;
    }
    throw new Error(
      'EXPO_PUBLIC_PRIVY_MFA_RELYING_PARTY must be a valid https origin',
    );
  }
}
