import { normalizeMwaTransportError } from './connectFlow';
import {
  transact,
  type Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import type { VersionedTransaction } from '@solana/web3.js';

import type {
  MwaAuthorization,
  MwaCapabilities,
  MwaTransact,
  MwaWalletPort,
} from './mwaTypes';

type VendorAuthorization = Awaited<ReturnType<Web3MobileWallet['authorize']>>;

function mapAuthorization(result: VendorAuthorization): MwaAuthorization {
  return {
    authToken: result.auth_token,
    accounts: result.accounts.map((account) => ({
      addressBase64: account.address,
      label: typeof account.label === 'string' ? account.label : null,
    })),
    walletName: null,
  };
}

function mapCapabilities(
  result: Awaited<ReturnType<Web3MobileWallet['getCapabilities']>>,
): MwaCapabilities {
  return {
    signTransactions: result.features.includes('solana:signTransactions'),
    signMessages: true,
    signAndSendTransactions: result.supports_sign_and_send_transactions === true,
  };
}

function bindWallet(wallet: Web3MobileWallet): MwaWalletPort {
  return {
    authorize: async ({ chain, identity }) =>
      mapAuthorization(await wallet.authorize({ chain, identity })),
    reauthorize: async ({ identity, authToken }) =>
      mapAuthorization(
        await wallet.reauthorize({
          identity,
          auth_token: authToken,
        }),
      ),
    getCapabilities: async () => mapCapabilities(await wallet.getCapabilities()),
    signTransactions: async ({ transactions }) =>
      wallet.signTransactions<VersionedTransaction>({
        transactions: [...transactions],
      }),
    signMessages: async ({ addresses, payloads }) => wallet.signMessages({ addresses: [...addresses], payloads: [...payloads] }),
    deauthorize: async ({ authToken }) => {
      await wallet.deauthorize({ auth_token: authToken });
    },
  };
}

export const mwaTransact: MwaTransact = async (run) =>
  transact(async (wallet) => run(bindWallet(wallet))).catch(error => { throw normalizeMwaTransportError(error); });
