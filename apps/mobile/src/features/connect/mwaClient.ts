import { resolveMwaAvailability, type MwaAvailabilityInput } from './mwaAvailability';
import { mwaAddressToBase58, requireSingleMwaAccount } from './mwaAddress';
import type { MwaSessionStore, StoredMwaSession } from './mwaSessionStore';
import {
  MWA_MONEY_DISABLED_CAPABILITIES,
  MwaError,
  isMwaError,
  mapMwaCapabilitiesToSignerCapabilities,
  parseMwaAuthorization,
  parseMwaCapabilities,
  peekAuthToken,
  type MwaAuthorization,
  type MwaCapabilities,
  type MwaChain,
  type MwaConnectSession,
  type MwaFailureCode,
  type MwaIdentity,
  type MwaTransact,
  type MwaWalletPort,
} from './mwaTypes';

export type MwaConnectResult = Readonly<{
  session: MwaConnectSession;
  capabilities: MwaCapabilities;
}>;

export type MwaRestoreResult =
  | Readonly<{ state: 'none' }>
  | Readonly<{ state: 'ready'; result: MwaConnectResult }>
  | Readonly<{
      state: 'degraded';
      session: MwaConnectSession;
      reason: MwaFailureCode;
    }>;

function connectSessionFrom(
  address: string,
  authorizationCaps: MwaCapabilities,
): MwaConnectSession {
  return Object.freeze({
    type: 'connected_external',
    address,
    capabilities: mapMwaCapabilitiesToSignerCapabilities(authorizationCaps),
    appLockEnabled: true,
  });
}

function requireAuthToken(authToken: string): string {
  if (typeof authToken !== 'string' || authToken.length === 0) {
    throw new MwaError('malformed_response');
  }
  return authToken;
}

function sessionFromAuthorization(auth: MwaAuthorization): {
  address: string;
  authToken: string;
} {
  const account = requireSingleMwaAccount(auth.accounts);
  return {
    address: mwaAddressToBase58(account.addressBase64),
    authToken: requireAuthToken(auth.authToken),
  };
}

function restoreFailureCode(error: unknown): MwaFailureCode {
  return isMwaError(error) ? error.code : 'reauthorization_failed';
}

function moneyDisabledRecord(
  authToken: string,
  address: string,
  walletName: string | null,
): StoredMwaSession {
  return {
    authToken,
    address,
    walletName,
    capabilities: MWA_MONEY_DISABLED_CAPABILITIES,
  };
}

async function bestEffortDeauthorize(
  wallet: MwaWalletPort,
  authToken: string | null,
): Promise<void> {
  if (!authToken) {
    return;
  }
  try {
    await wallet.deauthorize({ authToken });
  } catch {
    // Newly issued tokens must not remain authorized after a failed connect/restore.
  }
}

async function bestEffortRemove(store: MwaSessionStore): Promise<void> {
  try {
    await store.remove();
  } catch {
    // Local removal is best-effort inside failure handlers; disconnect uses finally.
  }
}

async function safeLoad(store: MwaSessionStore): Promise<StoredMwaSession | null> {
  try {
    return await store.load();
  } catch {
    return null;
  }
}

export async function connectMwa(args: {
  transact: MwaTransact;
  store: MwaSessionStore;
  identity: MwaIdentity;
  chain: MwaChain;
}): Promise<MwaConnectResult> {
  return args.transact(async (wallet) => {
    const rawAuth = await wallet.authorize({
      chain: args.chain,
      identity: args.identity,
    });
    try {
      const auth = parseMwaAuthorization(rawAuth);
      const { address, authToken } = sessionFromAuthorization(auth);
      const capabilities = parseMwaCapabilities(await wallet.getCapabilities());
      await args.store.save({
        authToken,
        address,
        walletName: auth.walletName,
        capabilities,
      });
      return {
        session: connectSessionFrom(address, capabilities),
        capabilities,
      };
    } catch (error) {
      await bestEffortDeauthorize(wallet, peekAuthToken(rawAuth));
      await bestEffortRemove(args.store);
      throw error;
    }
  });
}

/** Boot kill switch: unavailable or unknown config removes only local MWA authority. */
export async function restoreMwaWhenAvailable(args: Parameters<typeof restoreMwa>[0] & {
  availability: () => Promise<MwaAvailabilityInput>;
}): Promise<MwaRestoreResult> {
  let available = false;
  try {
    available = resolveMwaAvailability(await args.availability());
  } catch {
    // Config fetch failures must never open a persisted wallet handoff.
  }
  if (!available) {
    await args.store.remove();
    return { state: 'none' };
  }
  return restoreMwa(args);
}

export async function restoreMwa(args: {
  transact: MwaTransact;
  store: MwaSessionStore;
  identity: MwaIdentity;
  chain: MwaChain;
}): Promise<MwaRestoreResult> {
  const stored = await args.store.load();
  if (!stored) {
    return { state: 'none' };
  }

  try {
    return await args.transact(async (wallet) => {
      const rawAuth = await wallet.reauthorize({
        chain: args.chain,
        identity: args.identity,
        authToken: stored.authToken,
      });

      let rotatedToken = peekAuthToken(rawAuth);
      let restoredAddress: string | null = null;
      let restoredWalletName: string | null = null;
      let disabledPersisted = false;

      try {
        const auth = parseMwaAuthorization(rawAuth);
        rotatedToken = auth.authToken;
        restoredWalletName = auth.walletName;
        const { address, authToken } = sessionFromAuthorization(auth);
        restoredAddress = address;
        rotatedToken = authToken;

        await args.store.save(moneyDisabledRecord(authToken, address, auth.walletName));
        disabledPersisted = true;

        const capabilities = parseMwaCapabilities(await wallet.getCapabilities());
        await args.store.save({
          authToken,
          address,
          walletName: auth.walletName,
          capabilities,
        });
        return {
          state: 'ready' as const,
          result: {
            session: connectSessionFrom(address, capabilities),
            capabilities,
          },
        };
      } catch (error) {
        await bestEffortDeauthorize(wallet, rotatedToken);
        if (disabledPersisted && rotatedToken && restoredAddress !== null) {
          try {
            await args.store.save(
              moneyDisabledRecord(rotatedToken, restoredAddress, restoredWalletName),
            );
          } catch {
            await bestEffortRemove(args.store);
          }
        } else {
          await bestEffortRemove(args.store);
        }
        throw error;
      }
    });
  } catch (error) {
    const current = await safeLoad(args.store);
    return {
      state: 'degraded',
      session: connectSessionFrom(
        current?.address ?? stored.address,
        MWA_MONEY_DISABLED_CAPABILITIES,
      ),
      reason: restoreFailureCode(error),
    };
  }
}

export async function disconnectMwa(args: {
  transact: MwaTransact;
  store: MwaSessionStore;
}): Promise<void> {
  try {
    const stored = await args.store.load();
    if (stored) {
      await args.transact(async (wallet) => {
        await wallet.deauthorize({ authToken: stored.authToken });
      });
    }
  } catch {
    // Remote deauthorize is best-effort; local token removal is required.
  } finally {
    await args.store.remove();
  }
}
