import type { CorsoSigner } from '@corso/wallet';
import { VersionedTransaction, type Connection } from '@solana/web3.js';
import { mwaAddressToBase58, requireSingleMwaAccount } from './mwaAddress';
import {
  MWA_AUTH_TOKEN_REF,
  type MwaSessionStore,
} from './mwaSessionStore';
import {
  MWA_MONEY_DISABLED_CAPABILITIES,
  MwaError,
  isMwaError,
  parseMwaAuthorization,
  parseMwaCapabilities,
  type MwaChain,
  type MwaFailureCode,
  type MwaIdentity,
  type MwaTransact,
  type MwaWalletPort,
} from './mwaTypes';
import type { CorsoSession } from '@/src/features/session/types';
import {
  assertSafeToSign,
  messageBytesOf,
} from '@/src/features/security/assertSafeToSign';
import { StepUpRequiredError } from '@/src/features/security/mfaGateCore';
import { assertSignedMatchesMessage } from '@/src/features/security/verifySignedTransaction';

export type MwaSignerLiveAuthority = {
  assertLive: () => void;
};

const RAW_CAPABILITIES = Object.freeze({
  signTransaction: true,
  signAllTransactions: false,
  signAndSendTransaction: false,
  signMessage: false,
  requiresForegroundHandoff: true,
});

