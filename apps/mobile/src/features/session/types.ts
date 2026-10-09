import type { SignerCapabilities } from '@corso/wallet';
import { MWA_AUTH_TOKEN_REF } from '@/src/features/connect/mwaSessionStore';
import type { MwaConnectSession } from '@/src/features/connect/mwaTypes';

/** Production session doors. */
export type SessionType = 'privy_embedded' | 'imported_seed' | 'connected_external';

export type ConnectedStatus = 'none' | 'restoring' | 'ready' | 'degraded';

export type ProfileSignOutPlan =
  | { kind: 'clear_connected' }
  /** Clears the live local session and app lock; imported words stay on-phone. */
  | { kind: 'reset_local_and_privy_logout' };

export type ConnectedRestoreInput =
  | { state: 'none' }
  | {
      state: 'ready';
      session: MwaConnectSession;
      walletName: string | null;
    }
  | {
      state: 'degraded';
      session: MwaConnectSession;
      walletName: string | null;
    };

/**
 * Safe to log / persist in non-secret storage.
 * Never put Privy tokens, providers, mnemonics, Grid sessionSecrets, or MWA
 * auth tokens here. Connected sessions carry authTokenRef only.
 */
export type CorsoSession = {
  type: SessionType;
  address: string;
  privyUserId?: string;
  privyWalletId?: string;
  capabilities: SignerCapabilities;
  appLockEnabled: boolean;
  /** connected_external only */
  transport?: 'mwa';
  /** connected_external only — display; never trusted for security decisions */
  walletName?: string | null;
  /** connected_external only — SecureStore handle, never the token */
  authTokenRef?: typeof MWA_AUTH_TOKEN_REF;
};

export class InvalidMwaConnectSessionError extends Error {
  constructor() {
    super('invalid_mwa_connect_session');
    this.name = 'InvalidMwaConnectSessionError';
  }
}

const CONNECT_SESSION_KEYS = [
  'type',
  'address',
  'capabilities',
  'appLockEnabled',
] as const;

const SIGNER_CAPABILITY_KEYS = [
  'signTransaction',
  'signAllTransactions',
  'signAndSendTransaction',
  'signMessage',
  'requiresForegroundHandoff',
] as const;

export const PRIVY_EMBEDDED_CAPABILITIES: SignerCapabilities = {
  signTransaction: true,
  signAllTransactions: false,
  signAndSendTransaction: true,
  signMessage: true,
  requiresForegroundHandoff: false,
};

export const IMPORTED_SEED_CAPABILITIES: SignerCapabilities = {
  signTransaction: true,
  signAllTransactions: false,
  signAndSendTransaction: true,
  signMessage: true,
  requiresForegroundHandoff: false,
};

export const DEGRADED_CONNECTED_CAPABILITIES: SignerCapabilities = Object.freeze({
  signTransaction: false,
  signAllTransactions: false,
  signAndSendTransaction: false,
  signMessage: false,
  requiresForegroundHandoff: true,
});

function isOwnDataProperty(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor {
  return Boolean(
    descriptor &&
      'value' in descriptor &&
      descriptor.get === undefined &&
      descriptor.set === undefined,
  );
}

function assertClosedPlainObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidMwaConnectSessionError();
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new InvalidMwaConnectSessionError();
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new InvalidMwaConnectSessionError();
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== keys.length) {
    throw new InvalidMwaConnectSessionError();
  }
  const nameSet = new Set(names);
  for (const key of keys) {
    if (!nameSet.has(key)) {
      throw new InvalidMwaConnectSessionError();
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !isOwnDataProperty(descriptor) ||
      !descriptor.enumerable
    ) {
      throw new InvalidMwaConnectSessionError();
    }
  }
  return value as Record<string, unknown>;
}

function requireExactBoolean(value: unknown): boolean {
  if (value !== true && value !== false) {
    throw new InvalidMwaConnectSessionError();
  }
  return value;
}

