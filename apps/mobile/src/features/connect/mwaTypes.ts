import type { VersionedTransaction } from '@solana/web3.js';
import type { SignerCapabilities } from '@corso/wallet';

export type MwaChain = 'solana:mainnet' | 'solana:devnet';
export type MwaIdentity = Readonly<{ name: 'Corso'; uri: string; icon: string }>;
export type MwaAccount = Readonly<{ addressBase64: string; label: string | null }>;
export type MwaFailureCode =
  | 'wallet_not_found'
  | 'cancelled'
  | 'timeout'
  | 'wrong_cluster'
  | 'malformed_response'
  | 'reauthorization_failed'
  | 'unsupported_capability'
  | 'platform_unsupported';
export type MwaAuthorization = Readonly<{
  authToken: string;
  accounts: readonly MwaAccount[];
  walletName: string | null;
}>;
export type MwaCapabilities = Readonly<{
  signTransactions: boolean;
  signMessages: boolean;
  signAndSendTransactions: boolean;
}>;

export const MWA_MONEY_DISABLED_CAPABILITIES: MwaCapabilities = Object.freeze({
  signTransactions: false,
  signMessages: false,
  signAndSendTransactions: false,
});

const AUTHORIZATION_KEYS = ['authToken', 'accounts', 'walletName'] as const;
const ACCOUNT_KEYS = ['addressBase64', 'label'] as const;
const CAPABILITY_KEYS = [
  'signTransactions',
  'signMessages',
  'signAndSendTransactions',
] as const;

function assertClosedPlainObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new MwaError('malformed_response');
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    throw new MwaError('malformed_response');
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new MwaError('malformed_response');
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== keys.length) {
    throw new MwaError('malformed_response');
  }
  const nameSet = new Set(names);
  for (const key of keys) {
    if (!nameSet.has(key)) {
      throw new MwaError('malformed_response');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !('value' in descriptor) ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !descriptor.enumerable
    ) {
      throw new MwaError('malformed_response');
    }
  }
  return value as Record<string, unknown>;
}

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

function assertClosedPlainArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new MwaError('malformed_response');
  }
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    throw new MwaError('malformed_response');
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new MwaError('malformed_response');
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    !isOwnDataProperty(lengthDescriptor) ||
    typeof lengthDescriptor?.value !== 'number' ||
    !Number.isInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    throw new MwaError('malformed_response');
  }
  const length = lengthDescriptor.value;
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== length + 1) {
    throw new MwaError('malformed_response');
  }
  const nameSet = new Set(names);
  if (!nameSet.has('length')) {
    throw new MwaError('malformed_response');
  }
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!nameSet.has(key)) {
      throw new MwaError('malformed_response');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!isOwnDataProperty(descriptor) || !descriptor?.enumerable) {
      throw new MwaError('malformed_response');
    }
  }
  return value;
}

function requireExactBoolean(value: unknown): boolean {
  if (value !== true && value !== false) {
    throw new MwaError('malformed_response');
  }
  return value;
}

function requireStringOrNull(value: unknown): string | null {
  if (value !== null && typeof value !== 'string') {
    throw new MwaError('malformed_response');
  }
  return value;
}

export function parseMwaCapabilities(value: unknown): MwaCapabilities {
  const raw = assertClosedPlainObject(value, CAPABILITY_KEYS);
  return Object.freeze({
    signTransactions: requireExactBoolean(raw.signTransactions),
    signMessages: requireExactBoolean(raw.signMessages),
    signAndSendTransactions: requireExactBoolean(raw.signAndSendTransactions),
  });
}

export function parseMwaAuthorization(value: unknown): MwaAuthorization {
  const raw = assertClosedPlainObject(value, AUTHORIZATION_KEYS);
  if (typeof raw.authToken !== 'string' || raw.authToken.length === 0) {
    throw new MwaError('malformed_response');
  }
  const accounts = assertClosedPlainArray(raw.accounts).map((account) => {
    const closed = assertClosedPlainObject(account, ACCOUNT_KEYS);
    if (typeof closed.addressBase64 !== 'string') {
      throw new MwaError('malformed_response');
    }
    return Object.freeze({
      addressBase64: closed.addressBase64,
      label: requireStringOrNull(closed.label),
    });
  });
  return Object.freeze({
    authToken: raw.authToken,
    accounts: Object.freeze(accounts),
    walletName: requireStringOrNull(raw.walletName),
  });
}

export function peekAuthToken(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, 'authToken');
  if (!descriptor || !isOwnDataProperty(descriptor)) {
    return null;
  }
  const token = descriptor.value;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export interface MwaWalletPort {
  authorize(input: { chain: MwaChain; identity: MwaIdentity }): Promise<MwaAuthorization>;
  reauthorize(input: {
    chain: MwaChain;
    identity: MwaIdentity;
    authToken: string;
  }): Promise<MwaAuthorization>;
  getCapabilities(): Promise<MwaCapabilities>;
  signTransactions(input: {
    transactions: readonly VersionedTransaction[];
  }): Promise<readonly VersionedTransaction[]>;
  signMessages?(input: { addresses: readonly string[]; payloads: readonly Uint8Array[] }): Promise<readonly Uint8Array[]>;
  deauthorize(input: { authToken: string }): Promise<void>;
}
export type MwaTransact = <T>(run: (wallet: MwaWalletPort) => Promise<T>) => Promise<T>;

/** Task 1 connect-owned DTO — matches today's safe CorsoSession surface only (no Task 2 fields, no authToken). */
export type MwaConnectSession = Readonly<{
  type: 'connected_external';
  address: string;
  capabilities: SignerCapabilities;
  appLockEnabled: boolean;
}>;

export class MwaError extends Error {
  readonly code: MwaFailureCode;

  constructor(code: MwaFailureCode, message?: string) {
    super(message ?? code);
    this.name = 'MwaError';
    this.code = code;
  }
}

export function isMwaError(error: unknown): error is MwaError {
  return error instanceof MwaError;
}

/** Pure mapping: wallet `MwaCapabilities` → `SignerCapabilities`. Task 2 may bind appLockEnabled to live device-lock pref. */
export function mapMwaCapabilitiesToSignerCapabilities(
  mwa: MwaCapabilities,
): SignerCapabilities {
  return Object.freeze({
    signTransaction: mwa.signTransactions === true,
    signAllTransactions: false,
    signAndSendTransaction: false,
    signMessage: mwa.signMessages === true,
    requiresForegroundHandoff: true,
  });
}