function mapWalletFailure(error: unknown, fallback: MwaFailureCode): never {
  if (error instanceof StepUpRequiredError) {
    throw error;
  }
  if (error instanceof MwaError) {
    throw new MwaError(error.code);
  }
  throw new MwaError(fallback);
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

function assertClosedNativeArray(value: unknown): unknown[] {
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

function isVersionedTransaction(value: unknown): value is VersionedTransaction {
  return (
    typeof value === 'object' &&
    value !== null &&
    'serialize' in value &&
    typeof (value as VersionedTransaction).serialize === 'function' &&
    'signatures' in value
  );
}

function snapshotClosedSignedTransaction(value: unknown): VersionedTransaction {
  let list: unknown[];
  try {
    list = assertClosedNativeArray(value);
  } catch (error) {
    if (error instanceof MwaError) {
      throw error;
    }
    throw new MwaError('malformed_response');
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(list, 'length');
  if (!isOwnDataProperty(lengthDescriptor) || lengthDescriptor.value !== 1) {
    throw new MwaError('malformed_response');
  }
  const itemDescriptor = Object.getOwnPropertyDescriptor(list, '0');
  if (!isOwnDataProperty(itemDescriptor) || !itemDescriptor.enumerable) {
    throw new MwaError('malformed_response');
  }
  const snapped = itemDescriptor.value;
  if (!isVersionedTransaction(snapped)) {
    throw new MwaError('malformed_response');
  }
  let local: VersionedTransaction;
  try {
    local = VersionedTransaction.deserialize(snapped.serialize());
  } catch {
    throw new MwaError('malformed_response');
  }
  return local;
}

function rethrowCanonical(error: unknown, canonicalizeUnknown: boolean): never {
  if (error instanceof StepUpRequiredError) {
    throw error;
  }
  if (isMwaError(error)) {
    throw new MwaError(error.code);
  }
  if (canonicalizeUnknown) {
    throw new MwaError('malformed_response');
  }
  throw error;
}

function requireMatchingStoreRecord(
  session: CorsoSession,
  stored: Awaited<ReturnType<MwaSessionStore['load']>>,
): NonNullable<Awaited<ReturnType<MwaSessionStore['load']>>> {
  if (session.authTokenRef !== MWA_AUTH_TOKEN_REF) {
    throw new MwaError('reauthorization_failed');
  }
  if (!stored || stored.address !== session.address) {
    throw new MwaError('reauthorization_failed');
  }
  if (typeof stored.authToken !== 'string' || stored.authToken.length === 0) {
    throw new MwaError('reauthorization_failed');
  }
  return stored;
}

async function bestEffortCleanupRotatedAuthorization(
  wallet: MwaWalletPort,
  rotatedToken: string | null,
  store: MwaSessionStore,
  session: CorsoSession,
): Promise<void> {
  if (rotatedToken) {
    try {
      await wallet.deauthorize({ authToken: rotatedToken });
    } catch {
      // Best effort — remote orphan must not block local fail-closed cleanup.
    }
  }
  try {
    await store.remove();
  } catch {
    try {
      const stored = await store.load();
      if (stored) {
        await store.save({
          authToken: stored.authToken,
          address: session.address,
          walletName: stored.walletName,
          capabilities: MWA_MONEY_DISABLED_CAPABILITIES,
        });
      }
    } catch {
      // Fail closed: leave money-disabled if removal cannot complete.
    }
  }
}

export function createMwaSigner(args: {
  session: CorsoSession;
  transact: MwaTransact;
  store: MwaSessionStore;
  identity: MwaIdentity;
  chain: MwaChain;
  liveAuthority: MwaSignerLiveAuthority;
}): CorsoSigner<VersionedTransaction, Connection> {
  const { session, transact, store, identity, chain, liveAuthority } = args;

  async function signTransaction(
    transaction: VersionedTransaction,
  ): Promise<VersionedTransaction> {
    liveAuthority.assertLive();
    const stored = requireMatchingStoreRecord(session, await store.load());
    liveAuthority.assertLive();
    assertSafeToSign(transaction, session);
    const expectedMessageBytes = messageBytesOf(transaction);

    let cleanupWallet: MwaWalletPort | null = null;
    let rotatedToken: string | null = null;
    let disabledSaved = false;
    let signed: VersionedTransaction | null = null;
    let walletName: string | null = null;
    let capabilities: ReturnType<typeof parseMwaCapabilities> | null = null;
    let callbackCompleted = false;
    let cleaned = false;

    async function cleanupRotated(): Promise<void> {
      if (cleaned) {
        return;
      }
      cleaned = true;
      if (cleanupWallet && rotatedToken) {
        await bestEffortCleanupRotatedAuthorization(
          cleanupWallet,
          rotatedToken,
          store,
          session,
        );
        return;
      }
      if (disabledSaved) {
        try {
          await store.remove();
        } catch {
          // Leave the money-disabled record in place if removal cannot complete.
        }
      }
    }

    try {
      await transact(async (wallet) => {
        cleanupWallet = wallet;
        liveAuthority.assertLive();

        try {
          let authorization;
          try {
            authorization = parseMwaAuthorization(
              await wallet.reauthorize({
                chain,
                identity,
                authToken: stored.authToken,
              }),
            );
          } catch (error) {
            mapWalletFailure(error, 'reauthorization_failed');
          }
          rotatedToken = authorization.authToken;
          walletName = authorization.walletName;
          liveAuthority.assertLive();

          const account = requireSingleMwaAccount(authorization.accounts);
          const rotatedAddress = mwaAddressToBase58(account.addressBase64);
          if (rotatedAddress !== session.address) {
            throw new MwaError('reauthorization_failed');
          }

          liveAuthority.assertLive();
          try {
            await store.save({
              authToken: authorization.authToken,
              address: session.address,
              walletName: authorization.walletName,
              capabilities: MWA_MONEY_DISABLED_CAPABILITIES,
            });
            disabledSaved = true;
          } catch {
            throw new MwaError('malformed_response');
          }
          liveAuthority.assertLive();

          try {
            capabilities = parseMwaCapabilities(await wallet.getCapabilities());
          } catch (error) {
            mapWalletFailure(error, 'malformed_response');
          }
          liveAuthority.assertLive();

          if (capabilities.signTransactions !== true) {
            throw new MwaError('unsupported_capability');
          }

          liveAuthority.assertLive();
          let signedList;
          try {
            signedList = await wallet.signTransactions({
              transactions: [transaction],
            });
          } catch (error) {
            mapWalletFailure(error, 'malformed_response');
          }
          liveAuthority.assertLive();

          signed = snapshotClosedSignedTransaction(signedList);
          liveAuthority.assertLive();
          assertSignedMatchesMessage({
            signed,
            expectedMessageBytes,
            sessionAddress: session.address,
          });
          liveAuthority.assertLive();
          callbackCompleted = true;
        } catch (error) {
          await cleanupRotated();
          rethrowCanonical(error, false);
        }
      });
    } catch (error) {
      await cleanupRotated();
      rethrowCanonical(error, callbackCompleted);
    }

    try {
      liveAuthority.assertLive();
      if (!signed || !capabilities || !rotatedToken) {
        throw new MwaError('malformed_response');
      }
      try {
        await store.save({
          authToken: rotatedToken,
          address: session.address,
          walletName,
          capabilities,
        });
      } catch {
        throw new MwaError('malformed_response');
      }
      return signed;
    } catch (error) {
      await cleanupRotated();
      rethrowCanonical(error, true);
    }
  }

  return {
    address: session.address,
    type: 'connected_external',
    capabilities: RAW_CAPABILITIES,
    signTransaction,
    async signMessage() {
      throw new MwaError('unsupported_capability');
    },
  };
}