function parseSignerCapabilitiesClosed(value: unknown): SignerCapabilities {
  const raw = assertClosedPlainObject(value, SIGNER_CAPABILITY_KEYS);
  return Object.freeze({
    signTransaction: requireExactBoolean(raw.signTransaction),
    signAllTransactions: requireExactBoolean(raw.signAllTransactions),
    signAndSendTransaction: requireExactBoolean(raw.signAndSendTransaction),
    signMessage: requireExactBoolean(raw.signMessage),
    requiresForegroundHandoff: requireExactBoolean(raw.requiresForegroundHandoff),
  });
}

function freezeCorsoSession(session: CorsoSession): CorsoSession {
  return Object.freeze({
    ...session,
    capabilities: Object.freeze({ ...session.capabilities }),
  });
}

/** Closed-shape validate a connect DTO without invoking accessors or prototype payloads. */
export function assertMwaConnectSessionDto(value: unknown): MwaConnectSession {
  const raw = assertClosedPlainObject(value, CONNECT_SESSION_KEYS);
  if (raw.type !== 'connected_external') {
    throw new InvalidMwaConnectSessionError();
  }
  if (typeof raw.address !== 'string' || raw.address.length === 0) {
    throw new InvalidMwaConnectSessionError();
  }
  return Object.freeze({
    type: 'connected_external',
    address: raw.address,
    capabilities: parseSignerCapabilitiesClosed(raw.capabilities),
    appLockEnabled: requireExactBoolean(raw.appLockEnabled),
  });
}

export function connectedAppLockEnabled(
  pref: 'biometric' | 'passcode' | 'skipped' | null,
): boolean {
  return pref === 'biometric' || pref === 'passcode';
}

export function mapMwaConnectSessionToCorsoSession(
  dto: unknown,
  extras: { walletName: string | null; appLockEnabled: boolean },
): CorsoSession {
  const validated = assertMwaConnectSessionDto(dto);
  return freezeCorsoSession({
    type: 'connected_external',
    address: validated.address,
    capabilities: Object.freeze({
      signTransaction: validated.capabilities.signTransaction === true,
      signAllTransactions: false,
      signAndSendTransaction: false,
      signMessage: validated.capabilities.signMessage === true,
      requiresForegroundHandoff: true,
    }),
    appLockEnabled: extras.appLockEnabled,
    transport: 'mwa',
    walletName: extras.walletName,
    authTokenRef: MWA_AUTH_TOKEN_REF,
  });
}

export function resolveExclusiveCorsoSession(input: {
  connected: CorsoSession | null;
  connectedStatus: ConnectedStatus;
  imported: CorsoSession | null;
  privy: CorsoSession | null;
}): CorsoSession | null {
  if (
    input.connected &&
    (input.connectedStatus === 'ready' || input.connectedStatus === 'degraded')
  ) {
    return input.connected;
  }
  if (input.imported) return input.imported;
  return input.privy;
}

export function sessionStateFromConnectedRestore(
  input: ConnectedRestoreInput,
  extras: { appLockEnabled: boolean },
): { session: CorsoSession | null; connectedStatus: ConnectedStatus } {
  if (input.state === 'none') {
    return { session: null, connectedStatus: 'none' };
  }
  const mapped = mapMwaConnectSessionToCorsoSession(input.session, {
    walletName: input.walletName,
    appLockEnabled: extras.appLockEnabled,
  });
  if (input.state === 'degraded') {
    return {
      session: freezeCorsoSession({
        ...mapped,
        capabilities: DEGRADED_CONNECTED_CAPABILITIES,
      }),
      connectedStatus: 'degraded',
    };
  }
  return {
    session: mapped,
    connectedStatus: 'ready',
  };
}

export function resolveProfileSignOutPlan(
  type: SessionType | undefined,
): ProfileSignOutPlan {
  if (type === 'connected_external') {
    return { kind: 'clear_connected' };
  }
  return { kind: 'reset_local_and_privy_logout' };
}
